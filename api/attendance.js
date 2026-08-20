const { getSql } = require('./_db');
const { ensurePushConfig } = require('./_push');

const ALLOWED = new Set(['yes', 'no', 'not_sure']);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const sql = getSql();
    const rows = await sql`SELECT state FROM team_state WHERE id = 1 LIMIT 1`;
    const state = (rows[0] && rows[0].state) || {};
    const playerName = String(req.body && req.body.playerName || '').trim().slice(0, 80);
    const player = (state.players || []).find(p => p && p.name === playerName);
    if (!player) return res.status(404).json({ error: 'Choose your name from the roster first' });

    const action = String(req.body && req.body.action || 'response');
    if (action === 'subscribe') {
      const sub = req.body && req.body.subscription;
      if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return res.status(400).json({ error: 'A valid push subscription is required' });
      }
      await ensurePushConfig(sql);
      const existing = state._pushSubscriptions && state._pushSubscriptions[playerName];
      let list = Array.isArray(existing) ? existing : [];
      list = list.filter(x => x && x.subscription && x.subscription.endpoint !== sub.endpoint);
      list.push({ subscription: sub, updatedAt: new Date().toISOString() });
      list = list.slice(-3);
      const payload = JSON.stringify(list);
      await sql`
        UPDATE team_state
        SET state = jsonb_set(
          state,
          '{_pushSubscriptions}',
          COALESCE(state->'_pushSubscriptions', '{}'::jsonb) || jsonb_build_object(${playerName}, ${payload}::jsonb),
          true
        ), updated_at = now()
        WHERE id = 1
      `;
      return res.status(200).json({ ok: true, remindersEnabled: true });
    }

    const gameDate = String(req.body && req.body.gameDate || '');
    const status = String(req.body && req.body.status || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) return res.status(400).json({ error: 'A valid Sunday game date is required' });
    if (!ALLOWED.has(status)) return res.status(400).json({ error: 'Answer Yes, No, or Not sure' });
    const games = (state.events || []).filter(e => e && e.type === 'Game' && e.date === gameDate);
    if (!games.length) return res.status(400).json({ error: 'No game is scheduled for that date' });

    const answer = { status, respondedAt: new Date().toISOString() };
    const payload = JSON.stringify(answer);
    await sql`
      UPDATE team_state
      SET state = jsonb_set(
        state,
        '{availability}',
        COALESCE(state->'availability', '{}'::jsonb) || jsonb_build_object(
          ${gameDate},
          COALESCE(state->'availability'->${gameDate}, '{}'::jsonb) || jsonb_build_object(${playerName}, ${payload}::jsonb)
        ),
        true
      ), updated_at = now()
      WHERE id = 1
    `;
    return res.status(200).json({ ok: true, gameDate, playerName, status, respondedAt: answer.respondedAt });
  } catch (error) {
    const status = error.code === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message || 'Attendance update failed' });
  }
};
