const crypto = require('crypto');
const webpush = require('web-push');
const { getSql } = require('./_db');
const { DEFAULT_TEAM_SLUG, requestedTeamSlug, getTeam, getCaptainTeam, requireTeamCaptain, hashPlayerToken, setPlayerCookie, resolveAuthenticatedPlayer } = require('./_auth');

const ATTENDANCE = new Set(['yes', 'no', 'not_sure']);
const FIELD_POSITIONS = ['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
const DEFAULT_TEAM = {
  name: '', shortName: '', organization: '', sport: 'Kickball', location: '',
  primaryColor: '#15803d', accentColor: '#f7fff8', logoDataUrl: '', logoUrl: '',
  chatUrl: '', announcement: '', arrivalMinutes: 60, secondReminderMinutes: 30,
  leagueAppsEnabled: false, timeZone: 'America/New_York'
};

function teamConfig(state) {
  return { ...DEFAULT_TEAM, ...((state && state.team) || {}) };
}

function isSafeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (!/^https?:\/\//i.test(raw)) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (_) {
    return false;
  }
}

function cloneObject(value){return value&&typeof value==='object'&&!Array.isArray(value)?JSON.parse(JSON.stringify(value)):{};}

function pruneRemovedPlayerState(existingState,nextState){
  const existing=existingState&&typeof existingState==='object'?existingState:{};
  const next=nextState&&typeof nextState==='object'?nextState:{};
  const activePlayers=Array.isArray(next.players)?next.players:[];
  const activeIds=new Set(activePlayers.map(p=>String(p&&p.id||'')).filter(Boolean));
  const activeNames=new Set(activePlayers.map(p=>String(p&&p.name||'')).filter(Boolean));
  const existingPlayers=Array.isArray(existing.players)?existing.players:[];
  const removed=existingPlayers.filter(p=>p&&p.id&&!activeIds.has(String(p.id))).map(p=>({id:String(p.id),name:String(p.name||'')}));
  if(!removed.length)return removed;

  if(Array.isArray(next.kickingOrder))next.kickingOrder=next.kickingOrder.filter(name=>activeNames.has(String(name||'')));
  if(next.currentKicker&&!activeNames.has(String(next.currentKicker)))next.currentKicker='';
  if(next.innings&&typeof next.innings==='object'){
    for(const inning of Object.values(next.innings||{})){
      if(!inning||typeof inning!=='object')continue;
      for(const pos of Object.keys(inning))if(inning[pos]&&!activeNames.has(String(inning[pos])))inning[pos]='';
    }
  }
  if(Array.isArray(next.events)){
    for(const event of next.events){
      if(!event||typeof event!=='object')continue;
      for(const key of ['umpire','lineRef1','lineRef2'])if(event[key]&&!activeNames.has(String(event[key])))event[key]='';
    }
  }
  if(next.captainPlayerLinks&&typeof next.captainPlayerLinks==='object'){
    for(const email of Object.keys(next.captainPlayerLinks))if(!activeNames.has(String(next.captainPlayerLinks[email]||'')))delete next.captainPlayerLinks[email];
  }
  if(next.gameDayAttendanceOverrides&&typeof next.gameDayAttendanceOverrides==='object'){
    for(const perDate of Object.values(next.gameDayAttendanceOverrides)){
      if(!perDate||typeof perDate!=='object')continue;
      for(const name of Object.keys(perDate))if(!activeNames.has(name))delete perDate[name];
    }
  }
  return removed;
}

