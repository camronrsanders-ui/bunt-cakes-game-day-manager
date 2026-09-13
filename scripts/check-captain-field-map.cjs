const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');

const source=fs.readFileSync('captain-position-switches.js','utf8');
const start=source.indexOf('  const FIELD_SPOTS=');
const end=source.indexOf('  function renderButtons()',start);
assert.ok(start>=0&&end>start,'field-map renderer not found');

const box={innerHTML:''};
const POSITIONS=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
const context={
  POSITIONS,
  document:{getElementById:id=>id==='captainAssignmentDiagram'?box:null},
  dirty:false,
  state:{innings:{1:{Pitcher:'Cam'},2:{Catcher:'CJ'}},fieldSwitches:{}},
  buildInnings:()=>({1:{Pitcher:'Draft <Player>'},2:{Catcher:'Draft <Player 2>'}}),
  config:()=>({positions:{}}),
  normalizePosition:pair=>pair,
  blankPosition:()=>({slots:[]}),
  display:v=>String(v||'Open'),
  rosterPlayer:()=>null,
  clean:v=>String(v??'').trim(),
  esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
};

vm.createContext(context);
vm.runInContext(source.slice(start,end)+';renderFieldDiagram();this.spots=FIELD_SPOTS',context);
assert.ok(box.innerHTML.includes('Layout 1'));
assert.ok(box.innerHTML.includes('Layout 2'));
assert.ok(box.innerHTML.includes('Cam'));
assert.ok(box.innerHTML.includes('CJ'));
assert.ok(!box.innerHTML.includes('assignmentMapInning'));
assert.ok(!box.innerHTML.includes('<select'));

context.dirty=true;
vm.runInContext('renderFieldDiagram()',context);
assert.ok(box.innerHTML.includes('Draft &lt;Player&gt;'));
assert.ok(box.innerHTML.includes('Draft preview'));
assert.equal((box.innerHTML.match(/class="assignment-marker/g)||[]).length,22);
assert.equal(context.spots.length,11);
assert.equal(new Set(context.spots.map(p=>p[0])).size,11);

for(const width of [260,280,320,375,480]){
  const height=width*1.1,w=width*.27,h=34;
  const rects=context.spots.map(([name,_,x,y])=>({name,l:x/100*width-w/2,r:x/100*width+w/2,t:y/100*height-h/2,b:y/100*height+h/2}));
  for(const a of rects){
    assert.ok(a.l>=0&&a.r<=width&&a.t>=0&&a.b<=height,a.name+' within field');
    for(const b of rects){
      if(a===b)continue;
      assert.ok(a.r<=b.l||b.r<=a.l||a.b<=b.t||b.b<=a.t,`${width}px: ${a.name} overlaps ${b.name}`);
    }
  }
}

console.log('PASS two captain-only layouts, escaped names, 22 placed markers, 11 unique positions, and label spacing at 260–480px diagram widths');
