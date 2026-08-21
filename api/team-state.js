const webpush = require('web-push');
const { getSql } = require('./_db');
const { DEFAULT_TEAM_SLUG, requestedTeamSlug, getTeam, getCaptainTeam, requireTeamCaptain } = require('./_auth');

const ATTENDANCE = new Set(['yes', 'no', 'not_sure']);
const DEFAULT_TEAM = {
  name: '', shortName: '', organization: '', sport: 'Kickball', location: '',
  primaryColor: '#15803d', accentColor: '#f7fff8', logoDataUrl: '', logoUrl: '',
  chatUrl: '', announcement: '', arrivalMinutes: 60, secondReminderMinutes: 30,
  leagueAppsEnabled: false, timeZone: 'America/New_York'
};

function teamConfig(state) {
  return { ...DEFAULT_TEAM, ...((state && state.team) || {}) };
}

function captainState(value) {
  const state = value && typeof value === 'object' ? { ...value } : {};
  delete state._pushConfig;
  delete state._pushSubscriptions;
  delete state._pushReminderLog;
  return state;
}

function publicAvailability(state, playerName) {
  if (!playerName) return {};
  const roster = new Set((state.players || []).map(p => p && p.name).filter(Boolean));
  if (!roster.has(playerName)) return {};
  const out = {};
  for (const [date, answers] of Object.entries(state.availability || {})) {
    const answer = answers && answers[playerName];
    if (!answer || !ATTENDANCE.has(answer.status)) continue;
    out[date] = {
      [playerName]: {
        status: answer.status,
        respondedAt: answer.respondedAt || null
      }
    };
  }
  return out;
}

function publicState(value, playerName = '') {
  const raw = value && typeof value === 'object' ? value : {};
  const players = (Array.isArray(raw.players) ? raw.players : []).map(p => ({
    id: p && p.id || '',
    name: p && p.name || '',
    fullName: p && p.fullName || '',
    present: !(p && p.present === false)
  })).filter(p => p.name);

  return {
    team: teamConfig(raw),
    playerVisibility: raw.playerVisibility || {},
    resources: Array.isArray(raw.resources) ? raw.resources : [],
    players,
    innings: raw.innings || {},
    pods: Array.isArray(raw.pods) ? raw.pods : [],
    kickingOrder: Array.isArray(raw.kickingOrder) ? raw.kickingOrder : [],
    currentKicker: raw.currentKicker || '',
    kickerIndex: Number(raw.kickerIndex || 0),
    score: raw.score || { team: 0, opponent: 0 },
    counts: raw.counts || { balls: 0, fouls: 0, outs: 0 },
    gameInning: Number(raw.gameInning || 1),
    fieldInning: Number(raw.fieldInning || raw.gameInning || 1),
    half: raw.half || '',
    events: Array.isArray(raw.events) ? raw.events : [],
    season: raw.season || {},
    lastLeagueSync: raw.lastLeagueSync || null,
    availability: publicAvailability(raw, playerName)
  };
}

async function loadState(sql, slug) {
  return getTeam(sql, slug);
}

async function ensurePushConfig(sql) {
  const founder = await getTeam(sql, DEFAULT_TEAM_SLUG);
  if (!founder) throw new Error('Push configuration workspace was not found');
  const state = founder.state || {};
  let config = state._pushConfig;
  if (config && config.publicKey && config.privateKey) return config;

  const keys = webpush.generateVAPIDKeys();
  const candidate = { publicKey: keys.publicKey, privateKey: keys.privateKey, createdAt: new Date().toISOString() };
  const payload = JSON.stringify(candidate);
  const updated = await sql`
    UPDATE team_states
    SET state = jsonb_set(state, '{_pushConfig}', ${payload}::jsonb, true), updated_at = now()
    WHERE team_id = ${founder.id}
      AND (state->'_pushConfig' IS NULL OR state->'_pushConfig' = '{}'::jsonb)
    RETURNING state->'_pushConfig' AS config
  `;
  if (updated[0] && updated[0].config) return updated[0].config;

  const current = await sql`SELECT state->'_pushConfig' AS config FROM team_states WHERE team_id=${founder.id} LIMIT 1`;
  config = current[0] && current[0].config;
  if (!config || !config.publicKey || !config.privateKey) throw new Error('Push notification keys could not be initialized');
  return config;
}

