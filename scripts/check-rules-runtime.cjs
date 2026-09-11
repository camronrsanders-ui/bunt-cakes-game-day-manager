const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Pool,neonConfig}=require('@neondatabase/serverless');
neonConfig.webSocketConstructor=WebSocket;
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const sql=async(parts,...values)=>(await pool.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),values)).rows;
require('../api/_db').getSql=()=>sql;
const rules=require('../rules-calls-handler');
const umpire=require('../umpire-game-handler');
const stateHandler=require('../api/team-state');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
async function call(handler,method,cookie='',query={},body={}){
 const res={statusCode:200,setHeader(){},status(s){this.statusCode=s;return this},json(body){this.body=JSON.parse(JSON.stringify(body));return this}};
 await handler({method,headers:{cookie},query,body},res);return res;
}
(async()=>{
 assert.equal(new URL(process.env.DATABASE_URL).hostname,process.env.TEST_DATABASE_HOST,'Explicit isolated test database host required');

 const [team]=await sql`SELECT t.id,t.slug,ts.state FROM teams t JOIN team_states ts ON ts.team_id=t.id WHERE t.slug='those-dirty-bunt-cakes'`;
 const meta=await rules.activeMetadata(sql,team.id);assert.equal(meta.status,'active');
 const vid=meta.rulesetVersionId;
 assert.equal((await rules.loadSignals(sql,vid)).length,7);
 for(const q of ['overthrow','tag','strike','fair']){
  const hits=await rules.searchScenarios(sql,vid,q);assert(hits.length,q);
  const detail=await rules.loadRuling(sql,vid,hits[0].scenario_id);assert(detail.sources.length,q+' sources');
 }
 const all=await sql`SELECT id FROM ruling_scenarios WHERE ruleset_version_id=${vid}`;
 let visuals=0;for(const row of all){const d=await rules.loadRuling(sql,vid,row.id);assert(d.sources.length);if(d.visual_definition){assert(d.visual_definition.steps.length>=3);visuals++}}
 assert(visuals>=9);console.log('PASS rules search, all 13 ruling details, 9 visuals, seven signals');
 await assert.rejects(()=>sql`UPDATE rules SET quick_summary=quick_summary WHERE ruleset_version_id=${vid}`,/immutable/);
 const token=crypto.randomBytes(32).toString('base64url');
 const [captain]=await sql`INSERT INTO captain_users(email,display_name,password_hash,password_salt) VALUES(${token+'@example.invalid'},'QA captain','invalid','invalid') RETURNING id`;
 await sql`INSERT INTO captain_team_memberships(captain_user_id,team_id) VALUES(${captain.id},${team.id})`;
 await sql`INSERT INTO captain_sessions(token_hash,captain_user_id,expires_at) VALUES(${hash(token)},${captain.id},now()+interval '1 hour')`;
 const cookie='bc_captain='+token;
 const playerToken=crypto.randomBytes(32).toString('base64url'),player=team.state.players[0];
 await sql`INSERT INTO player_device_sessions(token_hash,team_id,player_id,expires_at) VALUES(${hash(playerToken)},${team.id},${player.id},now()+interval '1 hour')`;
 const pc='bc_player_'+team.id.replace(/-/g,'')+'='+playerToken;
 const gameId='qa-'+crypto.randomUUID();
 let read=await call(stateHandler,'GET',cookie);assert.equal(read.statusCode,200);
 read.body.state.events.push({id:gameId,type:'Officiating',date:'2026-09-13',title:'QA only',umpire:player.name});
 read.body.state.innings['1']['First Base']='QA Rotation Player';
 let save=await call(stateHandler,'PUT',cookie,{}, {state:read.body.state,expectedUpdatedAt:read.body.updatedAt});assert.equal(save.statusCode,200,JSON.stringify(save.body));
 let publicRead=await call(stateHandler,'GET',pc);assert.equal(publicRead.body.state.innings['1']['First Base'],'QA Rotation Player');
 read.body.state.innings['1']['First Base']='QA Second Save';
 const second=await call(stateHandler,'PUT',cookie,{}, {state:read.body.state,expectedUpdatedAt:save.body.updatedAt});
 assert.equal(second.statusCode,200,'Second save should accept the exact returned version: '+JSON.stringify(second.body.error));
 assert.equal((await call(stateHandler,'GET',pc)).body.state.innings['1']['First Base'],'QA Second Save');
 const stale=await call(stateHandler,'PUT',cookie,{}, {state:read.body.state,expectedUpdatedAt:read.body.updatedAt});assert.equal(stale.statusCode,409);
 assert.equal((await call(stateHandler,'PUT','',{}, {state:read.body.state})).statusCode,403);
 console.log('PASS consecutive captain saves, player readback, stale-write rejection, unauthorized write rejection');
 assert.equal((await call(umpire,'GET','',{rules:'active'})).statusCode,401);
 assert.equal((await call(umpire,'GET',pc,{rules:'active',rulesGameId:'not-assigned'})).statusCode,403);
 const result=await call(umpire,'GET',pc,{rules:'search',q:'overthrow',rulesGameId:gameId});assert.equal(result.statusCode,200,JSON.stringify(result.body));assert(result.body.results.length);
 const patch=await call(umpire,'POST',pc,{}, {eventId:gameId,patch:{strikes:2}});assert.equal(patch.statusCode,200,JSON.stringify(patch.body));assert.equal(patch.body.game.strikes,2);
 const captainRead=await call(umpire,'GET',cookie);assert.equal(captainRead.body.games[gameId].strikes,2);
 const invalid=await call(umpire,'POST',pc,{}, {eventId:gameId,patch:{strikes:meta.counts.strikes+1}});assert.equal(invalid.statusCode,400);
 const legacy=await call(umpire,'GET',cookie,{rules:'active'});assert.equal(legacy.statusCode,200);
 assert.equal((await sql`SELECT count(*)::int AS n FROM game_ruleset_bindings WHERE team_id=${team.id}::text AND game_id=${gameId}`)[0].n,1);
 await assert.rejects(()=>sql`UPDATE game_ruleset_bindings SET game_id=game_id WHERE team_id=${team.id}::text AND game_id=${gameId}`,/immutable/);
 await sql`UPDATE ruleset_versions SET status='superseded' WHERE id=${vid}`;
 assert.equal((await rules.resolveRulesContext(sql,team.id,gameId)).rulesetVersionId,vid);
 assert.equal(await rules.activeMetadata(sql,team.id),null);
 console.log('PASS assigned umpire authorization, strikes persisted/read by captain, configured limits, historical rules after superseding');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>pool.end());
