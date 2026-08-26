const crypto = require('crypto');
const { getSql } = require('./_db');
const {
  hashToken,
  normalizeTeamSlug,
  requestedTeamSlug,
  getCaptain,
  requireTeamCaptain
} = require('./_auth');

const ATTENDANCE = new Set(['yes','no','not_sure']);

function safeTimeZone(value){
  const zone=String(value||'').trim();
  try{new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(new Date());return zone||'UTC';}catch(_){return'UTC';}
}

function blankState(timeZone='UTC') {
  const innings = {};
  for (let i=1;i<=7;i++) innings[i] = {};
  return {
    team:{
      name:'',shortName:'',organization:'',sport:'Kickball',location:'',
      primaryColor:'#15803d',accentColor:'#f7fff8',logoDataUrl:'',logoUrl:'',
      chatUrl:'',announcement:'',arrivalMinutes:60,secondReminderMinutes:30,
      leagueAppsEnabled:false,timeZone:safeTimeZone(timeZone)
    },
    playerVisibility:{schedule:true,lineup:true,pods:true,kicking:true,officials:true,resources:true,attendance:true},
    resources:[],players:[],innings,pods:[],kickingOrder:[],score:{team:0,opponent:0},
    counts:{balls:0,fouls:0,outs:0},gameInning:1,fieldInning:1,half:'Team kicking',
    events:[],season:{name:'',division:'',color:'#15803d'},lastLeagueSync:null,appAccess:{},availability:{},captainPlayerLinks:{}
  };
}

function passwordParts(password){
  const salt=crypto.randomBytes(16).toString('hex');
  const hash=crypto.pbkdf2Sync(String(password),salt,120000,32,'sha256').toString('hex');
  return {salt,hash};
}

function passwordMatches(password,user){
  try{
    const derived=crypto.pbkdf2Sync(String(password),user.password_salt,120000,32,'sha256').toString('hex');
    const a=Buffer.from(derived,'hex'),b=Buffer.from(String(user.password_hash||''),'hex');
    return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);
  }catch(_){return false;}
}

function setSessionCookie(res,token){
  res.setHeader('Set-Cookie',`bc_captain=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
}

function linkedPlayerName(state,user){
  const players=Array.isArray(state&&state.players)?state.players:[];
  const email=String(user&&user.email||'').trim().toLowerCase();
  const explicit=state&&state.captainPlayerLinks&&state.captainPlayerLinks[email];
  if(explicit&&players.some(p=>p&&p.name===explicit))return explicit;
  const display=String(user&&user.display_name||'').trim().toLowerCase();
  const byName=players.find(p=>String(p&&p.name||'').trim().toLowerCase()===display);
  if(byName)return byName.name;
  const byFull=players.find(p=>String(p&&p.fullName||'').trim().toLowerCase()===display);
  return byFull&&byFull.name||'';
}

async function createWorkspace(sql,captainId,timeZone='UTC'){
  const teamSlug='team-'+crypto.randomBytes(5).toString('hex');
  const statePayload=JSON.stringify(blankState(timeZone));
  const rows=await sql`
    WITH new_team AS (
      INSERT INTO teams(slug,active,is_legacy_default,plan,billing_status)
      VALUES (${teamSlug},true,false,'trial','trialing')
      RETURNING id,slug
    ), new_state AS (
      INSERT INTO team_states(team_id,state,updated_at)
      SELECT new_team.id,${statePayload}::jsonb,now() FROM new_team
      RETURNING team_id
    ), new_membership AS (
      INSERT INTO captain_team_memberships(captain_user_id,team_id,role,active)
      SELECT ${captainId},new_team.id,'owner',true FROM new_team
      RETURNING captain_user_id,team_id
    )
    SELECT id,slug FROM new_team
  `;
  return rows[0]||null;
}

async function signup(req,res,sql){
  const {email,displayName,password,timeZone}=req.body||{};
  if(!email||!displayName||!password||String(password).length<10){
    return res.status(400).json({error:'Name, email, and a password of at least 10 characters are required'});
  }
  const normalizedEmail=String(email).trim().toLowerCase();
  const exists=await sql`SELECT id FROM captain_users WHERE lower(email)=lower(${normalizedEmail}) LIMIT 1`;
  if(exists.length) return res.status(409).json({error:'An account already exists for this email. Sign in instead.'});

  const {salt,hash}=passwordParts(password);
  const created=await sql`
    INSERT INTO captain_users(email,display_name,password_hash,password_salt,active)
    VALUES (${normalizedEmail},${String(displayName).trim()},${hash},${salt},true)
    RETURNING id,email,display_name
  `;
  const user=created[0];
  if(!user) throw new Error('Could not create captain account');
  let workspace;
  try{workspace=await createWorkspace(sql,user.id,timeZone);}catch(error){await sql`DELETE FROM captain_users WHERE id=${user.id}`;throw error;}
  if(!workspace) throw new Error('Could not create team workspace');

  const token=crypto.randomBytes(32).toString('base64url');
  await sql`INSERT INTO captain_sessions(token_hash,captain_user_id,expires_at) VALUES (${hashToken(token)},${user.id},now()+interval '7 days')`;
  setSessionCookie(res,token);
  return res.status(201).json({
    ok:true,teamSlug:workspace.slug,teamUrl:`/team/${workspace.slug}`,captainUrl:`/captain/${workspace.slug}`,
    user:{email:user.email,displayName:user.display_name}
  });
}

async function createCaptainInvite(req,res,sql){
  const teamSlug=requestedTeamSlug(req);
  const user=await requireTeamCaptain(req,res,teamSlug);if(!user)return;
  const rawInviteToken=crypto.randomBytes(32).toString('base64url');
  const inviteHash=hashToken(rawInviteToken);
  const rows=await sql`
    UPDATE team_states
    SET state=jsonb_set(
      state,
      '{_captainInvite}',
      jsonb_build_object(
        'tokenHash',${inviteHash}::text,
        'createdAt',to_jsonb(now()),
        'expiresAt',to_jsonb(now()+interval '7 days'),
        'createdByCaptainUserId',${String(user.id)}::text
      ),
      true
    ),updated_at=now()
    WHERE team_id=${user.team_id}
    RETURNING state->'_captainInvite'->>'expiresAt' AS expires_at
  `;
  if(!rows.length)return res.status(500).json({error:'Could not create Captain invite'});
  return res.status(200).json({
    ok:true,
    teamSlug,
    inviteUrl:`/captain/${encodeURIComponent(teamSlug)}#captain-invite=${rawInviteToken}`,
    expiresAt:rows[0].expires_at
  });
}

