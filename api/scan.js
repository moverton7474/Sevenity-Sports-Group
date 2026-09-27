/**
 * Brand Intelligence scan report.
 *
 * The engine on /brand-intelligence shows a visitor only the headline tiles and
 * their single top sponsor category. Every real scan (not "Load example") posts
 * the full result here: inputs, tiles, the audience read, the whole ranked
 * category list and the "flags before you sign". It is emailed to Sevenity and
 * stored nowhere, same as /api/lead.
 *
 * There is no visitor email to reply to, so the handle and inputs are the lead.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TO = 'chase@sevenitysportsgroup.com';
const MAX_BODY = 32 * 1024;

// Best-effort throttle, as in lead.js: holds only within a warm instance.
const seen = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function throttled(ip) {
  const now = Date.now();
  const hits = (seen.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 500) for (const [k, v] of seen) if (!v.some((t) => now - t < WINDOW_MS)) seen.delete(k);
  return hits.length > MAX_PER_WINDOW;
}

const clean = (v, max = 300) => String(v == null ? '' : v).replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, max);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_FROM;
  if (!apiKey || !from) {
    console.error('scan: missing RESEND_API_KEY / LEAD_FROM');
    return res.status(500).json({ error: 'Not configured.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(413).json({ error: 'Too large.' });
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Bad request.' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Bad request.' });

  // Dwell time: a person needs a few seconds to fill the form; bots post instantly.
  const elapsed = Number(body.elapsed);
  if (Number.isFinite(elapsed) && elapsed < 2500) return res.status(200).json({ ok: true });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (throttled(ip)) return res.status(429).json({ error: 'Slow down.' });

  const inp = body.inputs && typeof body.inputs === 'object' ? body.inputs : {};
  const m = body.metrics && typeof body.metrics === 'object' ? body.metrics : {};
  const handle = clean(inp.handle, 80);
  const followers = clean(inp.followers, 20);
  if (!followers) return res.status(400).json({ error: 'Bad request.' });

  const inputs = [
    ['Handle', handle], ['Followers', followers], ['Level', clean(inp.level, 40)],
    ['Avg likes', clean(inp.likes, 20)], ['Avg comments', clean(inp.comments, 20)],
    ['Avg sends', clean(inp.sends, 20)], ['Home market', clean(inp.market, 120)],
    ['Pillars', clean(inp.pillars, 200)], ['Other content', clean(inp.otherPillar, 120)],
    ['Own merch line', clean(inp.ownsMerch, 5)],
  ];
  const metrics = [
    ['Engagement rate', clean(m.engagement, 40)], ['Sends per comment', clean(m.sendRatio, 60)],
    ['Audience type', clean(m.audience, 60)], ['Indicative rate / Reel', clean(m.rate, 60)],
  ];
  const read = clean(body.read, 800);
  const ranked = list(body.ranked, 30).map((r) => ({
    name: clean(r && r.name, 120), score: clean(r && r.score, 5),
    scope: clean(r && r.scope, 80), ex: clean(r && r.ex, 200), why: clean(r && r.why, 400),
  })).filter((r) => r.name);
  const flags = list(body.flags, 10).map((f) => ({
    title: clean(f && f.title, 120), text: clean(f && f.text, 600),
  })).filter((f) => f.title);

  const label = 'padding:4px 14px 4px 0;color:#6C7788;vertical-align:top';
  const rows = (pairs) => pairs.filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="${label}">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join('');
  const h3 = (t) => `<p style="margin:22px 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6C7788">${t}</p>`;

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#0D131B;line-height:1.6;max-width:640px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#14559E">Brand Intelligence scan</p>
    <h2 style="margin:0 0 14px;font-size:20px">${esc(handle || 'No handle given')} &middot; ${esc(followers)} followers</h2>
    <table style="border-collapse:collapse">${rows(metrics)}</table>
    ${h3('What they entered')}<table style="border-collapse:collapse">${rows(inputs)}</table>
    ${read ? `${h3('The read')}<p style="margin:0">${esc(read)}</p>` : ''}
    ${h3(`Full ranked sponsor categories (${ranked.length})`)}
    ${ranked.length ? `<ol style="margin:0;padding-left:20px">${ranked.map((r, i) => `<li style="margin:0 0 10px">
      <b>${esc(r.name)}</b> &middot; ${esc(r.score)}${r.scope ? ` &middot; <span style="color:#6C7788">${esc(r.scope)}</span>` : ''}${i === 0 ? ' <span style="color:#14559E">(shown to the athlete)</span>' : ''}
      ${r.why ? `<br><span style="font-size:14px">${esc(r.why)}</span>` : ''}
      ${r.ex ? `<br><span style="font-size:13px;color:#6C7788">${esc(r.ex)}</span>` : ''}</li>`).join('')}</ol>`
      : '<p style="margin:0">No category matched their pillars.</p>'}
    ${flags.length ? `${h3('Flags before you sign')}${flags.map((f) => `<p style="margin:0 0 10px"><b>${esc(f.title)}</b><br><span style="font-size:14px">${esc(f.text)}</span></p>`).join('')}` : ''}
    <p style="margin:22px 0 0;color:#6C7788;font-size:13px">The athlete saw only the four tiles and the #1 category.</p>
  </div>`;

  const text = [
    `BRAND INTELLIGENCE SCAN: ${handle || 'no handle'} (${followers} followers)`, '',
    ...metrics.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), '',
    'WHAT THEY ENTERED', ...inputs.filter(([, v]) => v).map(([k, v]) => `  ${k}: ${v}`), '',
    read ? `THE READ\n${read}\n` : '',
    'FULL RANKED SPONSOR CATEGORIES',
    ...(ranked.length ? ranked.map((r, i) => `${i + 1}. ${r.name} (${r.score})${r.scope ? `, ${r.scope}` : ''}${r.ex ? `: ${r.ex}` : ''}`) : ['  none matched']),
    flags.length ? `\nFLAGS BEFORE YOU SIGN\n${flags.map((f) => `- ${f.title}: ${f.text}`).join('\n')}` : '',
    '', 'The athlete saw only the four tiles and the #1 category.',
  ].filter((l) => l !== null).join('\n');

  try {
    const r = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [TO],
        subject: `Brand Intelligence scan: ${handle || 'no handle'} (${followers} followers)`,
        html,
        text,
      }),
    });
    if (!r.ok) {
      console.error('scan: resend rejected', r.status, (await r.text()).slice(0, 400));
      return res.status(502).json({ error: 'Not sent.' });
    }
  } catch (err) {
    console.error('scan: resend threw', err && err.message);
    return res.status(502).json({ error: 'Not sent.' });
  }
  return res.status(200).json({ ok: true });
};
