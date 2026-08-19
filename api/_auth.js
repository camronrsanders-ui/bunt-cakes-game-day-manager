const crypto = require('crypto');
const { getSql } = require('./_db');

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0,i).trim()] = decodeURIComponent(part.slice(i+1).trim());
  });
  return out;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function getCaptain(req) {
  const token = parseCookies(req).bc_captain;
  if (!token) return null;
  const sql = getSql();
  const tokenHash = hashToken(token);
  const rows = await sql`
    SELECT u.id, u.email, u.display_name
    FROM captain_sessions s
    JOIN captain_users u ON u.id = s.captain_user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > now()
      AND u.active = true
    LIMIT 1
  `;
  return rows[0] || null;
}

function requireCaptain(req, res) {
  return getCaptain(req).then(user => {
    if (!user) {
      res.status(401).json({ error: 'Captain login required' });
      return null;
    }
    return user;
  });
}

module.exports = { parseCookies, hashToken, getCaptain, requireCaptain };
