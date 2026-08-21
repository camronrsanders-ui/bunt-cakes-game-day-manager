const { getCaptain, listCaptainTeams, requestedTeamSlug } = require('./_auth');

module.exports = async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  try{
    const user=await getCaptain(req);
    if(!user) return res.status(200).json({authenticated:false,accountAuthenticated:false,user:null,teams:[]});
    const teams=await listCaptainTeams(req);
    const teamSlug=requestedTeamSlug(req);
    const current=teams.find(t=>t.slug===teamSlug)||null;
    return res.status(200).json({
      authenticated:!!current,
      accountAuthenticated:true,
      accessDenied:!current,
      team:current?{slug:current.slug,name:current.name,role:current.role,plan:current.plan,billingStatus:current.billing_status}:null,
      user:{email:user.email,displayName:user.display_name},
      teams:teams.map(t=>({slug:t.slug,name:t.name,role:t.role,plan:t.plan,billingStatus:t.billing_status}))
    });
  }catch(error){
    const status=error.code==='DATABASE_NOT_CONFIGURED'?503:500;
    return res.status(status).json({error:error.message||'Session check failed'});
  }
};
