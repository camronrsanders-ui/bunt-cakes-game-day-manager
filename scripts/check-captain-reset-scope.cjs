const fs=require('fs'),assert=require('node:assert/strict');
// Regression: createCaptainPasswordReset must only issue resets for active
// members of the requesting owner's own team. The unscoped version let any
// team owner reset ANY Captain's global password (full account takeover).
const src=fs.readFileSync('api/captains.js','utf8');
const start=src.indexOf('async function createCaptainPasswordReset');
assert.ok(start>=0,'createCaptainPasswordReset exists');
const block=src.slice(start,src.indexOf('async function resetCaptainPassword',start));
assert.match(block,/JOIN captain_team_memberships m ON m\.captain_user_id=u\.id AND m\.team_id=\$\{owner\.team_id\} AND m\.active=true/,'reset target lookup is scoped to the owner team membership');
assert.ok(!block.includes('FROM captain_users WHERE lower(email)'),'unscoped captain_users lookup is gone');
console.log('PASS captain password reset is scoped to the owner\'s own team members');
