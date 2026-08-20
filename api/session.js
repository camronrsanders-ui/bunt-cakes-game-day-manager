const { getCaptain, listCaptainTeams } = require('./_auth');

module.exports = async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  try{
    const user=await getCaptain(req);
    if(!user) return res.status(200).json({authenticated:false,user:null,teams:[]});
    const teams=await listCaptainTeams(req);
    return res.status(200).json({
      authenticated:true,
      user:{email:user.email,displayName:user.display_name},
      teams:teams.map(t=>({slug:t.slug,name:t.name,role:t.role,plan:t.plan,billingStatus:t.billing_status}))
    });
  }catch(error){
    const status=error.code==='DATABASE_NOT_CONFIGURED'?503:500;
    return res.status(status).json({error:error.message||'Session check failed'});
  }
};
