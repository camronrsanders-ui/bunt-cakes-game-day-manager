const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../umpire-console.js'),'utf8');
const nodes=new Map();let refreshes=0;
class Element{constructor(tag){this.tagName=tag;this.open=false;this.children=[];this.handlers={};this.classList={contains:()=>false};}set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}appendChild(x){this.children.push(x)}insertAdjacentElement(p,x){this.children.unshift(x)}addEventListener(k,f){this.handlers[k]=f}}
const section=new Element('section');section.id='officials';
const context={document:{getElementById:id=>nodes.get(id),createElement:t=>new Element(t),hidden:false},isCaptain:()=>true,loadRemote:()=>refreshes++,writing:false,rulesOverlay:null,editingConsole:()=>false};vm.createContext(context);
vm.runInContext(source.match(/^  function ensureCaptainMount\(\).*$/m)[0]+source.match(/^  function shouldPoll\(\).*$/m)[0],context);
const host=context.ensureCaptainMount();const details=nodes.get('captainUmpireDisclosure');assert.equal(details.tagName,'details');assert.equal(details.open,false);assert.equal(context.shouldPoll(),false);
details.open=true;details.handlers.toggle();assert.equal(refreshes,1);assert.equal(context.shouldPoll(),true);assert.equal(context.ensureCaptainMount(),host);assert.equal(details.open,true);assert.equal(section.children.length,1);
details.open=false;details.handlers.toggle();assert.equal(context.shouldPoll(),false);assert.equal(refreshes,1);
console.log('PASS closed by default, refresh on opening, stable mount preserves open state, no polling while closed.');