function zonedParts(date = new Date(), timeZone = 'America/New_York') {
  let zone = timeZone || 'America/New_York';
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(date); } catch (_) { zone = 'America/New_York'; }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', hour12: false
  }).formatToParts(date);
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${obj.year}-${obj.month}-${obj.day}`, weekday: obj.weekday, hour: Number(obj.hour), timeZone: zone };
}
function plusDays(iso, days) { const [y,m,d]=iso.split('-').map(Number); return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10); }
function time12(value) { if(!value)return''; const [h,m]=value.split(':').map(Number); return new Date(2000,0,1,h,m||0).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); }

async function sendAttendanceReminderForTeam(sql, row) {
  const state = row.state || {};
  const team = teamConfig(state);
  const local = zonedParts(new Date(), team.timeZone);
  if (local.weekday !== 'Thu' || local.hour !== 18) return { slug:row.slug, ok:true, skipped:`Not Thursday at 6 PM in ${local.timeZone}` };
  const gameDate = plusDays(local.date, 3);
  const games = (state.events || []).filter(e => e && e.type === 'Game' && e.date === gameDate).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  if (!games.length) return { slug:row.slug, ok:true, gameDate, skipped:'No Sunday game scheduled' };
  if (state._pushReminderLog && state._pushReminderLog[gameDate] && state._pushReminderLog[gameDate].sentAt) {
    return { slug:row.slug, ok:true, gameDate, skipped:'Reminder already sent' };
  }

  const subscriptions = state._pushSubscriptions || {};
  const roster = new Set((state.players || []).map(p => p && p.name).filter(Boolean));
  const config = await ensurePushConfig(sql);
  webpush.setVapidDetails('mailto:notifications@teamgameday.app', config.publicKey, config.privateKey);
  const times = games.map(g => time12(g.time)).filter(Boolean);
  const teamName = team.shortName || team.name || 'Team';
  const body = `Will you be at Sunday’s game${games.length > 1 ? 's' : ''}${times.length ? ` at ${times.join(' & ')}` : ''}? Tap to answer Yes, No, or Not sure.`;
  let sent=0,failed=0;
  const cleaned={...subscriptions};
  for (const [playerName,entries] of Object.entries(subscriptions)) {
    if(!roster.has(playerName)) continue;
    const list=Array.isArray(entries)?entries:[],keep=[];
    for(const entry of list){
      if(!entry||!entry.subscription)continue;
      try{
        await webpush.sendNotification(entry.subscription,JSON.stringify({
          title:`${teamName} • Sunday availability`,body,
          url:`/team/${row.slug}?player=${encodeURIComponent(playerName)}&availability=${gameDate}`,
          tag:`team-${row.slug}-attendance-${gameDate}`,gameDate
        }),{TTL:259200,urgency:'normal'});
        keep.push(entry);sent++;
      }catch(error){
        const code=Number(error&&error.statusCode);if(code!==404&&code!==410)keep.push(entry);failed++;
      }
    }
    cleaned[playerName]=keep;
  }
  const log={sentAt:new Date().toISOString(),sent,failed,gameCount:games.length};
  const cleanedPayload=JSON.stringify(cleaned),logPayload=JSON.stringify(log);
  await sql`
    UPDATE team_states SET state = jsonb_set(
      jsonb_set(state, '{_pushSubscriptions}', ${cleanedPayload}::jsonb, true),
      '{_pushReminderLog}', COALESCE(state->'_pushReminderLog', '{}'::jsonb) || jsonb_build_object(${gameDate}, ${logPayload}::jsonb), true
    ), updated_at = now() WHERE team_id = ${row.id}
  `;
  return { slug:row.slug,ok:true,gameDate,sent,failed,games:games.length };
}

async function sendAllAttendanceReminders(sql){
  const rows=await sql`
    SELECT t.id,t.slug,t.plan,t.billing_status,ts.state,ts.updated_at
    FROM teams t JOIN team_states ts ON ts.team_id=t.id
    WHERE t.active=true
    ORDER BY t.created_at
  `;
  const results=[];
  for(const row of rows){
    try{results.push(await sendAttendanceReminderForTeam(sql,row));}
    catch(error){results.push({slug:row.slug,ok:false,error:error.message||'Reminder failed'});}
  }
  return {ok:true,teams:results};
}

function sendManifest(res, row) {
  const state=row.state||{},team = teamConfig(state),slug=row.slug;
  const name = team.name ? `${team.name} Game Day Manager` : 'Team Game Day Manager';
  const shortName = team.shortName || team.name || 'Game Day';
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    id:`/team/${slug}`,name,short_name:shortName.slice(0,30),start_url:`/team/${slug}`,scope:'/',display:'standalone',
    background_color:team.accentColor||'#f7fff8',theme_color:team.primaryColor||'#15803d',
    icons:[{src:`/api/team-state?team=${encodeURIComponent(slug)}&logo=1`,sizes:'any',purpose:'any maskable'}]
  });
}

function sendLogo(res, row) {
  const team = teamConfig(row.state || {});
  const data = String(team.logoDataUrl || '');
  const match = data.match(/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
  if (match) {
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length <= 750000) {
      res.setHeader('Content-Type', match[1]);res.setHeader('Cache-Control', 'no-store');return res.status(200).send(buffer);
    }
  }
  const fallback = typeof team.logoUrl === 'string' && team.logoUrl.startsWith('/') ? team.logoUrl : '/generic-team-icon.svg';
  res.setHeader('Cache-Control', 'no-store');return res.redirect(307, fallback);
}

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();
    if (req.method === 'GET' && String(req.headers['user-agent'] || '') === 'vercel-cron/1.0') {
      return res.status(200).json(await sendAllAttendanceReminders(sql));
    }

    const teamSlug=requestedTeamSlug(req);
    const row=await loadState(sql,teamSlug);
    if(!row) return res.status(404).json({error:'Team was not found'});

    if (req.method === 'GET') {
      if (String(req.query && req.query.pushConfig || '') === '1') {
        const config = await ensurePushConfig(sql);res.setHeader('Cache-Control','no-store');return res.status(200).json({publicKey:config.publicKey});
      }
      if (String(req.query && req.query.manifest || '') === '1') return sendManifest(res,row);
      if (String(req.query && req.query.logo || '') === '1') return sendLogo(res,row);
      const captain = await getCaptainTeam(req, teamSlug);
      const requestedPlayer = String(req.query && req.query.player || '').trim().slice(0,80);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        state: captain ? captainState(row.state) : publicState(row.state, requestedPlayer),
        updatedAt:row.updated_at,teamSlug:row.slug,plan:row.plan,billingStatus:row.billing_status
      });
    }

    if (req.method === 'POST') {
      const state=row.state||{};
      const playerName=String(req.body&&req.body.playerName||'').trim().slice(0,80);
      const player=(state.players||[]).find(p=>p&&p.name===playerName);
      if(!player) return res.status(404).json({error:'Player was not found on the roster'});
      const action=String(req.body&&req.body.action||'access');

      if(action==='subscribe'){
        const sub=req.body&&req.body.subscription;
        if(!sub||typeof sub.endpoint!=='string'||!sub.endpoint.startsWith('https://')||!sub.keys||!sub.keys.p256dh||!sub.keys.auth)return res.status(400).json({error:'A valid push subscription is required'});
        await ensurePushConfig(sql);
        const existing=state._pushSubscriptions&&state._pushSubscriptions[playerName];
        let list=Array.isArray(existing)?existing:[];
        list=list.filter(x=>x&&x.subscription&&x.subscription.endpoint!==sub.endpoint);
        list.push({subscription:sub,updatedAt:new Date().toISOString()});list=list.slice(-3);
        const payload=JSON.stringify(list);
        await sql`UPDATE team_states SET state=jsonb_set(state,'{_pushSubscriptions}',COALESCE(state->'_pushSubscriptions','{}'::jsonb)||jsonb_build_object(${playerName},${payload}::jsonb),true),updated_at=now() WHERE team_id=${row.id}`;
        return res.status(200).json({ok:true,remindersEnabled:true});
      }

      if(action==='attendance-response'){
        const gameDate=String(req.body&&req.body.gameDate||''),status=String(req.body&&req.body.status||'');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(gameDate))return res.status(400).json({error:'A valid Sunday game date is required'});
        if(!ATTENDANCE.has(status))return res.status(400).json({error:'Answer Yes, No, or Not sure'});
        const games=(state.events||[]).filter(e=>e&&e.type==='Game'&&e.date===gameDate);if(!games.length)return res.status(400).json({error:'No game is scheduled for that date'});
        const answer={status,respondedAt:new Date().toISOString()},payload=JSON.stringify(answer);
        await sql`UPDATE team_states SET state=jsonb_set(state,'{availability}',COALESCE(state->'availability','{}'::jsonb)||jsonb_build_object(${gameDate}::text,COALESCE(state->'availability'->(${gameDate}::text),'{}'::jsonb)||jsonb_build_object(${playerName}::text,${payload}::jsonb)),true),updated_at=now() WHERE team_id=${row.id}`;
        return res.status(200).json({ok:true,gameDate,playerName,status,respondedAt:answer.respondedAt});
      }

      const accessStatus=req.body&&req.body.accessStatus==='installed'?'installed':'browser';
      const now=new Date().toISOString();const current=(state.appAccess&&state.appAccess[playerName])||{};
      const next={...current,playerName,browserSeenAt:current.browserSeenAt||now,lastSeenAt:now,...(accessStatus==='installed'?{installedAt:current.installedAt||now}:{})};
      const payload=JSON.stringify(next);
      await sql`UPDATE team_states SET state=jsonb_set(state,'{appAccess}',COALESCE(state->'appAccess','{}'::jsonb)||jsonb_build_object(${playerName},${payload}::jsonb),true),updated_at=now() WHERE team_id=${row.id}`;
      return res.status(200).json({ok:true,accessStatus});
    }

    if (req.method === 'PUT') {
      const user=await requireTeamCaptain(req,res,teamSlug);if(!user)return;
      const next=req.body&&req.body.state;
      if(!next||typeof next!=='object'||Array.isArray(next))return res.status(400).json({error:'A valid state object is required'});
      const payload=JSON.stringify(next);if(payload.length>1000000)return res.status(413).json({error:'Team state is too large'});
      const rows=await sql`
        UPDATE team_states SET state=${payload}::jsonb||jsonb_build_object(
          'appAccess',COALESCE(state->'appAccess','{}'::jsonb),
          'availability',COALESCE(state->'availability','{}'::jsonb),
          '_pushConfig',COALESCE(state->'_pushConfig','{}'::jsonb),
          '_pushSubscriptions',COALESCE(state->'_pushSubscriptions','{}'::jsonb),
          '_pushReminderLog',COALESCE(state->'_pushReminderLog','{}'::jsonb)
        ),updated_at=now() WHERE team_id=${row.id} RETURNING updated_at
      `;
      return res.status(200).json({ok:true,updatedAt:rows[0]&&rows[0].updated_at,updatedBy:user.display_name,teamSlug});
    }

    return res.status(405).json({error:'Method not allowed'});
  } catch (error) {
    const status=error.code==='DATABASE_NOT_CONFIGURED'?503:500;
    return res.status(status).json({error:error.message||'Shared state request failed'});
  }
};