function preserveRenamedPlayerIdentity(existingState,nextState){
  const existing=existingState&&typeof existingState==='object'?existingState:{};
  const next=nextState&&typeof nextState==='object'?nextState:{};
  const oldById=new Map((Array.isArray(existing.players)?existing.players:[]).filter(p=>p&&p.id).map(p=>[String(p.id),String(p.name||'')]));
  const renames=new Map();
  for(const player of Array.isArray(next.players)?next.players:[]){
    const id=String(player&&player.id||''),newName=String(player&&player.name||'');
    const oldName=oldById.get(id)||'';
    if(oldName&&newName&&oldName!==newName)renames.set(oldName,newName);
  }
  const moveKey=(obj,oldName,newName)=>{
    if(!obj||typeof obj!=='object'||Array.isArray(obj)||!Object.prototype.hasOwnProperty.call(obj,oldName))return;
    const oldValue=obj[oldName];
    if(!Object.prototype.hasOwnProperty.call(obj,newName))obj[newName]=oldValue;
    else if(obj[newName]&&oldValue&&typeof obj[newName]==='object'&&typeof oldValue==='object'&&!Array.isArray(obj[newName])&&!Array.isArray(oldValue))obj[newName]={...oldValue,...obj[newName]};
    delete obj[oldName];
  };
  const appAccess=cloneObject(existing.appAccess);
  const availability=cloneObject(existing.availability);
  const pushSubscriptions=cloneObject(existing._pushSubscriptions);
  const activeNames=new Set((Array.isArray(next.players)?next.players:[]).map(p=>String(p&&p.name||'')).filter(Boolean));
  for(const key of Object.keys(appAccess))if(!activeNames.has(key))delete appAccess[key];
  for(const key of Object.keys(pushSubscriptions))if(!activeNames.has(key))delete pushSubscriptions[key];
  for(const answers of Object.values(availability))if(answers&&typeof answers==='object')for(const key of Object.keys(answers))if(key!=='_captains'&&!activeNames.has(key))delete answers[key];
  for(const [oldName,newName] of renames){
    moveKey(appAccess,oldName,newName);
    if(appAccess[newName]&&typeof appAccess[newName]==='object')appAccess[newName].playerName=newName;
    moveKey(pushSubscriptions,oldName,newName);
    for(const answers of Object.values(availability))moveKey(answers,oldName,newName);
    const links=next.captainPlayerLinks&&typeof next.captainPlayerLinks==='object'?next.captainPlayerLinks:null;
    if(links)for(const email of Object.keys(links))if(links[email]===oldName)links[email]=newName;
    const overrides=next.gameDayAttendanceOverrides&&typeof next.gameDayAttendanceOverrides==='object'?next.gameDayAttendanceOverrides:null;
    if(overrides)for(const perDate of Object.values(overrides))moveKey(perDate,oldName,newName);
  }
  return {renames,appAccess,availability,pushSubscriptions};
}

function normalizeCounts(value) {
  const counts = value && typeof value === 'object' ? value : {};
  return {
    balls: Number(counts.balls || 0),
    strikes: Number(counts.strikes || 0),
    fouls: Number(counts.fouls || 0),
    outs: Number(counts.outs || 0)
  };
}

