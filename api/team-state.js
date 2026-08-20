const { getSql } = require('./_db');
const { requireCaptain } = require('./_auth');

function publicState(value) {
  const state = value && typeof value === 'object' ? { ...value } : {};
  delete state._pushConfig;
  delete state._pushSubscriptions;
  delete state._pushReminderLog;
  return state;
}

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();
    if (req.method === 'GET') {
      const rows = await sql`SELECT state, updated_at FROM team_state WHERE id = 1 LIMIT 1`;
      const row = rows[0] || { state: {}, updated_at: null };
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ state: publicState(row.state), updatedAt: row.updated_at });
    }

    if (req.method === 'POST') {
      const playerName = String(req.body && req.body.playerName || '').trim().slice(0, 80);
      const accessStatus = req.body && req.body.accessStatus === 'installed' ? 'installed' : 'browser';
      if (!playerName) return res.status(400).json({ error: 'Player name is required' });

      const rows = await sql`SELECT state FROM team_state WHERE id = 1 LIMIT 1`;
      const state = (rows[0] && rows[0].state) || {};
      const player = (state.players || []).find(p => p && p.name === playerName);
      if (!player) return res.status(404).json({ error: 'Player was not found on the roster' });

      const now = new Date().toISOString();
      const current = (state.appAccess && state.appAccess[playerName]) || {};
      const next = {
        ...current,
        playerName,
        browserSeenAt: current.browserSeenAt || now,
        lastSeenAt: now,
        ...(accessStatus === 'installed' ? { installedAt: current.installedAt || now } : {})
      };
      const payload = JSON.stringify(next);
      await sql`
        UPDATE team_state
        SET state = jsonb_set(
          state,
          '{appAccess}',
          COALESCE(state->'appAccess', '{}'::jsonb) || jsonb_build_object(${playerName}, ${payload}::jsonb),
          true
        ),
        updated_at = now()
        WHERE id = 1
      `;
      return res.status(200).json({ ok: true, accessStatus });
    }

    if (req.method === 'PUT') {
      const user = await requireCaptain(req, res);
      if (!user) return;
      const next = req.body && req.body.state;
      if (!next || typeof next !== 'object' || Array.isArray(next)) {
        return res.status(400).json({ error: 'A valid state object is required' });
      }
      const payload = JSON.stringify(next);
      if (payload.length > 1000000) return res.status(413).json({ error: 'Team state is too large' });

      // Player check-ins, Sunday availability, and private push data can change while
      // a captain has the manager open. Preserve the newest server-side versions.
      const rows = await sql`
        UPDATE team_state
        SET state = ${payload}::jsonb || jsonb_build_object(
          'appAccess', COALESCE(state->'appAccess', '{}'::jsonb),
          'availability', COALESCE(state->'availability', '{}'::jsonb),
          '_pushConfig', COALESCE(state->'_pushConfig', '{}'::jsonb),
          '_pushSubscriptions', COALESCE(state->'_pushSubscriptions', '{}'::jsonb),
          '_pushReminderLog', COALESCE(state->'_pushReminderLog', '{}'::jsonb)
        ),
        updated_at = now()
        WHERE id = 1
        RETURNING updated_at
      `;
      return res.status(200).json({ ok: true, updatedAt: rows[0] && rows[0].updated_at, updatedBy: user.display_name });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const status = error.code === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message || 'Shared state request failed' });
  }
};
