const crypto = require('crypto');
const { getSql } = require('./_db');
const { requireCaptain } = require('./_auth');

module.exports = async function handler(req,res){
  try{
    const user=await requireCaptain(req,res);if(!user)return;
    const sql=getSql();
    if(req.method==='GET'){
      const rows=await sql`SELECT email,display_name,active,created_at FROM captain_users ORDER BY created_at`;
      return res.status(200).json({captains:rows});
    }
    if(req.method==='POST'){
      const {email,displayName,password}=req.body||{};
      if(!email||!displayName||!password||String(password).length<10)return res.status(400).json({error:'Email, name, and a password of at least 10 characters are required'});
      const salt=crypto.randomBytes(16).toString('hex');
      const hash=crypto.pbkdf2Sync(String(password),salt,120000,32,'sha256').toString('hex');
      await sql`INSERT INTO captain_users(email,display_name,password_hash,password_salt,active) VALUES (${String(email).toLowerCase()},${String(displayName)},${hash},${salt},true) ON CONFLICT(email) DO UPDATE SET display_name=EXCLUDED.display_name,password_hash=EXCLUDED.password_hash,password_salt=EXCLUDED.password_salt,active=true`;
      return res.status(200).json({ok:true});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(error){const status=error.code==='DATABASE_NOT_CONFIGURED'?503:500;return res.status(status).json({error:error.message||'Captain management failed'});}
};
