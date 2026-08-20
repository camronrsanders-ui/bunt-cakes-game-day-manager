const { getSql } = require('./_db');
const { ensurePushConfig, sendPush } = require('./_push');

function easternParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
  }).formatToParts(date);
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${obj.year}-${obj.month}-${obj.day}`, weekday: obj.weekday };
}

function plusDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + days));
  return x.toISOString().slice(0, 10);
}

function time12(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const ua = String(req.headers['user-agent'] || '');
    const auth = String(req.headers.authorization || '');
    if (process.env.CRON_SECRET) {
      if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
    } else if (ua !== 'vercel-cron/1.0') {
      return res.status(401).json({ error: 'Cron request required' });
    }

    const eastern = easternParts();
    if (eastern.weekday !== 'Thu') return res.status(200).json({ ok: true, skipped: 'Not Thursday in Boston' });
    const gameDate = plusDays(eastern.date, 3);
    const sql = getSql();
    const rows = await sql`SELECT state FROM team_state WHERE id = 1 LIMIT 1`;
    const state = (rows[0] && rows[0].state) || {};
    const games = (state.events || []).filter(e => e && e.type === 'Game' && e.date === gameDate).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    if (!games.length) return res.status(200).json({ ok: true, gameDate, skipped: 'No Sunday game scheduled' });
    if (state._pushReminderLog && state._pushReminderLog[gameDate] && state._pushReminderLog[gameDate].sentAt) {
      return res.status(200).json({ ok: true, gameDate, skipped: 'Reminder already sent' });
    }

    const subscriptions = state._pushSubscriptions || {};
    const roster = new Set((state.players || []).map(p => p && p.name).filter(Boolean));
    const config = await ensurePushConfig(sql);
    const times = games.map(g => time12(g.time)).filter(Boolean);
    const body = `Will you be at Sunday’s game${games.length > 1 ? 's' : ''}${times.length ? ` at ${times.join(' & ')}` : ''}? Tap to answer Yes, No, or Not sure.`;
    let sent = 0, failed = 0;
    const cleaned = { ...subscriptions };

    for (const [playerName, entries] of Object.entries(subscriptions)) {
      if (!roster.has(playerName)) continue;
      const list = Array.isArray(entries) ? entries : [];
      const keep = [];
      for (const entry of list) {
        if (!entry || !entry.subscription) continue;
        try {
          await sendPush(config, entry.subscription, {
            title: 'Bunt Cakes • Sunday availability',
            body,
            url: `/team?player=${encodeURIComponent(playerName)}&availability=${gameDate}`,
            tag: `bunt-attendance-${gameDate}`,
            gameDate
          });
          keep.push(entry);
          sent++;
        } catch (error) {
          const code = Number(error && error.statusCode);
          if (code !== 404 && code !== 410) keep.push(entry);
          failed++;
        }
      }
      cleaned[playerName] = keep;
    }

    const log = {
      sentAt: new Date().toISOString(),
      sent,
      failed,
      gameCount: games.length
    };
    const cleanedPayload = JSON.stringify(cleaned);
    const logPayload = JSON.stringify(log);
    await sql`
      UPDATE team_state
      SET state = jsonb_set(
        jsonb_set(state, '{_pushSubscriptions}', ${cleanedPayload}::jsonb, true),
        '{_pushReminderLog}',
        COALESCE(state->'_pushReminderLog', '{}'::jsonb) || jsonb_build_object(${gameDate}, ${logPayload}::jsonb),
        true
      ), updated_at = now()
      WHERE id = 1
    `;
    return res.status(200).json({ ok: true, gameDate, sent, failed, games: games.length });
  } catch (error) {
    const status = error.code === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message || 'Attendance reminder failed' });
  }
};
