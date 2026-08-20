const { getSql } = require('./_db');
const { requireCaptain } = require('./_auth');

function cleanName(value='') {
  return String(value).trim().slice(0, 80);
}

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const user = await requireCaptain(req, res);
      if (!user) return;
      const rows = await sql`SELECT state->'appAccess' AS access FROM team_state WHERE id = 1 LIMIT 1`;
      return res.status(200).json({ access: (rows[0] && rows[0].access) || {} });
    }

    if (req.method === 'POST') {
      const playerName = cleanName(req.body && req.body.playerName);
      const status = req.body && req.body.status === 'installed' ? 'installed' : 'browser';
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
        ...(status === 'installed' ? { installedAt: current.installedAt || now } : {})
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
      return res.status(200).json({ ok: true, status });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const status = error.code === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message || 'Player access request failed' });
  }
};