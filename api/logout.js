const { getSql } = require('./_db');
const { parseCookies, hashToken } = require('./_auth');
module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{const token=parseCookies(req).bc_captain;if(token){const sql=getSql();await sql`DELETE FROM captain_sessions WHERE token_hash=${hashToken(token)}`;}res.setHeader('Set-Cookie','bc_captain=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');return res.status(200).json({ok:true});}
  catch(error){return res.status(500).json({error:error.message||'Logout failed'});}
};
