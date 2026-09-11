const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
class Element {
 constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.dataset={};this.textContent='';}
 setAttribute(k,v){this.attrs[k]=v;}
 appendChild(n){this.children.push(n);return n;}
 replaceChildren(){this.children=[];}
 serialize(){return `<${this.tag} ${Object.entries(this.attrs).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')}>${escape(this.textContent)}${this.children.map(n=>n.serialize()).join('')}</${this.tag}>`;}
}
const document={createElement:t=>new Element(t),createElementNS:(ns,t)=>new Element(t),querySelector:()=>true};
const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../rules-visual-renderer.js'),'utf8'),{document,window});
const defs=require('../seeds/stonewall_boston_fall_2026_v2_visuals.json');
const allIds=new Set();let count=0;
for(const [key,definition] of Object.entries(defs)){
 const host=new Element('div');assert(window.RulesVisualRenderer.render(host,definition));
 assert.deepEqual(definition.steps.map(s=>s.phase),['before','play','call']);
 for(const [i,card] of host.children[0].children.entries()){
  const svg=card.children.find(x=>x.tag==='svg');const xml=svg.serialize();
  const id=xml.match(/id="(rulesArrow-[^"]+)"/)[1];assert(!allIds.has(id));allIds.add(id);
  for(const marker of xml.matchAll(/marker-end="url\(#([^)]*)\)"/g))assert.equal(marker[1],id);
  if(process.env.SVG_OUTPUT){fs.mkdirSync(process.env.SVG_OUTPUT,{recursive:true});fs.writeFileSync(`${process.env.SVG_OUTPUT}/${key}-${i}.svg`,xml.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" '));}
  count++;
 }
}
const force=defs['force-base-touch'].steps[1].elements;assert(force.some(x=>x.type==='fielder'&&x.x===50&&x.y===40));
const tag=defs['runner-left-early-fly'];assert(tag.steps[0].elements.some(x=>x.type==='runner'&&x.x===75&&x.y===65));
assert.equal(defs['pitch-enters-strike-zone'].field,'strike_zone_front');
for(const [key,end] of [['overthrow-left-game-area',[25,65]],['overthrow-unsafe-area',[50,40]],['ball-adjacent-infield',[50,88]]])assert(defs[key].steps[2].elements.some(x=>x.type==='runner'&&x.x===end[0]&&x.y===end[1]));
console.log(`PASS ${count} rendered SVG panels: isolated arrow IDs, base-contact geometry, award destinations, strike elevation.`);
