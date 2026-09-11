const { getSql } = require('./api/_db');
const { requestedTeamSlug, getTeam, getCaptainTeam, resolveAuthenticatedPlayer } = require('./api/_auth');
const { handleRulesCalls, bindActiveRulesetForGame, resolveRulesContext } = require('./rules-calls-handler');

let tableReady = null;

function ensureTable(sql) {
  if (!tableReady) {
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS umpire_game_states (
        team_id text NOT NULL,
        event_key text NOT NULL,
        game_state jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (team_id, event_key)
      )
    `.catch(error => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

function clean(value) { return String(value || '').trim(); }
function sameName(a, b) {
  const x = clean(a).toLowerCase(), y = clean(b).toLowerCase();
  return !!x && x === y;
}
function explicitEventKey(event) {
  return clean(event && (event.id || event.sourceUid)).slice(0, 180);
}
function eventKey(event) {
  const explicit = explicitEventKey(event);
  if (explicit) return explicit;
  return [event && event.date, event && event.time, event && event.title].map(clean).filter(Boolean).join('|').slice(0, 180);
}
function officiatingEvents(state) {
  return (Array.isArray(state && state.events) ? state.events : []).filter(event => event && event.type === 'Officiating' && eventKey(event));
}
function publicEvent(event) {
  return {
    eventId:eventKey(event),
    rulesGameId:explicitEventKey(event),
    title:clean(event.title||'Officiating'),
    date:clean(event.date),time:clean(event.time),location:clean(event.location),
    umpire:clean(event.umpire),lineRef1:clean(event.lineRef1),lineRef2:clean(event.lineRef2)
  };
}
function fallbackLimits(){return{balls:4,strikes:3,fouls:4,outs:3};}
function countLimits(context){
  const raw=context&&context.counts||{},fallback=fallbackLimits();
  const limit=(key)=>{const n=Number(raw[key]);return Number.isInteger(n)&&n>0&&n<=20?n:fallback[key];};
  return{balls:limit('balls'),strikes:limit('strikes'),fouls:limit('fouls'),outs:limit('outs')};
}
async function safeRulesContext(sql,teamId,gameId='',bind=false){
  try{
    if(bind&&gameId)await bindActiveRulesetForGame(sql,teamId,gameId);
    return await resolveRulesContext(sql,teamId,gameId,false);
  }catch(error){
    if(String(error&&error.code)==='42P01')return null;
    throw error;
  }
}
function defaultGame() {
  return { teamAName:'', teamBName:'', teamAScore:0, teamBScore:0, balls:0, strikes:0, fouls:0, outs:0, inning:1, kickingTeam:'b', updatedAt:null, updatedBy:'' };
}
function normalizeGame(value,limits=fallbackLimits()) {
  const raw=value&&typeof value==='object'?value:{};
  const number=(v,min,max,fallback)=>{const n=Number(v);return Number.isInteger(n)?Math.max(min,Math.min(max,n)):fallback;};
  return {
    ...defaultGame(),
    teamAName:clean(raw.teamAName).slice(0,80),teamBName:clean(raw.teamBName).slice(0,80),
    teamAScore:number(raw.teamAScore,0,99,0),teamBScore:number(raw.teamBScore,0,99,0),
    balls:number(raw.balls,0,limits.balls,0),strikes:number(raw.strikes,0,limits.strikes,0),
    fouls:number(raw.fouls,0,limits.fouls,0),outs:number(raw.outs,0,limits.outs,0),
    inning:number(raw.inning,1,12,1),kickingTeam:raw.kickingTeam==='a'?'a':'b',
    updatedAt:raw.updatedAt||null,updatedBy:clean(raw.updatedBy).slice(0,120)
  };
}
function validatePatch(raw,limits=fallbackLimits()) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw Object.assign(new Error('A valid umpire game update is required'),{status:400});
  const patch={};
  const intField=(key,min,max)=>{if(!Object.prototype.hasOwnProperty.call(raw,key))return;const n=Number(raw[key]);if(!Number.isInteger(n)||n<min||n>max)throw Object.assign(new Error(`${key} is outside the allowed range`),{status:400});patch[key]=n;};
  if(Object.prototype.hasOwnProperty.call(raw,'teamAName'))patch.teamAName=clean(raw.teamAName).slice(0,80);
  if(Object.prototype.hasOwnProperty.call(raw,'teamBName'))patch.teamBName=clean(raw.teamBName).slice(0,80);
  intField('teamAScore',0,99);intField('teamBScore',0,99);
  intField('balls',0,limits.balls);intField('strikes',0,limits.strikes);intField('fouls',0,limits.fouls);intField('outs',0,limits.outs);
  intField('inning',1,12);
  if(Object.prototype.hasOwnProperty.call(raw,'kickingTeam')){if(!['a','b'].includes(raw.kickingTeam))throw Object.assign(new Error('Choose which team is kicking'),{status:400});patch.kickingTeam=raw.kickingTeam;}
  if(!Object.keys(patch).length)throw Object.assign(new Error('Nothing changed'),{status:400});
  return patch;
}
async function actorFor(req,row,teamSlug){
  const captain=await getCaptainTeam(req,teamSlug);
  if(captain)return{kind:'captain',name:clean(captain.display_name||captain.email||'Captain')};
  const player=await resolveAuthenticatedPlayer(req,row,row.state||{});if(!player)return null;
  return{kind:'player',name:clean(player.playerName),playerId:clean(player.playerId)};
}
function allowedEvents(state,actor){const all=officiatingEvents(state);return actor.kind==='captain'?all:all.filter(event=>sameName(event.umpire,actor.name));}

module.exports=async function umpireGameHandler(req,res){
  try{
    if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
    const sql=getSql(),teamSlug=requestedTeamSlug(req),row=await getTeam(sql,teamSlug);
    if(!row)return res.status(404).json({error:'Team was not found'});
    const actor=await actorFor(req,row,teamSlug);
    if(!actor)return res.status(401).json({error:'Your player access needs to be set up again. Ask your captain for a new setup link.',playerAccessRequired:true});
    const events=allowedEvents(row.state||{},actor),allowedKeys=new Set(events.map(eventKey)),teamId=String(row.id);

    if(req.method==='GET'&&clean(req.query&&req.query.rules)){
      if(actor.kind!=='captain'&&!events.length)return res.status(403).json({error:'Rules & Calls is available to the assigned umpire for this team'});
      const requestedGameId=clean(req.query&&req.query.rulesGameId).slice(0,180);
      let gameId='';
      if(requestedGameId){
        const allowedEvent=events.find(event=>explicitEventKey(event)===requestedGameId);
        if(!allowedEvent)return res.status(403).json({error:'That officiating game is not available to this umpire'});
        gameId=requestedGameId;
      }
      res.setHeader('Cache-Control','no-store');
      return handleRulesCalls({req,res,sql,row,actor,gameId});
    }

    await ensureTable(sql);

    if(req.method==='GET'){
      const limitsByEvent={};
      for(const event of events){
        const key=eventKey(event),stableId=explicitEventKey(event);
        const context=await safeRulesContext(sql,teamId,stableId,false);
        limitsByEvent[key]=countLimits(context);
      }
      const rows=await sql`SELECT event_key,game_state,updated_at FROM umpire_game_states WHERE team_id=${teamId} ORDER BY updated_at DESC LIMIT 100`;
      const games={};
      for(const item of rows){
        const key=String(item.event_key||'');if(!allowedKeys.has(key))continue;
        games[key]={...normalizeGame(item.game_state,limitsByEvent[key]||fallbackLimits()),updatedAt:item.updated_at||(item.game_state&&item.game_state.updatedAt)||null};
      }
      res.setHeader('Cache-Control','no-store');
      return res.status(200).json({ok:true,role:actor.kind,actorName:actor.name,events:events.map(publicEvent),games,countLimitsByEvent:limitsByEvent});
    }

    const requestedEventId=clean(req.body&&req.body.eventId).slice(0,180);
    if(!requestedEventId)return res.status(400).json({error:'Choose an officiating game first'});
    const event=events.find(item=>eventKey(item)===requestedEventId);
    if(!event)return res.status(403).json({error:actor.kind==='captain'?'That officiating slot was not found':'You are not assigned as the umpire for that officiating slot'});

    const stableId=explicitEventKey(event);
    const context=await safeRulesContext(sql,teamId,stableId,!!stableId);
    const limits=countLimits(context);
    const patch=validatePatch(req.body&&req.body.patch,limits),now=new Date().toISOString();
    const serverPatch={...patch,updatedAt:now,updatedBy:actor.name||(actor.kind==='captain'?'Captain':'Umpire')},payload=JSON.stringify(serverPatch);
    const updated=await sql`
      INSERT INTO umpire_game_states(team_id,event_key,game_state,updated_at)
      VALUES(${teamId},${requestedEventId},${payload}::jsonb,now())
      ON CONFLICT(team_id,event_key) DO UPDATE
      SET game_state=COALESCE(umpire_game_states.game_state,'{}'::jsonb)||EXCLUDED.game_state,updated_at=now()
      RETURNING game_state,updated_at
    `;
    const saved=updated[0]||{};
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,event:publicEvent(event),countLimits:limits,game:{...normalizeGame(saved.game_state,limits),updatedAt:saved.updated_at||now}});
  }catch(error){
    const status=Number(error&&error.status)||(error.code==='DATABASE_NOT_CONFIGURED'?503:500);
    return res.status(status).json({error:error.message||'Umpire game request failed'});
  }
};
