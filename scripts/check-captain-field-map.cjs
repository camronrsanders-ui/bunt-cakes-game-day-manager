const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('captain-position-switches.js','utf8');
const start=source.indexOf('  const FIELD_SPOTS=');
const end=source.indexOf('  function renderButtons()',start);
const box={innerHTML:''},select={};
const context={document:{getElementById:id=>id==='captainAssignmentDiagram'?box:select},diagramInning:null,liveInning:()=>1,dirty:false,state:{innings:{1:{Pitcher:'Cam'},2:{Catcher:'CJ'}}},buildInnings:()=>({1:{Pitcher:'Draft <Player>'}}),rosterPlayer:()=>null,clean:v=>String(v??'').trim(),esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
vm.createContext(context);vm.runInContext(source.slice(start,end)+';renderFieldDiagram();this.spots=FIELD_SPOTS',context);
assert.ok(box.innerHTML.includes('Cam'));assert.ok(!box.innerHTML.includes('Draft preview'));
select.onchange({target:{value:'2'}});assert.ok(box.innerHTML.includes('CJ'));assert.ok(box.innerHTML.includes('inning 2'));
context.dirty=true;context.diagramInning=1;vm.runInContext('renderFieldDiagram()',context);
assert.ok(box.innerHTML.includes('Draft &lt;Player&gt;'));assert.ok(box.innerHTML.includes('Draft preview'));
assert.equal(context.spots.length,11);assert.equal(new Set(context.spots.map(p=>p[0])).size,11);
for(const width of [260,280,320,375,480]){
 const height=width*1.1,w=width*.27,h=34;
 const rects=context.spots.map(([name,_,x,y])=>({name,l:x/100*width-w/2,r:x/100*width+w/2,t:y/100*height-h/2,b:y/100*height+h/2}));
 for(const a of rects){assert.ok(a.l>=0&&a.r<=width&&a.t>=0&&a.b<=height,a.name+' within field');for(const b of rects){if(a===b)continue;assert.ok(a.r<=b.l||b.r<=a.l||a.b<=b.t||b.b<=a.t,`${width}px: ${a.name} overlaps ${b.name}`);}}
}
console.log('PASS live/draft assignments, inning selection, escaped names, 11 unique positions, and label spacing at 260–480px diagram widths');
