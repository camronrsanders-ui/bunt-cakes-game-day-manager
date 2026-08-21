const crypto = require('crypto');
const { getSql } = require('./_db');
const { hashToken } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const sql = getSql();
    const rows = await sql`SELECT id,email,display_name,password_hash,password_salt,active FROM captain_users WHERE lower(email)=lower(${email}) LIMIT 1`;
    const user = rows[0];
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid login' });
    const derived = crypto.pbkdf2Sync(String(password), user.password_salt, 120000, 32, 'sha256').toString('hex');
    const ok = crypto.timingSafeEqual(Buffer.from(derived,'hex'), Buffer.from(user.password_hash,'hex'));
    if (!ok) return res.status(401).json({ error: 'Invalid login' });
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    await sql`DELETE FROM captain_sessions WHERE expires_at <= now()`;
    await sql`INSERT INTO captain_sessions (token_hash,captain_user_id,expires_at) VALUES (${tokenHash},${user.id},now()+interval '7 days')`;

    // A successful captain login also proves that captain can access the team app.
    // Match the captain display name to the roster's preferred/display name so
    // Cam/Camron and CJ are tracked in the same appAccess object as every player.
    const playerRows = await sql`
      SELECT p->>'name' AS name
      FROM team_state ts
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts.state->'players','[]'::jsonb)) p
      WHERE ts.id=1
        AND (
          lower(COALESCE(p->>'name',''))=lower(${user.display_name})
          OR lower(COALESCE(p->>'fullName',''))=lower(${user.display_name})
        )
      LIMIT 1
    `;
    const playerName = playerRows[0] && playerRows[0].name;
    if (playerName) {
      const currentRows = await sql`SELECT state->'appAccess'->${playerName} AS access FROM team_state WHERE id=1 LIMIT 1`;
      const current = (currentRows[0] && currentRows[0].access) || {};
      const now = new Date().toISOString();
      const next = {
        ...current,
        playerName,
        browserSeenAt: current.browserSeenAt || now,
        lastSeenAt: now,
        captainLoginAt: now,
        accessSource: 'captain-login'
      };
      const payload = JSON.stringify(next);
      await sql`
        UPDATE team_state
        SET state=jsonb_set(
          state,
          '{appAccess}',
          COALESCE(state->'appAccess','{}'::jsonb) || jsonb_build_object(${playerName},${payload}::jsonb),
          true
        ),updated_at=now()
        WHERE id=1
      `;
    }

    res.setHeader('Set-Cookie', `bc_captain=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
    return res.status(200).json({ ok:true, user:{ email:user.email, displayName:user.display_name } });
  } catch (error) {
    const status = error.code === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message || 'Login failed' });
  }
};