function captainState(value) {
  const state = value && typeof value === 'object' ? { ...value } : {};
  delete state._pushConfig;
  delete state._pushSubscriptions;
  delete state._pushReminderLog;
  delete state._pilotFeedback;
  const alerts=Array.isArray(state._captainAlerts)?state._captainAlerts.slice(-10):[];
  delete state._captainAlerts;
  delete state.__feildhaus_pilot_gate__;
  state.captainAlerts=alerts;
  state.counts = normalizeCounts(state.counts);
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
    counts: normalizeCounts(raw.counts),
    gameInning: Number(raw.gameInning || 1),
    fieldInning: Number(raw.fieldInning || raw.gameInning || 1),
    half: raw.half || '',
    events: Array.isArray(raw.events) ? raw.events : [],
    season: raw.season || {},
    lastLeagueSync: raw.lastLeagueSync || null,
    availability: publicAvailability(raw, playerName),
    captainAlerts: Array.isArray(raw._captainAlerts)?raw._captainAlerts.slice(-10):[]
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

function scheduleEventKey(event){return event&&typeof event==='object'?String(event.sourceUid||event.id||'').trim():'';}
function scheduleEventSnapshot(event){return {type:String(event&&event.type||''),title:String(event&&event.title||''),date:String(event&&event.date||''),time:String(event&&event.time||''),location:String(event&&event.location||'')};}
function scheduleChanges(previous,next){
  const oldMap=new Map((Array.isArray(previous&&previous.events)?previous.events:[]).map(e=>[scheduleEventKey(e),scheduleEventSnapshot(e)]).filter(([k])=>k));
  const newMap=new Map((Array.isArray(next&&next.events)?next.events:[]).map(e=>[scheduleEventKey(e),scheduleEventSnapshot(e)]).filter(([k])=>k));
  const changes=[];
  for(const [key,before] of oldMap){
    if(before.type!=='Game')continue;
    const after=newMap.get(key);
    if(!after){changes.push({key,kind:'cancelled',before,after:null});continue;}
    const fields=['date','time','location','title'].filter(field=>before[field]!==after[field]);
    if(fields.length)changes.push({key,kind:'changed',fields,before,after});
  }
  return changes;
}
async function sendScheduleChangeAlerts(sql,row,previous,next,changes){
  if(!changes.length)return {sent:0,failed:0};
  const subscriptions=(previous&&previous._pushSubscriptions)||{},roster=new Set((Array.isArray(next.players)?next.players:[]).map(p=>p&&p.name).filter(Boolean));
  if(!Object.keys(subscriptions).length)return {sent:0,failed:0};
  const config=await ensurePushConfig(sql);webpush.setVapidDetails('mailto:notifications@teamgameday.app',config.publicKey,config.privateKey);
  const team=teamConfig(next),teamName=team.shortName||team.name||'Team';let sent=0,failed=0;
  const describe=change=>{const game=change.after||change.before,date=game.date?new Date(game.date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}):'game day';if(change.kind==='cancelled')return (game.title||'Game')+' on '+date+' was removed from the schedule.';const bits=[];if(change.fields.includes('date'))bits.push('date');if(change.fields.includes('time'))bits.push('time');if(change.fields.includes('location'))bits.push('field/location');if(change.fields.includes('title'))bits.push('opponent/game');return (game.title||'Game')+' on '+date+': '+bits.join(', ')+' updated.';};
  const body=changes.slice(0,2).map(describe).join(' ')+(changes.length>2?' +'+(changes.length-2)+' more update'+(changes.length-2===1?'':'s')+'.':'');
  for(const [playerName,entries] of Object.entries(subscriptions)){if(!roster.has(playerName))continue;for(const entry of Array.isArray(entries)?entries:[]){if(!entry||!entry.subscription)continue;try{await webpush.sendNotification(entry.subscription,JSON.stringify({title:teamName+' • Schedule updated',body,url:'/team/'+row.slug,tag:'team-'+row.slug+'-schedule-'+Date.now()}),{TTL:86400,urgency:'high'});sent++;}catch(_){failed++;}}}
  return {sent,failed};
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
  if (local.hour !== 18) return { slug:row.slug, ok:true, skipped:`Not 6 PM in ${local.timeZone}` };
  const gameDate = plusDays(local.date, 3);
  const games = (state.events || []).filter(e => e && e.type === 'Game' && e.date === gameDate).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  if (!games.length) return { slug:row.slug, ok:true, gameDate, skipped:'No game scheduled three days from now' };
  if (state._pushReminderLog && state._pushReminderLog[gameDate] && state._pushReminderLog[gameDate].sentAt) {
    return { slug:row.slug, ok:true, gameDate, skipped:'Reminder already sent' };
  }

  const subscriptions = state._pushSubscriptions || {};
  const roster = new Set((state.players || []).map(p => p && p.name).filter(Boolean));
  const config = await ensurePushConfig(sql);
  webpush.setVapidDetails('mailto:notifications@teamgameday.app', config.publicKey, config.privateKey);
  const times = games.map(g => time12(g.time)).filter(Boolean);
  const teamName = team.shortName || team.name || 'Team';
  const dayName=new Date(gameDate+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'});
  const body = `Will you be at ${dayName}’s game${games.length > 1 ? 's' : ''}${times.length ? ` at ${times.join(' & ')}` : ''}? Tap to answer Yes, No, or Not sure.`;
  let sent=0,failed=0;
  const cleaned={...subscriptions};
  for (const [playerName,entries] of Object.entries(subscriptions)) {
    if(!roster.has(playerName)) continue;
    const list=Array.isArray(entries)?entries:[],keep=[];
    for(const entry of list){
      if(!entry||!entry.subscription)continue;
      try{
        await webpush.sendNotification(entry.subscription,JSON.stringify({
          title:`${teamName} • ${dayName} availability`,body,
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
      '{_pushReminderLog}', COALESCE(state->'_pushReminderLog', '{}'::jsonb) || jsonb_build_object(${gameDate}::text, ${logPayload}::jsonb), true
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
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  try {
    const sql = getSql();
    if (req.method === 'GET' && String(req.headers['user-agent'] || '') === 'vercel-cron/1.0') {
      return res.status(200).json(await sendAllAttendanceReminders(sql));
    }

    const teamSlug=requestedTeamSlug(req);
    const row=await loadState(sql,teamSlug);
    if(!row) return res.status(404).json({error:'Team was not found'});

    if (req.method === 'GET') {
      if (String(req.query && req.query.pilotInsights || '') === '1') {
        const user=await requireTeamCaptain(req,res,teamSlug);if(!user)return;
        const state=row.state||{};
        const players=Array.isArray(state.players)?state.players:[];
        const events=Array.isArray(state.events)?state.events:[];
        const appAccess=state.appAccess&&typeof state.appAccess==='object'?state.appAccess:{};
        const availability=state.availability&&typeof state.availability==='object'?state.availability:{};
        const feedback=Array.isArray(state._pilotFeedback)?state._pilotFeedback:[];
        const pairedPlayers=Object.values(appAccess).filter(x=>x&&x.lastSeenAt).length;
        const installedPlayers=Object.values(appAccess).filter(x=>x&&x.installedAt).length;
        const responseCount=Object.values(availability).reduce((sum,answers)=>sum+Object.keys(answers&&typeof answers==='object'?answers:{}).length,0);
        const upcomingGames=events.filter(e=>e&&e.type==='Game'&&e.date&&e.date>=new Date().toLocaleDateString('en-CA',{timeZone:(state.team&&state.team.timeZone)||'America/New_York'})).length;
        const assignedFieldSpots=Object.values(state.innings||{}).reduce((sum,inning)=>sum+Object.values(inning&&typeof inning==='object'?inning:{}).filter(Boolean).length,0);
        const feedbackByCategory=feedback.reduce((acc,item)=>{const k=String(item&&item.category||'other');acc[k]=(acc[k]||0)+1;return acc},{});
        res.setHeader('Cache-Control','no-store');
        return res.status(200).json({
          ok:true,
          teamSlug,
          metrics:{
            rosterPlayers:players.length,
            pairedPlayers,
            installedPlayers,
            availabilityResponses:responseCount,
            upcomingGames,
            assignedFieldSpots,
            feedbackTotal:feedback.length,
            feedbackByCategory
          }
        });
      }
      if (String(req.query && req.query.playerAccess || '') === '1') {
        const user=await requireTeamCaptain(req,res,teamSlug);if(!user)return;
        const accessRows=await sql`
          WITH roster AS (
            SELECT DISTINCT p->>'id' AS player_id
            FROM team_states ts
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts.state->'players','[]'::jsonb)) AS p
            WHERE ts.team_id=${row.id}
              AND COALESCE(p->>'id','')<>''
          ),
          sessions AS (
            SELECT player_id,count(*)::int AS active_devices
            FROM player_device_sessions
            WHERE team_id=${row.id}
              AND revoked_at IS NULL
              AND expires_at>now()
            GROUP BY player_id
          ),
          invites AS (
            SELECT player_id,max(expires_at) AS invite_expires_at
            FROM player_pairing_invites
            WHERE team_id=${row.id}
              AND used_at IS NULL
              AND revoked_at IS NULL
              AND expires_at>now()
            GROUP BY player_id
          )
          SELECT
            roster.player_id,
            COALESCE(sessions.active_devices,0)::int AS active_devices,
            (invites.player_id IS NOT NULL) AS pending_invite,
            invites.invite_expires_at
          FROM roster
          LEFT JOIN sessions ON sessions.player_id=roster.player_id
          LEFT JOIN invites ON invites.player_id=roster.player_id
          ORDER BY roster.player_id
        `;
        res.setHeader('Cache-Control','no-store');
        return res.status(200).json({
          ok:true,
          players:accessRows.map(item=>({
            playerId:String(item.player_id||''),
            activeDevices:Number(item.active_devices||0),
            pendingInvite:item.pending_invite===true,
            inviteExpiresAt:item.invite_expires_at||null
          }))
        });
      }
      if (String(req.query && req.query.pushConfig || '') === '1') {
        const config = await ensurePushConfig(sql);res.setHeader('Cache-Control','no-store');return res.status(200).json({publicKey:config.publicKey});
      }
      if (String(req.query && req.query.manifest || '') === '1') return sendManifest(res,row);
      if (String(req.query && req.query.logo || '') === '1') return sendLogo(res,row);
      const captain = await getCaptainTeam(req, teamSlug);
      let responseState;
      if(captain){
        responseState=captainState(row.state);
      }else{
        const authenticatedPlayer=await resolveAuthenticatedPlayer(req,row,row.state||{});
        responseState=publicState(row.state,authenticatedPlayer?authenticatedPlayer.playerName:'');
        responseState.playerAccess=authenticatedPlayer?{
          paired:true,
          playerId:authenticatedPlayer.playerId,
          playerName:authenticatedPlayer.playerName,
          fullName:authenticatedPlayer.fullName
        }:{paired:false};
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        state:responseState,
        updatedAt:row.updated_at,teamSlug:row.slug,plan:row.plan,billingStatus:row.billing_status
      });
    }

    if (req.method === 'POST') {
      const state=row.state||{};
      const action=String(req.body&&req.body.action||'access');

      if(action==='pilot-feedback'){
        const category=String(req.body&&req.body.category||'').trim().toLowerCase();
        const allowed=new Set(['bug','confusing','idea','love']);
        if(!allowed.has(category))return res.status(400).json({error:'Choose a valid feedback category'});
        const message=String(req.body&&req.body.message||'').trim().slice(0,1200);
        if(!message)return res.status(400).json({error:'Tell us what you noticed'});
        const captain=await getCaptainTeam(req,teamSlug);
        const player=captain?null:await resolveAuthenticatedPlayer(req,row,state);
        if(!captain&&!player)return res.status(401).json({error:'Sign in or pair your player access before sending feedback'});
        const item={
          id:crypto.randomUUID(),
          category,
          message,
          screen:String(req.body&&req.body.screen||'').trim().slice(0,160),
          actor:captain?'captain':'player',
          createdAt:new Date().toISOString()
        };
        const payload=JSON.stringify([item]);
        await sql`UPDATE team_states
          SET state=jsonb_set(state,'{_pilotFeedback}',COALESCE(state->'_pilotFeedback','[]'::jsonb)||${payload}::jsonb,true),
              updated_at=now()
          WHERE team_id=${row.id}`;
        return res.status(200).json({ok:true,id:item.id});
      }

      if(action==='captain-alert'){
        const user=await requireTeamCaptain(req,res,teamSlug);if(!user)return;
        const message=String(req.body&&req.body.message||'').trim().slice(0,240);
        if(!message)return res.status(400).json({error:'Write a short alert before sending'});
        const requestId=String(req.body&&req.body.requestId||'').trim().slice(0,120);
        const existingAlerts=Array.isArray(state._captainAlerts)?state._captainAlerts:[];
        if(requestId){
          const existing=existingAlerts.find(item=>item&&item.requestId===requestId);
          if(existing)return res.status(200).json({ok:true,deduped:true,alert:existing,sent:Number(existing.sent||0),failed:Number(existing.failed||0)});
        }
        const team=teamConfig(state),teamName=team.shortName||team.name||'Team';
        const subscriptions=state._pushSubscriptions||{};
        const roster=new Set((state.players||[]).map(p=>p&&p.name).filter(Boolean));
        let sent=0,failed=0;
        try{
          const config=await ensurePushConfig(sql);
          webpush.setVapidDetails('mailto:notifications@teamgameday.app',config.publicKey,config.privateKey);
          for(const [playerName,entries] of Object.entries(subscriptions)){
            if(!roster.has(playerName))continue;
            for(const entry of Array.isArray(entries)?entries:[]){
              if(!entry||!entry.subscription)continue;
              try{
                await webpush.sendNotification(entry.subscription,JSON.stringify({
                  title:teamName+' • Captain Alert',
                  body:message,
                  url:'/team/'+row.slug,
                  tag:'team-'+row.slug+'-captain-alert'
                }),{TTL:21600,urgency:'high'});
                sent++;
              }catch(_){failed++;}
            }
          }
        }catch(error){failed++;}
        const item={id:crypto.randomUUID(),requestId:requestId||crypto.randomUUID(),message,createdAt:new Date().toISOString(),createdBy:user.display_name||'Captain',sent,failed};
        const payload=JSON.stringify([...existingAlerts,item].slice(-30));
        await sql`UPDATE team_states SET state=jsonb_set(state,'{_captainAlerts}',${payload}::jsonb,true),updated_at=now() WHERE team_id=${row.id}`;
        return res.status(200).json({ok:true,alert:item,sent,failed});
      }

      if(action==='create-player-invite'){
        const user=await requireTeamCaptain(req,res,teamSlug);if(!user)return;
        const playerId=String(req.body&&req.body.playerId||'').trim().slice(0,120);
        if(!playerId)return res.status(400).json({error:'A player ID is required'});
        const player=(state.players||[]).find(p=>p&&String(p.id||'')===playerId);
        if(!player)return res.status(404).json({error:'Player was not found on the roster'});
        const rawInviteToken=crypto.randomBytes(32).toString('base64url');
        const inviteHash=hashPlayerToken(rawInviteToken);
        const inviteRows=await sql`
          WITH revoked AS (
            UPDATE player_pairing_invites
            SET revoked_at=now()
            WHERE team_id=${row.id}
              AND player_id=${playerId}
              AND used_at IS NULL
              AND revoked_at IS NULL
            RETURNING 1
          ),
          gate AS (
            SELECT count(*) AS revoked_count FROM revoked
          ),
          created AS (
            INSERT INTO player_pairing_invites (
              token_hash,team_id,player_id,created_by_captain_user_id,
              created_at,expires_at,used_at,revoked_at
            )
            SELECT ${inviteHash},${row.id},${playerId},${user.id},now(),now()+interval '7 days',NULL,NULL
            FROM gate
            RETURNING expires_at
          )
          SELECT expires_at FROM created
        `;
        const inviteRow=inviteRows[0];
        if(!inviteRow)return res.status(500).json({error:'Could not create player setup link'});
        return res.status(200).json({
          ok:true,
          playerId,
          playerName:player.name||'',
          inviteUrl:`/team/${encodeURIComponent(row.slug)}#pair=${rawInviteToken}`,
          expiresAt:inviteRow.expires_at
        });
      }

      if(action==='pair-player'){
        const rawInviteToken=String(req.body&&req.body.inviteToken||'').trim();
        if(!/^[A-Za-z0-9_-]{43}$/.test(rawInviteToken))return res.status(400).json({error:'This player setup link is invalid or expired'});
        const inviteHash=hashPlayerToken(rawInviteToken);
        const rawDeviceToken=crypto.randomBytes(32).toString('base64url');
        const deviceHash=hashPlayerToken(rawDeviceToken);
        const pairedRows=await sql`
          WITH consumed AS (
            UPDATE player_pairing_invites
            SET used_at=now()
            WHERE token_hash=${inviteHash}
              AND team_id=${row.id}
              AND used_at IS NULL
              AND revoked_at IS NULL
              AND expires_at>now()
              AND EXISTS (
                SELECT 1
                FROM team_states ts
                WHERE ts.team_id=${row.id}
                  AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(COALESCE(ts.state->'players','[]'::jsonb)) AS p
                    WHERE p->>'id'=player_pairing_invites.player_id
                  )
              )
            RETURNING team_id,player_id
          ),
          created AS (
            INSERT INTO player_device_sessions (
              token_hash,team_id,player_id,created_at,last_seen_at,expires_at,revoked_at
            )
            SELECT ${deviceHash},consumed.team_id,consumed.player_id,now(),now(),now()+interval '365 days',NULL
            FROM consumed
            RETURNING team_id,player_id
          )
          SELECT
            created.player_id,
            COALESCE(p->>'name','') AS player_name,
            COALESCE(p->>'fullName','') AS full_name
          FROM created
          JOIN team_states ts ON ts.team_id=created.team_id
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts.state->'players','[]'::jsonb)) AS p
          WHERE p->>'id'=created.player_id
          LIMIT 1
        `;
        const paired=pairedRows[0];
        if(!paired)return res.status(401).json({error:'This player setup link is invalid or expired'});
        setPlayerCookie(res,row.id,rawDeviceToken);
        return res.status(200).json({
          ok:true,
          paired:true,
          playerId:String(paired.player_id||''),
          playerName:String(paired.player_name||''),
          fullName:String(paired.full_name||'')
        });
      }

      if(action==='reset-player-access'){
        const user=await requireTeamCaptain(req,res,teamSlug);if(!user)return;
        const playerId=String(req.body&&req.body.playerId||'').trim().slice(0,120);
        if(!playerId)return res.status(400).json({error:'A player ID is required'});
        const player=(state.players||[]).find(p=>p&&String(p.id||'')===playerId);
        if(!player)return res.status(404).json({error:'Player was not found on the roster'});
        const resetRows=await sql`
          WITH sessions AS (
            UPDATE player_device_sessions
            SET revoked_at=now()
            WHERE team_id=${row.id}
              AND player_id=${playerId}
              AND revoked_at IS NULL
              AND expires_at>now()
            RETURNING 1
          ),
          invites AS (
            UPDATE player_pairing_invites
            SET revoked_at=now()
            WHERE team_id=${row.id}
              AND player_id=${playerId}
              AND used_at IS NULL
              AND revoked_at IS NULL
            RETURNING 1
          )
          SELECT
            (SELECT count(*) FROM sessions) AS revoked_sessions,
            (SELECT count(*) FROM invites) AS revoked_invites
        `;
        const counts=resetRows[0]||{};
        return res.status(200).json({
          ok:true,
          playerId,
          revokedSessions:Number(counts.revoked_sessions||0),
          revokedInvites:Number(counts.revoked_invites||0)
        });
      }

      const authenticatedPlayer=await resolveAuthenticatedPlayer(req,row,state);
      if(!authenticatedPlayer)return res.status(401).json({
        error:'Your player access needs to be set up again. Ask your captain for a new setup link.',
        playerAccessRequired:true
      });
      const playerId=authenticatedPlayer.playerId;
      const playerName=authenticatedPlayer.playerName;

      if(action==='subscribe'){
        const sub=req.body&&req.body.subscription;
        if(!sub||typeof sub.endpoint!=='string'||!sub.endpoint.startsWith('https://')||!sub.keys||!sub.keys.p256dh||!sub.keys.auth)return res.status(400).json({error:'A valid push subscription is required'});
        await ensurePushConfig(sql);
        const existing=state._pushSubscriptions&&state._pushSubscriptions[playerName];
        let list=Array.isArray(existing)?existing:[];
        list=list.filter(x=>x&&x.subscription&&x.subscription.endpoint!==sub.endpoint);
        list.push({subscription:sub,updatedAt:new Date().toISOString()});list=list.slice(-3);
        const payload=JSON.stringify(list);
        await sql`UPDATE team_states SET state=jsonb_set(state,'{_pushSubscriptions}',COALESCE(state->'_pushSubscriptions','{}'::jsonb)||jsonb_build_object(${playerName}::text,${payload}::jsonb),true),updated_at=now() WHERE team_id=${row.id}`;
        return res.status(200).json({ok:true,remindersEnabled:true});
      }

      if(action==='attendance-response'){
        const gameDate=String(req.body&&req.body.gameDate||''),status=String(req.body&&req.body.status||'');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(gameDate))return res.status(400).json({error:'A valid game date is required'});
        if(!ATTENDANCE.has(status))return res.status(400).json({error:'Answer Yes, No, or Not sure'});
        const games=(state.events||[]).filter(e=>e&&e.type==='Game'&&e.date===gameDate);if(!games.length)return res.status(400).json({error:'No game is scheduled for that date'});
        const note=String(req.body&&req.body.note||'').trim().slice(0,160);
        const answer={status,respondedAt:new Date().toISOString(),...(note?{note}:{})},payload=JSON.stringify(answer);
        await sql`UPDATE team_states SET state=jsonb_set(state,'{availability}',COALESCE(state->'availability','{}'::jsonb)||jsonb_build_object(${gameDate}::text,COALESCE(state->'availability'->(${gameDate}::text),'{}'::jsonb)||jsonb_build_object(${playerName}::text,${payload}::jsonb)),true),updated_at=now() WHERE team_id=${row.id}`;
        return res.status(200).json({ok:true,gameDate,playerName,status,note:answer.note||'',respondedAt:answer.respondedAt});
      }

      if(action==='field-position'){
        return res.status(403).json({error:'Live field assignments are Captain-controlled. Refresh Player View to see the latest lineup.'});
      }

      const accessStatus=req.body&&req.body.accessStatus==='installed'?'installed':'browser';
      const now=new Date().toISOString();const current=(state.appAccess&&state.appAccess[playerName])||{};
      const next={...current,playerName,browserSeenAt:current.browserSeenAt||now,lastSeenAt:now,...(accessStatus==='installed'?{installedAt:current.installedAt||now}:{})};
      const payload=JSON.stringify(next);
      await sql`UPDATE team_states SET state=jsonb_set(state,'{appAccess}',COALESCE(state->'appAccess','{}'::jsonb)||jsonb_build_object(${playerName}::text,${payload}::jsonb),true),updated_at=now() WHERE team_id=${row.id}`;
      return res.status(200).json({ok:true,accessStatus,playerId,playerName});
    }

    if (req.method === 'PUT') {
      const user=await requireTeamCaptain(req,res,teamSlug);if(!user)return;
      const next=req.body&&req.body.state;
      if(!next||typeof next!=='object'||Array.isArray(next))return res.status(400).json({error:'A valid state object is required'});
      const nextTeam=next.team&&typeof next.team==='object'&&!Array.isArray(next.team)?next.team:{};
      const nextChatUrl=typeof nextTeam.chatUrl==='string'?nextTeam.chatUrl.trim():'';
      const nextTimeZone=typeof nextTeam.timeZone==='string'?nextTeam.timeZone.trim():'';
      if(nextTimeZone){try{new Intl.DateTimeFormat('en-US',{timeZone:nextTimeZone}).format(new Date());}catch(_){return res.status(400).json({error:'Team time zone is invalid'});}}
      if(nextChatUrl&&!isSafeExternalUrl(nextChatUrl))return res.status(400).json({error:'Team chat link must start with https:// or http://'});
      const nextResources=Array.isArray(next.resources)?next.resources:[];
      for(const resource of nextResources){
        const resourceUrl=resource&&typeof resource.url==='string'?resource.url.trim():'';
        if(resourceUrl&&!isSafeExternalUrl(resourceUrl))return res.status(400).json({error:'Resource links must start with https:// or http://'});
      }
      if(!Array.isArray(next.players))return res.status(400).json({error:'A valid roster array is required'});
      const seenPlayerIds=new Set();
      const seenPlayerNames=new Set();
      for(const player of next.players){
        if(!player||typeof player!=='object'||Array.isArray(player))return res.status(400).json({error:'Every roster player must be an object'});
        const rawId=typeof player.id==='string'?player.id.trim():'';
        if(!rawId)return res.status(400).json({error:'Every roster player must have a stable player ID'});
        if(player.id!==rawId)return res.status(400).json({error:'Player IDs must not have surrounding whitespace'});
        if(seenPlayerIds.has(rawId))return res.status(400).json({error:'Player IDs must be unique within the team'});
        seenPlayerIds.add(rawId);
        const rawName=typeof player.name==='string'?player.name.trim():'';
        if(!rawName)return res.status(400).json({error:'Every roster player must have a name'});
        if(player.name!==rawName)return res.status(400).json({error:'Player names must not have surrounding whitespace'});
        const nameKey=rawName.toLocaleLowerCase('en-US');
        if(seenPlayerNames.has(nameKey))return res.status(400).json({error:'Player names must be unique within the team'});
        seenPlayerNames.add(nameKey);
      }
      const previousState=row.state||{};
      const scheduleChangeSet=scheduleChanges(previousState,next);
      const removedPlayers=pruneRemovedPlayerState(previousState,next);
      const identity=preserveRenamedPlayerIdentity(row.state||{},next);
      const preservedAppAccess=JSON.stringify(identity.appAccess);
      const preservedAvailability=JSON.stringify(identity.availability);
      const preservedPushSubscriptions=JSON.stringify(identity.pushSubscriptions);
      const expectedUpdatedAt=String(req.body&&req.body.expectedUpdatedAt||'').trim();
      if(expectedUpdatedAt&&Number.isNaN(Date.parse(expectedUpdatedAt)))return res.status(400).json({error:'The expected team-state version is invalid'});
      const payload=JSON.stringify(next);if(payload.length>1000000)return res.status(413).json({error:'Team state is too large'});
      let rows;
      if(expectedUpdatedAt){
        rows=await sql`
          UPDATE team_states SET state=${payload}::jsonb||jsonb_build_object(
            'appAccess',${preservedAppAccess}::jsonb,
            'availability',${preservedAvailability}::jsonb,
            '_pushConfig',COALESCE(state->'_pushConfig','{}'::jsonb),
            '_pushSubscriptions',${preservedPushSubscriptions}::jsonb,
            '_pushReminderLog',COALESCE(state->'_pushReminderLog','{}'::jsonb),
            '_pilotFeedback',COALESCE(state->'_pilotFeedback','[]'::jsonb),
            '_captainAlerts',COALESCE(state->'_captainAlerts','[]'::jsonb),
            '__feildhaus_pilot_gate__',COALESCE(state->'__feildhaus_pilot_gate__','{}'::jsonb)
          ),updated_at=now()
          WHERE team_id=${row.id} AND updated_at=${expectedUpdatedAt}::timestamptz
          RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at
        `;
        if(!rows.length){
          const current=await loadState(sql,teamSlug);
          return res.status(409).json({
            error:'Team state changed while you were editing',conflict:true,
            state:captainState(current&&current.state||{}),updatedAt:current&&current.updated_at
          });
        }
      }else{
        rows=await sql`
          UPDATE team_states SET state=${payload}::jsonb||jsonb_build_object(
            'appAccess',${preservedAppAccess}::jsonb,
            'availability',${preservedAvailability}::jsonb,
            '_pushConfig',COALESCE(state->'_pushConfig','{}'::jsonb),
            '_pushSubscriptions',${preservedPushSubscriptions}::jsonb,
            '_pushReminderLog',COALESCE(state->'_pushReminderLog','{}'::jsonb),
            '_pilotFeedback',COALESCE(state->'_pilotFeedback','[]'::jsonb),
            '_captainAlerts',COALESCE(state->'_captainAlerts','[]'::jsonb),
            '__feildhaus_pilot_gate__',COALESCE(state->'__feildhaus_pilot_gate__','{}'::jsonb)
          ),updated_at=now() WHERE team_id=${row.id} RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at
        `;
      }
      if(rows.length&&removedPlayers.length){
        for(const removed of removedPlayers){
          await sql`UPDATE player_device_sessions SET revoked_at=now() WHERE team_id=${row.id} AND player_id=${removed.id} AND revoked_at IS NULL`;
          await sql`UPDATE player_pairing_invites SET revoked_at=now() WHERE team_id=${row.id} AND player_id=${removed.id} AND used_at IS NULL AND revoked_at IS NULL`;
        }
      }
      let scheduleAlerts={sent:0,failed:0};
      if(rows.length&&scheduleChangeSet.length){try{scheduleAlerts=await sendScheduleChangeAlerts(sql,row,previousState,next,scheduleChangeSet);}catch(error){scheduleAlerts={sent:0,failed:0,error:error.message||'Schedule alert failed'};}}
      return res.status(200).json({ok:true,updatedAt:rows[0]&&rows[0].updated_at,updatedBy:user.display_name,teamSlug,removedPlayers:removedPlayers.map(p=>p.id),scheduleChanges:scheduleChangeSet.length,scheduleAlerts});
    }

    return res.status(405).json({error:'Method not allowed'});
  } catch (error) {
    const status=error.code==='DATABASE_NOT_CONFIGURED'?503:500;
    return res.status(status).json({error:error.message||'Shared state request failed'});
  }
};
