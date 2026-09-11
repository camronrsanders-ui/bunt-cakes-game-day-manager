const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const clone=v=>JSON.parse(JSON.stringify(v));
(async()=>{
 let remote={state:{gameInning:1,fieldInning:1,innings:{1:{}},fieldSwitches:{game:{player:'Original'}},availability:{}},updatedAt:'v1'};
 const timers=[],intervals=[];
 const ctx={state:clone(remote.state),queueSave(){},api:async()=>clone(remote),document:{hidden:false,activeElement:null,getElementById:()=>null,addEventListener(){}},window:{addEventListener(){},dispatchEvent(){},scrollTo(){}},Event:class{},setTimeout:(f)=>{timers.push(f);return timers.length},clearTimeout(){},setInterval:f=>intervals.push(f),requestAnimationFrame:f=>f(),console,Date};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('captain-live-sync.js','utf8'),ctx);await new Promise(setImmediate);
 ctx.state.fieldSwitches.game.player='Captain draft';
 remote={state:{...remote.state,availability:{'2026-09-13':{player:{status:'yes'}}}},updatedAt:'v2'};
 await intervals[0]();
 assert.equal(ctx.state.fieldSwitches.game.player,'Captain draft');assert.equal(ctx.state.availability['2026-09-13'].player.status,'yes');
 let resolve;ctx.api=()=>new Promise(r=>resolve=r);
 const checking=intervals[0]();ctx.state.innings[1]['First Base']='New edit';ctx.queueSave();
 resolve({state:remote.state,updatedAt:'v3'});await checking;
 assert.equal(ctx.state.innings[1]['First Base'],'New edit');
 console.log('PASS fielding draft survives player refresh; in-flight refresh cannot overwrite queued save');
})().catch(e=>{console.error(e);process.exitCode=1});
