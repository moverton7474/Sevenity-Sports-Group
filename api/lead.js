/**
 * Sevenity lead intake.
 *
 * Receives a contact or scan-follow-up submission and emails it to Sevenity.
 * Nothing is stored anywhere, the email is the record and the mailbox is the CRM.
 * See ops/SEVENITY-DATA-LAYER-DECISION.md for why there is no database here.
 *
 * Reply-To is set to the athlete, so Sevenity answers by hitting reply.
 *
 * When the submission is a package request (body.invoice === true, with a
 * package + price attached), a second email, a simple invoice with payment
 * instructions, is sent straight to the submitter. That send is best-effort:
 * if it fails, the internal notification to Sevenity has already gone out, so
 * the request still succeeds and Sevenity can follow up by hand.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Package prices live here, on the server, so player development pricing is never
// shown on the site. The client sends only the package id; the price is looked up
// here and appears for the first time in the invoice email.
const PACKAGES = {
  'training-1session': { name: 'Individual session', price: '$65' },
  'training-5session': { name: '5-session package', price: '$250' },
  'training-unlimited': { name: 'Unlimited player development (monthly)', price: '$500/mo' },
  'training-pro': { name: 'Sevenity Pro Session', price: '$130/session' },
  'content-video': { name: 'Videography', price: '$120/session' },
  'content-photo': { name: 'Photography', price: '$50/session' },
  'content-bundle': { name: 'Video + photography bundle', price: '$150/session' },
};
const MAX_BODY = 16 * 1024;

// Best-effort throttle. Serverless is stateless, so this only holds within a warm
// instance, it blunts casual abuse, it is not a security control. The honeypot and
// the dwell-time check do the real work.
const seen = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

function throttled(ip) {
  const now = Date.now();
  const hits = (seen.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 500) for (const [k, v] of seen) if (!v.some((t) => now - t < WINDOW_MS)) seen.delete(k);
  return hits.length > MAX_PER_WINDOW;
}

const clean = (v, max = 300) => String(v == null ? '' : v).replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, max);
const looksLikeEmail = (v) => /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(v);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  // Every enquiry (and every alert) goes to Chase's work inbox, regardless of the LEAD_TO setting in Vercel.
  const to = 'chase@sevenitysportsgroup.com';
  const from = process.env.LEAD_FROM;
  if (!apiKey || !to || !from) {
    console.error('lead: missing RESEND_API_KEY / LEAD_TO / LEAD_FROM');
    return res.status(500).json({ error: "That didn't send. Email chase@sevenitysportsgroup.com directly and we'll pick it up." });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(413).json({ error: 'Message is too long.' });
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Could not read that submission.' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Could not read that submission.' });

  // Honeypot: a real person never fills a field they cannot see.
  if (clean(body.company)) return res.status(200).json({ ok: true });

  // Dwell time: bots post instantly. 2.5s is well under a human's fill time.
  const elapsed = Number(body.elapsed);
  if (Number.isFinite(elapsed) && elapsed < 2500) return res.status(200).json({ ok: true });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (throttled(ip)) return res.status(429).json({ error: 'That went through already. Give it a minute before sending another.' });

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const handle = clean(body.handle, 80);
  const phone = clean(body.phone, 40);
  const interest = clean(body.interest, 60) || 'General';
  const message = clean(body.message, 4000);
  const scan = body.scan && typeof body.scan === 'object' ? body.scan : null;
  const wantsInvoice = body.invoice === true;
  const known = PACKAGES[clean(body.packageId, 40)];
  const pkg = known ? known.name : clean(body.package, 120);
  const price = known ? known.price : clean(body.price, 40);
  const athlete = clean(body.athlete, 120);
  const prefDate = clean(body.date, 60);
  const prefTime = clean(body.time, 60);
  const notes = clean(body.notes, 1000);
  const location = clean(body.location, 200);

  if (!name) return res.status(400).json({ error: "Add your name so we know who we're replying to." });
  if (!looksLikeEmail(email)) return res.status(400).json({ error: 'That email address does not look right. Check it and and try again.' });

  const scanRows = scan
    ? Object.entries(scan)
        .slice(0, 20)
        .map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#6C7788">${esc(clean(k, 40))}</td><td style="padding:4px 0"><b>${esc(clean(v, 120))}</b></td></tr>`)
        .join('')
    : '';

  const row = (k, v) => (v ? `<tr><td style="padding:4px 14px 4px 0;color:#6C7788">${k}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>` : '');

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#0D131B;line-height:1.6">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#14559E">New enquiry &middot; ${esc(interest)}</p>
    <h2 style="margin:0 0 16px;font-size:20px">${esc(name)}</h2>
    <table style="border-collapse:collapse;margin-bottom:18px">
      ${row('Email', email)}${row('Phone', phone)}${row('Instagram', handle)}${row('Interested in', interest)}${row('Package', pkg)}${row('Price', price)}
    </table>
    ${message ? `<p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6C7788">Message</p><p style="margin:0 0 18px;white-space:pre-wrap">${esc(message)}</p>` : ''}
    ${scanRows ? `<p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6C7788">Their Brand Intelligence scan</p><table style="border-collapse:collapse;margin-bottom:18px">${scanRows}</table>` : ''}
    <p style="margin:0;color:#6C7788;font-size:13px">Reply to this email and it goes straight back to ${esc(name)}.</p>
  </div>`;

  const text = [
    `New enquiry: ${interest}`, '', `Name: ${name}`, `Email: ${email}`,
    phone ? `Phone: ${phone}` : '', handle ? `Instagram: ${handle}` : '', '',
    message ? `Message:\n${message}` : '',
    scan ? `\nScan:\n${Object.entries(scan).slice(0, 20).map(([k, v]) => `  ${clean(k, 40)}: ${clean(v, 120)}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  // Build the invoice payload up front (if this submission needs one) so it can be
  // fired off in the SAME instant as the internal notification below, instead of
  // waiting for that request to finish first. The two emails are independent, so
  // sending them one after another was paying for two round-trips back-to-back,   // this cuts the wait roughly in half.
  let invoicePayload = null;
  if (wantsInvoice && pkg && price) {
    const invoiceNo = `SVN-${Date.now().toString(36).toUpperCase()}`;
    const invoiceDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const when = [[prefDate, prefTime].filter(Boolean).join(' at '), location].filter(Boolean).join(' · ');
    // Tap-to-pay link: opens Venmo (app on phones, website on desktop) with
    // Chase as the recipient and the amount + invoice number filled in.
    const amountNum = (price.replace(/,/g, '').match(/\d+(?:\.\d{1,2})?/) || [''])[0];
    const venmoUrl = 'https://venmo.com/Chase-Clemmons-7?txn=pay'
      + (amountNum ? `&amount=${amountNum}` : '')
      + `&note=${encodeURIComponent(`Sevenity ${pkg} (${invoiceNo})`)}`;

    // A real invoice layout: header, billed-to, itemized line, a bolded total,
    // and a clearly labeled payment block, so the amount and how to pay are
    // unmissable at a glance, not buried in a sentence.
    const invoiceHtml = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0D131B">
      <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="vertical-align:top">
            <div style="font-size:19px;font-weight:700">Sevenity Sports Group</div>
            <div style="font-size:13px;color:#6C7788;margin-top:2px">Athlete Development &amp; Advisory &middot; Atlanta, GA</div>
          </td>
          <td style="vertical-align:top;text-align:right">
            <div style="font-size:20px;font-weight:700;letter-spacing:.04em">INVOICE</div>
            <div style="font-size:13px;color:#6C7788;margin-top:2px">${esc(invoiceNo)}</div>
            <div style="font-size:13px;color:#6C7788">${esc(invoiceDate)}</div>
          </td>
        </tr>
      </table>
      <div style="border-top:2px solid #0D131B;margin-bottom:20px"></div>

      <table width="100%" style="border-collapse:collapse;margin-bottom:22px">
        <tr>
          <td style="vertical-align:top">
            <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6C7788;margin-bottom:6px">Billed to</div>
            <div style="font-size:15px;font-weight:600">${esc(name)}</div>
            <div style="font-size:14px;color:#3A4552">${esc(email)}</div>
          </td>
          <td style="vertical-align:top;text-align:right">
            ${when ? `<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6C7788;margin-bottom:6px">Session</div><div style="font-size:14px;font-weight:600">${esc(when)}</div>` : ''}
          </td>
        </tr>
      </table>

      <table width="100%" style="border-collapse:collapse;margin-bottom:4px">
        <tr>
          <td style="padding:0 0 8px;border-bottom:1px solid #E3E9F0;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6C7788">Description</td>
          <td style="padding:0 0 8px;border-bottom:1px solid #E3E9F0;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6C7788;text-align:right">Amount</td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #E3E9F0;font-size:15px;vertical-align:top">
            <div style="font-weight:600">${esc(pkg)}</div>
            ${athlete ? `<div style="font-size:13px;color:#6C7788;margin-top:2px">Athlete: ${esc(athlete)}</div>` : ''}
            ${notes ? `<div style="font-size:13px;color:#6C7788;margin-top:2px">${esc(notes)}</div>` : ''}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #E3E9F0;font-size:15px;text-align:right;vertical-align:top">${esc(price)}</td>
        </tr>
      </table>

      <table width="100%" style="border-collapse:collapse;margin-bottom:24px">
        <tr>
          <td style="padding:14px 0;text-align:right">
            <span style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6C7788;margin-right:10px">Amount due</span>
            <span style="font-size:24px;font-weight:700">${esc(price)}</span>
          </td>
        </tr>
      </table>

      <div style="background:#F5F7FA;border-radius:8px;padding:18px 20px;margin-bottom:24px">
        <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6C7788;margin-bottom:10px">How to pay</div>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:6px 0;font-size:14px;color:#6C7788;width:92px">Venmo</td><td style="padding:6px 0;font-size:14px"><a href="${esc(venmoUrl)}" style="color:#008CFF;font-weight:700;text-decoration:underline">@Chase-Clemmons-7</a> <span style="color:#6C7788;font-size:12px">(tap to pay)</span></td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#6C7788">Apple Pay</td><td style="padding:6px 0;font-size:14px"><a href="sms:+14706012934" style="color:#0D131B;font-weight:700;text-decoration:underline">470-601-2934</a> <span style="color:#6C7788;font-size:12px">(tap to open Messages, then send with Apple Cash)</span></td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#6C7788">Zelle</td><td style="padding:6px 0;font-size:14px"><b>chaseclemmons3@yahoo.com</b> <span style="color:#6C7788;font-size:12px">(send from your bank&rsquo;s app)</span></td></tr>
        </table>
      </div>

      <p style="margin:0 0 16px;font-size:14px;line-height:1.6">I'll confirm your ${esc(pkg.toLowerCase())} as soon as payment comes through. Any questions, just reply to this email or call/text me at 470-601-2934.</p>
      <p style="margin:0 0 20px;font-size:14px">Chase</p>
      <p style="margin:0;color:#6C7788;font-size:12px">Sevenity Sports Group &middot; Athlete Development &amp; Advisory &middot; Atlanta, GA</p>
    </div>`;

    const invoiceText = [
      'SEVENITY SPORTS GROUP | INVOICE',
      `${invoiceNo}  ·  ${invoiceDate}`, '',
      `Billed to: ${name} (${email})`,
      when ? `Session: ${when}` : '', '',
      `${pkg}${athlete ? ` (Athlete: ${athlete})` : ''}${notes ? `. ${notes}` : ''}`,
      `Amount: ${price}`, '',
      `AMOUNT DUE: ${price}`, '',
      'How to pay:',
      `  Venmo: @Chase-Clemmons-7 ${venmoUrl}`,
      '  Apple Pay: 470-601-2934 (send with Apple Cash in Messages)',
      "  Zelle: chaseclemmons3@yahoo.com (send from your bank's app)", '',
      `I'll confirm your ${pkg.toLowerCase()} as soon as payment comes through. Any questions, just reply to this email or call/text me at 470-601-2934.`, '',
      'Chase',
      'Sevenity Sports Group · Athlete Development & Advisory · Atlanta, GA',
    ].filter(Boolean).join('\n');

    invoicePayload = {
      from,
      to: [email],
      reply_to: to,
      subject: `Sevenity Sports Group: invoice for your ${pkg}`,
      html: invoiceHtml,
      text: invoiceText,
    };
  }

  // Kick off both requests in the same tick, they don't wait on each other.
  const internalSend = fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `Sevenity: ${interest} enquiry from ${name}`,
      html,
      text,
    }),
  });
  const invoiceSend = invoicePayload
    ? fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(invoicePayload),
      })
    : null;

  try {
    const r = await internalSend;
    if (!r.ok) {
      console.error('lead: resend rejected', r.status, (await r.text()).slice(0, 400));
      return res.status(502).json({ error: "That didn't send. Email chase@sevenitysportsgroup.com directly and we'll pick it up." });
    }
  } catch (err) {
    console.error('lead: resend threw', err && err.message);
    return res.status(502).json({ error: "That didn't send. Email chase@sevenitysportsgroup.com directly and we'll pick it up." });
  }

  // Best-effort invoice email straight to the submitter. Never fails the request,   // Sevenity already has the enquiry either way. It was already in flight above,
  // so this just waits on the response that's likely already back.
  if (invoiceSend) {
    try {
      const invR = await invoiceSend;
      if (!invR.ok) {
        console.error('lead: invoice email rejected', invR.status, (await invR.text()).slice(0, 400));
      }
    } catch (err) {
      console.error('lead: invoice email threw', err && err.message);
    }
  }

  return res.status(200).json({ ok: true });
};
