const { getSql } = require('./api/_db');
const { DEFAULT_TEAM_SLUG, hashToken, getCaptain, getCaptainTeam } = require('./api/_auth');

function safeArray(v){ return Array.isArray(v) ? v : []; }
function safeObject(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

async function requirePlatformAdmin(req,res){
  const account=await getCaptain(req);
  if(!account){
    res.status(401).json({error:'Captain sign-in required',signInUrl:'/start'});
    return null;
  }
  const founder=await getCaptainTeam(req,DEFAULT_TEAM_SLUG);
  if(!founder||founder.role!=='owner'){
    res.status(403).json({error:'FeildHaus Admin access is limited to the Founding Team owner'});
    return null;
  }
  return {account,founder};
}

module.exports=async function adminHandler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  if(!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  const admin=await requirePlatformAdmin(req,res); if(!admin) return;
  const sql=getSql();
  if(req.method==='POST'){
    const action=String(req.body&&req.body.action||'');
    if(action==='set-pilot-code'){
      const code=String(req.body&&req.body.code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
      if(code.length<6||code.length>24)return res.status(400).json({error:'Use an invite code between 6 and 24 letters/numbers'});
      const payload=JSON.stringify({enabled:true,codeHash:hashToken(code),updatedAt:new Date().toISOString()});
      await sql`UPDATE team_states SET state=jsonb_set(state,'{__feildhaus_pilot_gate__}',${payload}::jsonb,true),updated_at=now() WHERE team_id=${admin.founder.team_id}`;
      return res.status(200).json({ok:true,enabled:true});
    }
    if(action==='close-pilot-enrollment'){
      const payload=JSON.stringify({enabled:false,codeHash:'',updatedAt:new Date().toISOString()});
      await sql`UPDATE team_states SET state=jsonb_set(state,'{__feildhaus_pilot_gate__}',${payload}::jsonb,true),updated_at=now() WHERE team_id=${admin.founder.team_id}`;
      return res.status(200).json({ok:true,enabled:false});
    }
    return res.status(400).json({error:'Unknown admin action'});
  }
  const rows=await sql`
    SELECT t.id,t.slug,t.active,t.plan,t.billing_status,ts.state,
           to_char(ts.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at,
           COUNT(m.*) FILTER (WHERE m.active=true) AS captain_count
    FROM teams t
    LEFT JOIN team_states ts ON ts.team_id=t.id
    LEFT JOIN captain_team_memberships m ON m.team_id=t.id
    GROUP BY t.id,t.slug,t.active,t.plan,t.billing_status,ts.state,ts.updated_at,t.created_at
    ORDER BY t.created_at
  `;
  const today=new Date().toISOString().slice(0,10);
  const teams=rows.map(row=>{
    const state=safeObject(row.state);
    const players=safeArray(state.players);
    const events=safeArray(state.events);
    const access=safeObject(state.appAccess);
    const availability=safeObject(state.availability);
    const feedback=safeArray(state._pilotFeedback);
    const rsvpResponses=Object.values(availability).reduce((sum,answers)=>{
      const obj=safeObject(answers);
      return sum+Object.keys(obj).filter(k=>k!=='_captains').length+Object.keys(safeObject(obj._captains)).length;
    },0);
    const teamInfo=safeObject(state.team);
    const innings=safeObject(state.innings);
    const assignedFieldSpots=Object.values(innings).reduce((sum,inning)=>sum+Object.values(safeObject(inning)).filter(Boolean).length,0);
    const upcomingGames=events.filter(e=>e&&e.type==='Game'&&e.date&&e.date>=today).length;
    const gameResults=safeArray(state.gameResults);
    const completedGames=gameResults.length;
    const lastGameDate=gameResults.map(r=>String(r&&r.date||'')).filter(Boolean).sort().pop()||'';
    const captainCount=Number(row.captain_count||0);
    const checklist={
      profile:Boolean(String(teamInfo.name||teamInfo.shortName||'').trim()),
      roster:players.length>0,
      schedule:upcomingGames>0,
      fieldPlan:assignedFieldSpots>0,
      owner:captainCount>0
    };
    const completed=Object.values(checklist).filter(Boolean).length;
    const readiness=Math.round(completed/Object.keys(checklist).length*100);
    const readinessStatus=readiness>=80?'Pilot ready':readiness>=40?'Setup in progress':'Needs setup';
    const issues=[];
    if(!checklist.profile)issues.push('Team profile');
    if(!checklist.roster)issues.push('Roster');
    if(!checklist.schedule)issues.push('Upcoming game');
    if(!checklist.fieldPlan)issues.push('Field plan');
    if(!checklist.owner)issues.push('Owner access');
    return {
      id:row.id,slug:row.slug,
      name:String(state.team&&state.team.name||state.team&&state.team.shortName||'Untitled Team'),
      organization:String(state.team&&state.team.organization||''),
      sport:String(state.team&&state.team.sport||'Kickball'),
      plan:row.plan,billingStatus:row.billing_status,active:row.active,
      foundingTeam:row.slug===DEFAULT_TEAM_SLUG,
      rosterPlayers:players.length,
      activePlayers:Object.values(access).filter(x=>x&&x.lastSeenAt).length,
      installs:Object.values(access).filter(x=>x&&x.installedAt).length,
      rsvpResponses,
      upcomingGames,
      completedGames,
      lastGameDate,
      assignedFieldSpots,
      feedbackCount:feedback.length,
      captainCount,
      readiness,
      readinessStatus,
      readinessChecklist:checklist,
      readinessIssues:issues,
      updatedAt:row.updated_at||null
    };
  });
  const feedback=await sql`
    SELECT t.slug,
           COALESCE(NULLIF(ts.state->'team'->>'name',''),NULLIF(ts.state->'team'->>'shortName',''),'Untitled Team') AS team_name,
           f.item->>'category' AS category,
           f.item->>'message' AS message,
           f.item->>'actor' AS actor,
           f.item->>'screen' AS screen,
           f.item->>'createdAt' AS created_at
    FROM teams t
    JOIN team_states ts ON ts.team_id=t.id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts.state->'_pilotFeedback','[]'::jsonb)) AS f(item)
    WHERE t.active=true
    ORDER BY (f.item->>'createdAt') DESC NULLS LAST
    LIMIT 100
  `;
  const totals=teams.reduce((a,t)=>{
    a.teams++; a.rosterPlayers+=t.rosterPlayers; a.activePlayers+=t.activePlayers;
    a.installs+=t.installs; a.rsvpResponses+=t.rsvpResponses; a.upcomingGames+=t.upcomingGames; a.completedGames+=t.completedGames; a.feedback+=t.feedbackCount;
    if(t.readiness>=80)a.readyTeams++;
    return a;
  },{teams:0,readyTeams:0,rosterPlayers:0,activePlayers:0,installs:0,rsvpResponses:0,upcomingGames:0,completedGames:0,feedback:0});
  res.setHeader('Cache-Control','no-store');
  const founderState=rows.find(r=>r.slug===DEFAULT_TEAM_SLUG)&&safeObject(rows.find(r=>r.slug===DEFAULT_TEAM_SLUG).state)||{};
  const gate=safeObject(founderState.__feildhaus_pilot_gate__);
  return res.status(200).json({
    ok:true,product:'FeildHaus',pilot:'Founding Teams Pilot',enrollment:{enabled:Boolean(gate.enabled),configured:Boolean(gate.codeHash)},
    viewer:{displayName:admin.account.display_name},totals,teams,feedback
  });
};
