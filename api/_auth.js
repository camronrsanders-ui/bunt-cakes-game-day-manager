const crypto = require('crypto');
const { getSql } = require('./_db');

const DEFAULT_TEAM_SLUG = 'those-dirty-bunt-cakes';

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

function hashPlayerToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function playerCookieName(teamId) {
  const id = String(teamId || '').replace(/-/g, '');
  return `bc_player_${id}`;
}

function readPlayerCookie(req, teamId) {
  const name = playerCookieName(teamId);
  const cookieHeader = String(req && req.headers && req.headers.cookie || '');
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === name && value) return value;
  }
  return '';
}

function setPlayerCookie(res, teamId, rawDeviceToken) {
  const cookieName = playerCookieName(teamId);
  const value = encodeURIComponent(String(rawDeviceToken || ''));
  res.setHeader('Set-Cookie', `${cookieName}=${value}; Path=/api/team-state; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);
}

async function resolveAuthenticatedPlayer(req, teamRow, state) {
  if (!teamRow || !teamRow.id) return null;
  const rawToken = readPlayerCookie(req, teamRow.id);
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return null;
  const tokenHash = hashPlayerToken(rawToken);
  const sql = getSql();
  const rows = await sql`
    SELECT player_id
    FROM player_device_sessions
    WHERE token_hash = ${tokenHash}
      AND team_id = ${teamRow.id}
      AND revoked_at IS NULL
      AND expires_at > now()
    LIMIT 1
  `;
  const session = rows[0];
  if (!session) return null;
  const player = Array.isArray(state && state.players)
    ? state.players.find(p => p && String(p.id || '') === String(session.player_id || ''))
    : null;
  if (!player) return null;
  return {
    playerId: String(player.id || ''),
    playerName: String(player.name || ''),
    fullName: String(player.fullName || '')
  };
}

function normalizeTeamSlug(value) {
  const raw = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{2,63}$/.test(raw) ? raw : '';
}

function requestedTeamSlug(req) {
  const query = req && req.query || {};
  for (const key of ['team', 'teamSlug', 'slug']) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      return normalizeTeamSlug(query[key]);
    }
  }
  const headers = req && req.headers || {};
  if (Object.prototype.hasOwnProperty.call(headers, 'x-team-slug')) {
    return normalizeTeamSlug(headers['x-team-slug']);
  }
  return DEFAULT_TEAM_SLUG;
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

async function getTeam(sql, slug = DEFAULT_TEAM_SLUG) {
  const safe = normalizeTeamSlug(slug);
  if (!safe) return null;
  const rows = await sql`
    SELECT t.id, t.slug, t.active, t.plan, t.billing_status,
           ts.state, ts.updated_at
    FROM teams t
    LEFT JOIN team_states ts ON ts.team_id = t.id
    WHERE t.slug = ${safe} AND t.active = true
    LIMIT 1
  `;
  return rows[0] || null;
}

async function getCaptainTeam(req, slug) {
  const user = await getCaptain(req);
  if (!user) return null;
  const sql = getSql();
  const safe = slug === undefined ? requestedTeamSlug(req) : normalizeTeamSlug(slug);
  if (!safe) return null;
  const rows = await sql`
    SELECT t.id AS team_id, t.slug, t.plan, t.billing_status,
           m.role, u.id, u.email, u.display_name
    FROM captain_team_memberships m
    JOIN teams t ON t.id = m.team_id
    JOIN captain_users u ON u.id = m.captain_user_id
    WHERE m.captain_user_id = ${user.id}
      AND m.active = true
      AND t.active = true
      AND t.slug = ${safe}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function listCaptainTeams(req) {
  const user = await getCaptain(req);
  if (!user) return [];
  const sql = getSql();
  return sql`
    SELECT t.id, t.slug, t.plan, t.billing_status, m.role,
           COALESCE(NULLIF(ts.state->'team'->>'name',''), NULLIF(ts.state->'team'->>'shortName',''), 'Untitled Team') AS name
    FROM captain_team_memberships m
    JOIN teams t ON t.id = m.team_id
    LEFT JOIN team_states ts ON ts.team_id = t.id
    WHERE m.captain_user_id = ${user.id}
      AND m.active = true
      AND t.active = true
    ORDER BY t.created_at, t.slug
  `;
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

function requireTeamCaptain(req, res, slug) {
  const requested = slug === undefined ? requestedTeamSlug(req) : slug;
  return getCaptainTeam(req, requested).then(user => {
    if (!user) {
      res.status(403).json({ error: 'You do not have captain access to this team' });
      return null;
    }
    return user;
  });
}

module.exports = {
  DEFAULT_TEAM_SLUG,
  parseCookies,
  hashToken,
  hashPlayerToken,
  playerCookieName,
  readPlayerCookie,
  setPlayerCookie,
  resolveAuthenticatedPlayer,
  normalizeTeamSlug,
  requestedTeamSlug,
  getCaptain,
  getTeam,
  getCaptainTeam,
  listCaptainTeams,
  requireCaptain,
  requireTeamCaptain
};
