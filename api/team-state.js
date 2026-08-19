const { getSql } = require('./_db');
const { requireCaptain } = require('./_auth');

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();
    if (req.method === 'GET') {
      const rows = await sql`SELECT state, updated_at FROM team_state WHERE id = 1 LIMIT 1`;
      const row = rows[0] || { state: {}, updated_at: null };
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ state: row.state || {}, updatedAt: row.updated_at });
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
      const rows = await sql`UPDATE team_state SET state = ${payload}, updated_at = now() WHERE id = 1 RETURNING updated_at`;
      return res.status(200).json({ ok: true, updatedAt: rows[0] && rows[0].updated_at, updatedBy: user.display_name });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const status = error.code === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message || 'Shared state request failed' });
  }
};
