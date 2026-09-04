/**
 * Sevenity lead intake.
 *
 * Receives a contact or scan-follow-up submission and emails it to Chase.
 * Nothing is stored anywhere — the email is the record and the mailbox is the CRM.
 * See ops/SEVENITY-DATA-LAYER-DECISION.md for why there is no database here.
 *
 * Reply-To is set to the athlete, so Chase answers by hitting reply.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAX_BODY = 16 * 1024;

// Best-effort throttle. Serverless is stateless, so this only holds within a warm
// instance — it blunts casual abuse, it is not a security control. The honeypot and
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
  const to = process.env.LEAD_TO;
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
  if (throttled(ip)) return res.status(429).json({ error: 'That went through already — give it a minute before sending another.' });

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const handle = clean(body.handle, 80);
  const phone = clean(body.phone, 40);
  const interest = clean(body.interest, 60) || 'General';
  const message = clean(body.message, 4000);
  const scan = body.scan && typeof body.scan === 'object' ? body.scan : null;

  if (!name) return res.status(400).json({ error: 'Add your name so Chase knows who he is replying to.' });
  if (!looksLikeEmail(email)) return res.status(400).json({ error: 'That email address does not look right — check it and try again.' });

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
      ${row('Email', email)}${row('Phone', phone)}${row('Instagram', handle)}${row('Interested in', interest)}
    </table>
    ${message ? `<p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6C7788">Message</p><p style="margin:0 0 18px;white-space:pre-wrap">${esc(message)}</p>` : ''}
    ${scanRows ? `<p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6C7788">Their Brand Intelligence scan</p><table style="border-collapse:collapse;margin-bottom:18px">${scanRows}</table>` : ''}
    <p style="margin:0;color:#6C7788;font-size:13px">Reply to this email and it goes straight back to ${esc(name)}.</p>
  </div>`;

  const text = [
    `New enquiry — ${interest}`, '', `Name: ${name}`, `Email: ${email}`,
    phone ? `Phone: ${phone}` : '', handle ? `Instagram: ${handle}` : '', '',
    message ? `Message:\n${message}` : '',
    scan ? `\nScan:\n${Object.entries(scan).slice(0, 20).map(([k, v]) => `  ${clean(k, 40)}: ${clean(v, 120)}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  try {
    const r = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Sevenity — ${interest} enquiry from ${name}`,
        html,
        text,
      }),
    });
    if (!r.ok) {
      console.error('lead: resend rejected', r.status, (await r.text()).slice(0, 400));
      return res.status(502).json({ error: "That didn't send. Email chase@sevenitysportsgroup.com directly and we'll pick it up." });
    }
  } catch (err) {
    console.error('lead: resend threw', err && err.message);
    return res.status(502).json({ error: "That didn't send. Email chase@sevenitysportsgroup.com directly and we'll pick it up." });
  }

  return res.status(200).json({ ok: true });
};
