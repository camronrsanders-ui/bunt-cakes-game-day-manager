const { getSql } = require('./_db');
const { requestedTeamSlug, getTeam, requireTeamCaptain } = require('./_auth');

const ATTENDANCE = new Set(['yes','no','not_sure']);

module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const sql=getSql();
    const teamSlug=requestedTeamSlug(req);
    const captain=await requireTeamCaptain(req,res,teamSlug);if(!captain)return;
    const row=await getTeam(sql,teamSlug);
    if(!row) return res.status(404).json({error:'Team was not found'});

    const gameDate=String(req.body&&req.body.gameDate||'');
    const status=String(req.body&&req.body.status||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) return res.status(400).json({error:'A valid game date is required'});
    if(!ATTENDANCE.has(status)) return res.status(400).json({error:'Answer Yes, No, or Not sure'});
    const games=(row.state?.events||[]).filter(e=>e&&e.type==='Game'&&e.date===gameDate);
    if(!games.length) return res.status(400).json({error:'No game is scheduled for that date'});

    const key=String(captain.email||'').trim().toLowerCase();
    const answer={status,respondedAt:new Date().toISOString(),displayName:captain.display_name||captain.email,role:captain.role||'captain'};
    const payload=JSON.stringify(answer);
    await sql`
      UPDATE team_states
      SET state=jsonb_set(
        state,
        '{availability}',
        COALESCE(state->'availability','{}'::jsonb) || jsonb_build_object(
          ${gameDate},
          COALESCE(state->'availability'->${gameDate},'{}'::jsonb) || jsonb_build_object(
            '_captains',
            COALESCE(state->'availability'->${gameDate}->'_captains','{}'::jsonb) || jsonb_build_object(${key},${payload}::jsonb)
          )
        ),
        true
      ),
      updated_at=now()
      WHERE team_id=${row.id}
    `;
    return res.status(200).json({ok:true,gameDate,status,respondedAt:answer.respondedAt,displayName:answer.displayName});
  }catch(error){
    const status=error.code==='DATABASE_NOT_CONFIGURED'?503:500;
    return res.status(status).json({error:error.message||'Could not save captain availability'});
  }
};
