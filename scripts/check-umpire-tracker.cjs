const fs=require('fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Umpire game tracker (2026-10-18): clock + inning/half walk with a hard
// stop at the end of regulation unless tied — the failure mode was a game
// running long because the crew lost count and extra innings changed the score.
const src=fs.readFileSync('umpire-tracker.js','utf8');
const sandbox={window:{},console,setInterval:()=>0,clearInterval:()=>{}};
vm.runInNewContext(src,sandbox);
const C=sandbox.window.UmpireGameTrackerCore;
assert.ok(C,'tracker core exposed');

// Walk a full regulation game, home leading: must end exactly at bottom 7.
let s=C.createState();
assert.equal(C.statusLine(s),'Top of the 1st — Away kicking');
C.adjustScore(s,'home',2);C.adjustScore(s,'away',1);
let transitions=[];
for(let i=0;i<13;i++)transitions.push(C.endHalf(s));
assert.equal(s.inning,7);assert.equal(s.half,'bottom');
assert.equal(C.endHalf(s),'final');
assert.equal(s.over,true);
assert.equal(C.endHalf(s),'over','no half can be played after the final');
assert.equal(C.statusLine(s),'Game over');

// Tied after 7: extra innings, decided only after a full extra inning.
s=C.createState();C.adjustScore(s,'away',3);C.adjustScore(s,'home',3);
for(let i=0;i<13;i++)C.endHalf(s);
assert.equal(C.endHalf(s),'extra','tied after 7 goes to extras, not final');
assert.equal(s.inning,8);assert.equal(s.extra,true);assert.equal(s.over,false);
assert.equal(C.endHalf(s),'half','top of the 8th can end without deciding');
C.adjustScore(s,'away',1);
assert.equal(C.endHalf(s),'final','a lead after the bottom of an extra inning ends it');
assert.equal(s.over,true);

// Bottom of the 7th with a home lead also ends (no phantom top of the 8th).
s=C.createState();C.adjustScore(s,'home',1);
for(let i=0;i<13;i++)C.endHalf(s);
assert.equal(C.endHalf(s),'final');

// Corrections: inning can be stepped back, scores floor at zero.
C.adjustInning(s,-1);assert.equal(s.over,false,'stepping back reopens the game');
C.adjustScore(s,'home',-5);assert.equal(s.home,0);

// Clock math: start/pause accumulates honestly.
s=C.createState();
C.toggleClock(s,1000);
assert.equal(C.elapsedMs(s,4000),3000);
C.toggleClock(s,5000);
assert.equal(C.elapsedMs(s,9000),4000,'paused clock does not advance');
C.toggleClock(s,10000);
assert.equal(C.elapsedMs(s,11500),5500);
assert.equal(C.fmt(0),'00:00');
assert.equal(C.fmt(605000),'10:05');
assert.equal(C.fmt(3661000),'1:01:01');
assert.equal(C.ordinal(1),'1st');assert.equal(C.ordinal(2),'2nd');assert.equal(C.ordinal(3),'3rd');assert.equal(C.ordinal(7),'7th');

// Wiring: both pages load the tracker next to the Umpire Console.
assert.match(fs.readFileSync('api/team-page.js','utf8'),/umpire-tracker\.js\?v=1/,'player page loads tracker');
assert.match(fs.readFileSync('api/captain-field-page.js','utf8'),/umpire-tracker\.js\?v=1/,'captain page loads tracker');
assert.match(src,/localStorage/,'tracker persists on the device');
assert.match(src,/does not change the official team score/,'tracker is explicit that it is unofficial');
console.log('PASS umpire tracker: regulation ends on time, ties go to extras, clock math, persistence, page wiring');
