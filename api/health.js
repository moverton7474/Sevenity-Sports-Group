/**
 * Watchdog for the lead path.
 *
 * /api/lead is the only route between a visitor and revenue. If it breaks the
 * failure is SILENT — from Chase's side a broken form is indistinguishable from
 * nobody being interested, so he would stop trusting the site rather than report
 * a bug. This checks the things that actually break, on a schedule, and emails
 * only when something is wrong.
 *
 * Checked:
 *   1. all three lead env vars are present
 *   2. the Resend key still authenticates
 *   3. the domain in LEAD_FROM is still verified for sending
 *
 * Public GET returns only {status}. Supplying CRON_SECRET returns detail and,
 * when degraded, sends the alert. Vercel Cron attaches that secret automatically.
 */

const RESEND_DOMAINS = 'https://api.resend.com/domains';
const RESEND_SEND = 'https://api.resend.com/emails';

const senderDomain = (from) => {
  const m = String(from || '').match(/<([^>]+)>/);
  const addr = m ? m[1] : String(from || '');
  return addr.split('@')[1] || '';
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Use GET.' });
  }

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const trusted = Boolean(secret) && auth === `Bearer ${secret}`;

  const failures = [];
  const checks = {};

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO;
  const from = process.env.LEAD_FROM;

  // 1. configuration
  const missing = [
    !apiKey && 'RESEND_API_KEY',
    !to && 'LEAD_TO',
    !from && 'LEAD_FROM',
  ].filter(Boolean);
  checks.env = missing.length ? `missing: ${missing.join(', ')}` : 'ok';
  if (missing.length) failures.push(`Lead form config incomplete — missing ${missing.join(', ')}. Submissions are failing right now.`);

  // 2 + 3. the mail path
  if (apiKey) {
    try {
      const r = await fetch(RESEND_DOMAINS, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!r.ok) {
        checks.resendAuth = `http ${r.status}`;
        failures.push(`Resend rejected the API key (HTTP ${r.status}). Every lead submission is bouncing.`);
      } else {
        checks.resendAuth = 'ok';
        const wanted = senderDomain(from);
        const rows = (await r.json()).data || [];
        const hit = rows.find((d) => d.name === wanted);
        if (!hit) {
          checks.senderDomain = `${wanted} not found in Resend`;
          failures.push(`The sending domain ${wanted} is no longer present in Resend. Lead email cannot be sent.`);
        } else if (hit.status !== 'verified') {
          checks.senderDomain = `${wanted} is ${hit.status}`;
          failures.push(`The sending domain ${wanted} is "${hit.status}" rather than verified — most likely its DNS records were changed.`);
        } else {
          checks.senderDomain = `${wanted} verified`;
        }
      }
    } catch (err) {
      checks.resendAuth = 'unreachable';
      failures.push(`Could not reach Resend: ${err && err.message}.`);
    }
  }

  const healthy = failures.length === 0;

  // alert, but only for a trusted (scheduled) call
  if (trusted && !healthy && apiKey && from) {
    const alertTo = process.env.ALERT_TO || to;
    const lines = failures.map((f) => `• ${f}`).join('\n');
    try {
      await fetch(RESEND_SEND, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [alertTo],
          subject: 'Sevenity — the lead form is not working',
          text:
            `The contact form on sevenitysportsgroup.com is currently failing.\n\n${lines}\n\n` +
            `Until this is fixed, anyone who fills in the form gets an error and Chase receives nothing.\n\n` +
            `Checked at ${new Date().toISOString()}\nDetail: https://sevenitysportsgroup.com/api/health`,
        }),
      });
      checks.alertSent = true;
    } catch (err) {
      checks.alertSent = false;
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  const status = healthy ? 200 : 503;
  return res
    .status(status)
    .json(trusted ? { status: healthy ? 'ok' : 'degraded', checks, failures } : { status: healthy ? 'ok' : 'degraded' });
};