async function acceptCaptainInvite(req,res,sql){
  const body=req.body||{};
  const teamSlug=normalizeTeamSlug(body.teamSlug);
  const rawInviteToken=String(body.inviteToken||'').trim();
  const normalizedEmail=String(body.email||'').trim().toLowerCase();
  const displayName=String(body.displayName||'').trim();
  const password=String(body.password||'');
  if(!teamSlug||!/^[A-Za-z0-9_-]{43}$/.test(rawInviteToken))return res.status(400).json({error:'This Captain invite is invalid or expired'});
  if(!normalizedEmail||!password)return res.status(400).json({error:'Email and password are required'});
  const inviteHash=hashToken(rawInviteToken);
  const teamRows=await sql`
    SELECT t.id,t.slug
    FROM teams t
    JOIN team_states ts ON ts.team_id=t.id
    WHERE t.slug=${teamSlug}
      AND t.active=true
      AND ts.state->'_captainInvite'->>'tokenHash'=${inviteHash}
      AND NULLIF(ts.state->'_captainInvite'->>'expiresAt','')::timestamptz>now()
    LIMIT 1
  `;
  const team=teamRows[0];
  if(!team)return res.status(401).json({error:'This Captain invite is invalid or expired'});

  const existing=await sql`
    SELECT id,email,display_name,password_hash,password_salt,active
    FROM captain_users
    WHERE lower(email)=lower(${normalizedEmail})
    LIMIT 1
  `;
  let captainId,createdNew=false;
  if(existing.length){
    if(!passwordMatches(password,existing[0]))return res.status(401).json({error:'Could not join with that email and password'});
    captainId=existing[0].id;
  }else{
    if(!displayName||password.length<10)return res.status(400).json({error:'New Captains need a name and password of at least 10 characters'});
    const {salt,hash}=passwordParts(password);
    const created=await sql`
      INSERT INTO captain_users(email,display_name,password_hash,password_salt,active)
      VALUES (${normalizedEmail},${displayName},${hash},${salt},true)
      RETURNING id
    `;
    if(!created.length)return res.status(500).json({error:'Could not create Captain account'});
    captainId=created[0].id;createdNew=true;
  }

  const rawSessionToken=crypto.randomBytes(32).toString('base64url');
  const sessionHash=hashToken(rawSessionToken);
  let joined;
  try{
    joined=await sql`
      WITH consumed AS (
        UPDATE team_states
        SET state=state-'_captainInvite',updated_at=now()
        WHERE team_id=${team.id}
          AND state->'_captainInvite'->>'tokenHash'=${inviteHash}
          AND NULLIF(state->'_captainInvite'->>'expiresAt','')::timestamptz>now()
        RETURNING team_id
      ), membership AS (
        INSERT INTO captain_team_memberships(captain_user_id,team_id,role,active)
        SELECT ${captainId},consumed.team_id,'captain',true FROM consumed
        ON CONFLICT(captain_user_id,team_id) DO UPDATE SET
          active=true,
          role=CASE WHEN captain_team_memberships.role='owner' THEN 'owner' ELSE 'captain' END
        RETURNING team_id
      ), activated AS (
        UPDATE captain_users
        SET active=true
        WHERE id=${captainId} AND EXISTS (SELECT 1 FROM membership)
        RETURNING id
      ), new_session AS (
        INSERT INTO captain_sessions(token_hash,captain_user_id,expires_at)
        SELECT ${sessionHash},activated.id,now()+interval '7 days' FROM activated
        RETURNING captain_user_id
      )
      SELECT membership.team_id FROM membership JOIN new_session ON true
    `;
  }catch(error){
    if(createdNew)await sql`DELETE FROM captain_users WHERE id=${captainId}`;
    throw error;
  }
  if(!joined.length){
    if(createdNew)await sql`DELETE FROM captain_users WHERE id=${captainId}`;
    return res.status(401).json({error:'This Captain invite is invalid or expired'});
  }
  setSessionCookie(res,rawSessionToken);
  return res.status(200).json({ok:true,teamSlug:team.slug,captainUrl:`/captain/${team.slug}`});
}

