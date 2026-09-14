const { getSql } = require('./_db');
const { DEFAULT_TEAM_SLUG, getCaptain, getCaptainTeam } = require('./_auth');

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

function safeArray(v){return Array.isArray(v)?v:[]}
function safeObject(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function metricFor(row){
  const state=safeObject(row.state);
  const players=safeArray(state.players);
  const events=safeArray(state.events);
  const access=safeObject(state.appAccess);
  const availability=safeObject(state.availability);
  const feedback=safeArray(state._pilotFeedback);
  const responses=Object.values(availability).reduce((sum,answers)=>{
    const obj=safeObject(answers);
    return sum+Object.keys(obj).filter(k=>k!=='_captains').length+Object.keys(safeObject(obj._captains)).length;
  },0);
  const today=new Date().toISOString().slice(0,10);
  return {
    id:row.id,
    slug:row.slug,
    name:String(state.team&&state.team.name||state.team&&state.team.shortName||'Untitled Team'),
    organization:String(state.team&&state.team.organization||''),
    sport:String(state.team&&state.team.sport||'Kickball'),
    plan:row.plan,
    billingStatus:row.billing_status,
    active:row.active,
    foundingTeam:row.slug===DEFAULT_TEAM_SLUG,
    rosterPlayers:players.length,
    activePlayers:Object.values(access).filter(x=>x&&x.lastSeenAt).length,
    installs:Object.values(access).filter(x=>x&&x.installedAt).length,
    rsvpResponses:responses,
    upcomingGames:events.filter(e=>e&&e.type==='Game'&&e.date&&e.date>=today).length,
    feedbackCount:feedback.length,
    captainCount:Number(row.captain_count||0),
    updatedAt:row.updated_at||null
  };
}

module.exports=async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{
    const admin=await requirePlatformAdmin(req,res);if(!admin)return;
    const sql=getSql();
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
    const teams=rows.map(metricFor);
    const feedbackRows=await sql`
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
      a.teams++;
      a.rosterPlayers+=t.rosterPlayers;
      a.activePlayers+=t.activePlayers;
      a.installs+=t.installs;
      a.rsvpResponses+=t.rsvpResponses;
      a.upcomingGames+=t.upcomingGames;
      a.feedback+=t.feedbackCount;
      return a;
    },{teams:0,rosterPlayers:0,activePlayers:0,installs:0,rsvpResponses:0,upcomingGames:0,feedback:0});
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({
      ok:true,
      product:'FeildHaus',
      pilot:'Founding Teams Pilot',
      viewer:{displayName:admin.account.display_name},
      totals,
      teams,
      feedback:feedbackRows
    });
  }catch(error){
    const status=error.code==='DATABASE_NOT_CONFIGURED'?503:500;
    return res.status(status).json({error:error.message||'Admin dashboard failed'});
  }
};
