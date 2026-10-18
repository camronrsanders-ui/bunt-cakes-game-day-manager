const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');

// 1) Attendance sync must never delete Captain-published fielding assignments.
// Regression: captain-attendance's automatic eligibility sync pruned every
// innings entry whose player had not RSVP'd Yes (and every game-only/custom
// player, who is not on the roster at all), then saved the pruned lineup back
// over the published one — so Captain fielding updates vanished from Player
// View within seconds of publishing.
const attendance=fs.readFileSync('captain-attendance.js','utf8');
const timers=[];
const ctx={state:{team:{timeZone:'UTC'},events:[{type:'Game',date:'2099-09-13'}],
  players:[{name:'Yes',present:false},{name:'NoRsvp',present:false},{name:'Bench',present:false}],
  availability:{'2099-09-13':{Yes:{status:'yes'}}},
  innings:{1:{Pitcher:'Yes',Shortstop:'NoRsvp',Catcher:'Guest Sam'},2:{Pitcher:'Yes',Shortstop:'NoRsvp',Catcher:'Guest Sam'}}},
  window:{addEventListener(){},dispatchEvent(){}},document:{getElementById:id=>id==='bunt-captain-attendance-style'?{}:null,addEventListener(){}},
  Intl,Date,Event:class{},CustomEvent:class{},setInterval(){},clearInterval(){},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},queueSave(){},renderRoster(){},renderLineup(){},renderKicking(){}};
vm.createContext(ctx);vm.runInContext(attendance,ctx);
const eligibility=ctx.window.BuntGameDayEligibility;
const published=JSON.stringify(ctx.state.innings);
eligibility.sync(undefined,false);
assert.equal(JSON.stringify(ctx.state.innings),published,'automatic eligibility sync must not touch innings');
assert.deepEqual(ctx.state.players.map(p=>p.present),[true,false,false],'present flags still sync from RSVPs');
// An explicit Captain mark-absent removes only that one player from the field.
eligibility.setManualOverride('NoRsvp',false);
assert.equal(ctx.state.innings[1].Shortstop,'','explicit absent removes that player');
assert.equal(ctx.state.innings[1].Pitcher,'Yes','other assignments stay');
assert.equal(ctx.state.innings[1].Catcher,'Guest Sam','custom game players stay');

// 2) The publish payload must carry the quick-move inning overrides.
const switches=fs.readFileSync('captain-position-switches.js','utf8');
assert.match(switches,/action:'publish-fielding',innings:state\.innings,fieldSwitches:state\.fieldSwitches\|\|\{\},fieldSwitchInningOverrides:state\.fieldSwitchInningOverrides\|\|\{\}/,'publish payload includes fieldSwitchInningOverrides');

// 3) The server publish handler must store the overrides atomically instead
// of rewriting the whole state document from a request-start snapshot.
const server=fs.readFileSync('api/team-state.js','utf8');
const publishStart=server.indexOf("action==='publish-fielding'");
assert.ok(publishStart>=0,'publish-fielding handler exists');
const publishBlock=server.slice(publishStart,server.indexOf("action==='pilot-feedback'",publishStart));
assert.match(publishBlock,/fieldSwitchInningOverrides/,'publish handler stores fieldSwitchInningOverrides');
assert.match(publishBlock,/jsonb_set\(state,'\{innings\}'/,'publish updates innings atomically via jsonb_set');
assert.ok(!publishBlock.includes('SET state=${JSON.stringify(next)}'),'publish must not rewrite the full state document');
assert.ok(!publishBlock.includes('const next={...state'),'publish must not build a full-document replacement');

console.log('PASS published fielding survives attendance sync; quick-move overrides are published and stored atomically');
