const { getSql } = require('./_db');
const { requestedTeamSlug, getCaptain, requireTeamCaptain } = require('./_auth');

function clearSessionCookie(res){
  res.setHeader('Set-Cookie','bc_captain=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const sql=getSql();
    const action=String(req.body&&req.body.action||'');

    if(action==='delete-account'){
      const account=await getCaptain(req);
      if(!account) return res.status(401).json({error:'Captain login required'});
      if(String(req.body&&req.body.confirm||'')!=='DELETE MY ACCOUNT'){
        return res.status(400).json({error:'Type DELETE MY ACCOUNT exactly to confirm'});
      }

      const deletedTeams=await sql`
        DELETE FROM teams t
        USING captain_team_memberships m
        WHERE m.team_id=t.id
          AND m.captain_user_id=${account.id}
          AND m.role='owner'
        RETURNING t.slug
      `;
      await sql`DELETE FROM captain_sessions WHERE captain_user_id=${account.id}`;
      await sql`DELETE FROM captain_team_memberships WHERE captain_user_id=${account.id}`;
      await sql`DELETE FROM captain_users WHERE id=${account.id}`;
      clearSessionCookie(res);
      return res.status(200).json({ok:true,deletedAccount:true,deletedTeams:deletedTeams.map(t=>t.slug)});
    }

    if(action==='delete-team'){
      const teamSlug=requestedTeamSlug(req);
      const user=await requireTeamCaptain(req,res,teamSlug);if(!user)return;
      if(user.role!=='owner') return res.status(403).json({error:'Only the team owner can delete this team'});
      if(String(req.body&&req.body.confirmSlug||'')!==teamSlug){
        return res.status(400).json({error:`Type ${teamSlug} exactly to confirm`});
      }

      await sql`DELETE FROM teams WHERE id=${user.team_id}`;
      const remaining=await sql`
        SELECT t.slug,COALESCE(NULLIF(ts.state->'team'->>'name',''),NULLIF(ts.state->'team'->>'shortName',''),'Untitled Team') AS name,m.role
        FROM captain_team_memberships m
        JOIN teams t ON t.id=m.team_id
        LEFT JOIN team_states ts ON ts.team_id=t.id
        WHERE m.captain_user_id=${user.id} AND m.active=true AND t.active=true
        ORDER BY t.created_at,t.slug
      `;
      return res.status(200).json({
        ok:true,
        deletedTeam:true,
        deletedSlug:teamSlug,
        teams:remaining,
        nextCaptainUrl:remaining.length?`/captain/${remaining[0].slug}`:'/start'
      });
    }

    return res.status(400).json({error:'Unknown account action'});
  }catch(error){
    const status=error.code==='DATABASE_NOT_CONFIGURED'?503:500;
    return res.status(status).json({error:error.message||'Account action failed'});
  }
};
