const fs=require('node:fs');
const {Pool,neonConfig}=require('@neondatabase/serverless');
neonConfig.webSocketConstructor=WebSocket;
(async()=>{
const pool=new Pool({connectionString:process.env.DATABASE_URL});
if(new URL(process.env.DATABASE_URL).hostname!==process.env.TEST_DATABASE_HOST)throw new Error('Explicit isolated test database host required');
const c=await pool.connect();
try {
const files=['migrations/001_rules_calls_foundation.sql','migrations/002_rules_calls_integrity.sql',...['core','scenarios','sources_visuals','source_metadata','signals','remaining_verified','tag_up_timing','activate','bind_bunt_cakes'].map(s=>'seeds/stonewall_boston_fall_2026_v1_'+s+'.sql')];
for(const f of files){await c.query(fs.readFileSync(f,'utf8'));console.log('PASS '+f);}
}finally{c.release();await pool.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
