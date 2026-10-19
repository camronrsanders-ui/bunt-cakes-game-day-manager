const fs=require('fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Umpire tracker — Stonewall Sports Boston rules (SSB Rulebook, Section 4):
// max 5 innings, 40-minute official clock, no new inning at/after 40:00,
// home-held bottom skip (4.4), 4.4.1 time snapshot, ties (4.5), 6-run cap
// (4.3.1), slaughter check (4.3.2), running clock with umpire time outs (13.1).
const src=fs.readFileSync('umpire-tracker.js','utf8');
const sandbox={window:{},console,setInterval:()=>0,clearInterval:()=>{}};
vm.runInNewContext(src,sandbox);
const C=sandbox.window.UmpireGameTrackerCore;
assert.ok(C,'tracker core exposed');
assert.equal(C.REGULATION_INNINGS,5,'SSB games are five innings');
assert.equal(C.GAME_MINUTES,40,'SSB official clock is forty minutes');

// Full 5-inning game, home leads after top of the 5th: bottom is NOT played.
let s=C.createState();C.adjustScore(s,'home',3);C.adjustScore(s,'away',1);
for(let i=0;i<8;i++)C.endHalf(s); // through bottom of the 4th
assert.equal(s.inning,5);assert.equal(s.half,'top');
assert.equal(C.endHalf(s),'final','home leading after top of final ends it (4.4)');
assert.equal(s.finalReason,'home-held');assert.equal(s.over,true);
assert.equal(C.endHalf(s),'over');

// Away leads after top of the 5th: bottom IS played, then final.
s=C.createState();C.adjustScore(s,'away',4);C.adjustScore(s,'home',2);
for(let i=0;i<8;i++)C.endHalf(s);
assert.equal(C.endHalf(s),'half','away lead still gives home its last at-bat');
C.adjustScore(s,'home',1);
assert.equal(C.endHalf(s),'final');assert.equal(s.finalReason,'regulation');

// Regular-season tie at the end of regulation: tie stands (4.5).
s=C.createState();C.adjustScore(s,'away',2);C.adjustScore(s,'home',2);
for(let i=0;i<9;i++)C.endHalf(s);
assert.equal(C.endHalf(s),'final');assert.equal(s.finalReason,'tie');
assert.equal(C.statusLine(s),'Game over — tie game');

// Playoff tie: extra innings with the 4.5 setup, decided after a full inning.
s=C.createState();s.mode='playoffs';C.adjustScore(s,'away',2);C.adjustScore(s,'home',2);
for(let i=0;i<9;i++)C.endHalf(s);
assert.equal(C.endHalf(s),'extra-start');assert.equal(s.inning,6);assert.equal(s.extra,true);
assert.match(C.statusLine(s),/last kicker on 2nd, 1 out/);
assert.equal(C.endHalf(s),'half','top of the extra can end undecided');
C.adjustScore(s,'home',1);
assert.equal(C.endHalf(s),'final','lead after the bottom of an extra inning ends it');

// Time expiry makes the current inning the final inning (4.1).
s=C.createState();s.inning=3;s.half='bottom';s.timeUp=true;C.adjustScore(s,'away',1);
assert.equal(C.isFinalInning(s),true);
assert.equal(C.endHalf(s),'final','bottom of the time-expired inning ends the game');
s=C.createState();s.inning=2;s.half='top';s.timeUp=true;C.adjustScore(s,'home',1);
assert.equal(C.endHalf(s),'final','home leading + time up: no bottom (4.4)');

// Clock: countdown from the official length, runs through play, umpire can
// pause and add time back (13.1). remainingMs is the display contract.
s=C.createState();
assert.equal(C.remainingMs(s,0),40*60000);
C.toggleClock(s,1000);
assert.equal(C.remainingMs(s,61000),39*60000,'one minute of play elapsed');
C.toggleClock(s,61000); // umpire time out
assert.equal(C.remainingMs(s,999000),39*60000,'stopped clock does not move');
C.addTime(s,60000);
assert.equal(C.remainingMs(s,999000),40*60000,'umpire may add time back');
assert.equal(C.fmtClock(40*60000),'40:00');
assert.equal(C.fmtClock(0),'00:00');

// Six-run half-inning cap tracking (4.3.1), playoffs exempt.
s=C.createState();
for(let i=0;i<6;i++)C.adjustScore(s,'away',1);
assert.equal(s.runsThisHalf,6);assert.equal(C.capReached(s),true);
C.endHalf(s);assert.equal(s.runsThisHalf,0,'cap counter resets with the half');
s.mode='playoffs';for(let i=0;i<7;i++)C.adjustScore(s,'home',1);
assert.equal(C.capReached(s),false,'no cap in playoffs');

// Slaughter check (4.3.2): 10+ gap AND (30:00 played OR 3 innings complete).
s=C.createState();C.adjustScore(s,'away',10);s.elapsedBase=10*60000;
assert.equal(C.slaughterMet(s,Date.now()),false,'gap alone before thresholds');
s.elapsedBase=31*60000;
assert.equal(C.slaughterMet(s,Date.now()),true,'gap + 30 minutes');
s=C.createState();C.adjustScore(s,'home',11);s.inning=4;s.elapsedBase=5*60000;
assert.equal(C.slaughterMet(s,Date.now()),true,'gap + 3 completed innings');

// Wiring + persistence.
assert.match(fs.readFileSync('api/team-page.js','utf8'),/umpire-tracker\.js\?v=2/,'player page loads tracker v2');
assert.match(fs.readFileSync('api/captain-field-page.js','utf8'),/umpire-tracker\.js\?v=2/,'captain page loads tracker v2');
assert.match(src,/feildhaus-umpire-tracker-v2:/,'v2 persistence key (rules changed)');
assert.match(src,/Rule 4\.4\.1/,'4.4.1 snapshot guidance present');
console.log('PASS umpire tracker (SSB rules): 5 innings / 40:00, home-held skip, ties, playoff extras, run cap, slaughter, running clock');