module.exports = async function handler(req,res){
  try{
    const sql=getSql();
    const action=String(req.body&&req.body.action||'');
    if(req.method==='POST'&&action==='signup') return signup(req,res,sql);
    if(req.method==='POST'&&action==='accept-invite') return acceptCaptainInvite(req,res,sql);
    if(req.method==='POST'&&action==='create-invite') return createCaptainInvite(req,res,sql);

    if(req.method==='POST'&&action==='create-team'){
      const account=await getCaptain(req);
      if(!account) return res.status(401).json({error:'Captain login required'});
      const workspace=await createWorkspace(sql,account.id,req.body&&req.body.timeZone);
      return res.status(201).json({ok:true,teamSlug:workspace.slug,teamUrl:`/team/${workspace.slug}`,captainUrl:`/captain/${workspace.slug}`});
    }

    const teamSlug=requestedTeamSlug(req);
    const user=await requireTeamCaptain(req,res,teamSlug);if(!user)return;

    if(req.method==='GET'){
      const rows=await sql`
        SELECT u.email,u.display_name,u.active,m.role,m.created_at
        FROM captain_team_memberships m
        JOIN captain_users u ON u.id=m.captain_user_id
        JOIN teams t ON t.id=m.team_id
        WHERE t.slug=${teamSlug} AND m.active=true AND u.active=true
        ORDER BY CASE WHEN m.role='owner' THEN 0 ELSE 1 END,m.created_at
      `;
      return res.status(200).json({captains:rows,teamSlug,viewerRole:user.role});
    }

    if(req.method==='POST'){
      if(action==='availability-response'){
        const gameDate=String(req.body&&req.body.gameDate||'');
        const status=String(req.body&&req.body.status||'');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) return res.status(400).json({error:'A valid game date is required'});
        if(!ATTENDANCE.has(status)) return res.status(400).json({error:'Answer Yes, No, or Not sure'});
        const stateRows=await sql`SELECT state FROM team_states WHERE team_id=${user.team_id} LIMIT 1`;
        const state=stateRows[0]&&stateRows[0].state||{};
        const games=(state.events||[]).filter(e=>e&&e.type==='Game'&&e.date===gameDate);
        if(!games.length) return res.status(400).json({error:'No game is scheduled for that date'});
        const key=String(user.email||'').trim().toLowerCase();
        const playerName=linkedPlayerName(state,user);
        const answer={status,respondedAt:new Date().toISOString(),displayName:user.display_name||user.email,role:user.role||'captain',source:'captain-login'};
        const payload=JSON.stringify(answer);
        if(playerName){
          await sql`
            UPDATE team_states
            SET state=jsonb_set(
              state,
              '{availability}',
              COALESCE(state->'availability','{}'::jsonb) || jsonb_build_object(
                ${gameDate}::text,
                (COALESCE(state->'availability'->(${gameDate}::text),'{}'::jsonb) || jsonb_build_object(${playerName}::text,${payload}::jsonb)) || jsonb_build_object(
                  '_captains',COALESCE(state->'availability'->(${gameDate}::text)->'_captains','{}'::jsonb) - (${key}::text)
                )
              ),
              true
            ),
            updated_at=now()
            WHERE team_id=${user.team_id}
          `;
        }else{
          await sql`
            UPDATE team_states
            SET state=jsonb_set(
              state,
              '{availability}',
              COALESCE(state->'availability','{}'::jsonb) || jsonb_build_object(
                ${gameDate}::text,
                COALESCE(state->'availability'->(${gameDate}::text),'{}'::jsonb) || jsonb_build_object(
                  '_captains',
                  COALESCE(state->'availability'->(${gameDate}::text)->'_captains','{}'::jsonb) || jsonb_build_object(${key}::text,${payload}::jsonb)
                )
              ),
              true
            ),
            updated_at=now()
            WHERE team_id=${user.team_id}
          `;
        }
        return res.status(200).json({ok:true,gameDate,status,respondedAt:answer.respondedAt,displayName:answer.displayName,playerName:playerName||null});
      }

      if(action==='update-slug'){
        if(user.role!=='owner') return res.status(403).json({error:'Only the team owner can change the team link'});
        const next=normalizeTeamSlug(req.body&&req.body.slug);
        if(!next) return res.status(400).json({error:'Use 3–64 lowercase letters, numbers, or hyphens for the team link'});
        const taken=await sql`SELECT id FROM teams WHERE slug=${next} AND id<>${user.team_id} LIMIT 1`;
        if(taken.length) return res.status(409).json({error:'That team link is already in use'});
        await sql`UPDATE teams SET slug=${next} WHERE id=${user.team_id}`;
        return res.status(200).json({ok:true,teamSlug:next,teamUrl:`/team/${next}`,captainUrl:`/captain/${next}`});
      }

      if(action==='remove-member'){
        const memberEmail=String(req.body&&req.body.email||'').trim().toLowerCase();
        if(!memberEmail) return res.status(400).json({error:'Captain email is required'});
        const target=await sql`
          SELECT u.id,m.role FROM captain_team_memberships m JOIN captain_users u ON u.id=m.captain_user_id
          WHERE m.team_id=${user.team_id} AND lower(u.email)=lower(${memberEmail}) AND m.active=true LIMIT 1
        `;
        if(!target.length) return res.status(404).json({error:'Captain was not found on this team'});
        if(target[0].role==='owner') return res.status(400).json({error:'The team owner cannot be removed'});
        await sql`UPDATE captain_team_memberships SET active=false WHERE team_id=${user.team_id} AND captain_user_id=${target[0].id}`;
        return res.status(200).json({ok:true});
      }

      const {email,displayName,password}=req.body||{};
      if(!email||!displayName) return res.status(400).json({error:'Email and name are required'});
      const normalizedEmail=String(email).trim().toLowerCase();
      const existing=await sql`SELECT id,email,display_name FROM captain_users WHERE lower(email)=lower(${normalizedEmail}) LIMIT 1`;
      let captainId,existingAccount=false;
      if(existing.length){
        captainId=existing[0].id;existingAccount=true;
        await sql`UPDATE captain_users SET active=true WHERE id=${captainId}`;
      }else{
        if(!password||String(password).length<10) return res.status(400).json({error:'New captains need a temporary password of at least 10 characters'});
        const {salt,hash}=passwordParts(password);
        const created=await sql`
          INSERT INTO captain_users(email,display_name,password_hash,password_salt,active)
          VALUES (${normalizedEmail},${String(displayName).trim()},${hash},${salt},true)
          RETURNING id
        `;
        captainId=created[0].id;
      }
      await sql`
        INSERT INTO captain_team_memberships(captain_user_id,team_id,role,active)
        VALUES (${captainId},${user.team_id},'captain',true)
        ON CONFLICT(captain_user_id,team_id) DO UPDATE SET active=true
      `;
      return res.status(200).json({ok:true,existingAccount});
    }

    return res.status(405).json({error:'Method not allowed'});
  }catch(error){
    const status=error.code==='DATABASE_NOT_CONFIGURED'?503:(error.code==='23505'?409:500);
    return res.status(status).json({error:error.message||'Captain management failed'});
  }
};
