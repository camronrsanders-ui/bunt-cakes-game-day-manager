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

    const teams = await sql`
      SELECT t.id,t.slug,m.role,
             COALESCE(NULLIF(ts.state->'team'->>'name',''),NULLIF(ts.state->'team'->>'shortName',''),'Untitled Team') AS name
      FROM captain_team_memberships m
      JOIN teams t ON t.id=m.team_id
      LEFT JOIN team_states ts ON ts.team_id=t.id
      WHERE m.captain_user_id=${user.id} AND m.active=true AND t.active=true
      ORDER BY t.created_at,t.slug
    `;

    // A successful captain login also counts as access for any roster identity that
    // matches this captain inside a team they are actually allowed to manage.
    const playerRows = await sql`
      SELECT ts.team_id,p->>'name' AS name
      FROM captain_team_memberships m
      JOIN team_states ts ON ts.team_id=m.team_id
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts.state->'players','[]'::jsonb)) p
      WHERE m.captain_user_id=${user.id}
        AND m.active=true
        AND (
          lower(COALESCE(p->>'name',''))=lower(${user.display_name})
          OR lower(COALESCE(p->>'fullName',''))=lower(${user.display_name})
        )
    `;
    for (const row of playerRows) {
      const currentRows = await sql`SELECT state->'appAccess'->(${row.name}::text) AS access FROM team_states WHERE team_id=${row.team_id} LIMIT 1`;
      const current = (currentRows[0] && currentRows[0].access) || {};
      const now = new Date().toISOString();
      const next = {
        ...current,
        playerName: row.name,
        browserSeenAt: current.browserSeenAt || now,
        lastSeenAt: now,
        captainLoginAt: now,
        accessSource: 'captain-login'
      };
      const payload = JSON.stringify(next);
      await sql`
        UPDATE team_states
        SET state=jsonb_set(
          state,
          '{appAccess}',
          COALESCE(state->'appAccess','{}'::jsonb) || jsonb_build_object(${row.name}::text,${payload}::jsonb),
          true
        ),updated_at=now()
        WHERE team_id=${row.team_id}
      `;
    }

    res.setHeader('Set-Cookie', `bc_captain=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
    return res.status(200).json({
      ok:true,
      user:{ email:user.email, displayName:user.display_name },
      teams:teams.map(t=>({slug:t.slug,name:t.name,role:t.role}))
    });
  } catch (error) {
    const status = error.code === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message || 'Login failed' });
  }
};
