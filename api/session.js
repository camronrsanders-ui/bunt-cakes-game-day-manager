const { getCaptain } = require('./_auth');
module.exports = async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  try{const user=await getCaptain(req);return res.status(200).json({authenticated:!!user,user:user?{email:user.email,displayName:user.display_name}:null});}
  catch(error){const status=error.code==='DATABASE_NOT_CONFIGURED'?503:500;return res.status(status).json({error:error.message||'Session check failed'});}
};
