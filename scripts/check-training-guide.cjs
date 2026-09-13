const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const window={};
for(const file of ['umpire-training-data.js','umpire-training-guide.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),{window});
const {cards,visuals,sources}=window.UmpireTrainingData;
const search=window.UmpireTrainingGuide.search;
assert.equal(cards.length,25);
assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
for(const [q,id] of [['out of bounds','oob'],['tag up foul','tagfoul'],['base moved','displaced'],['infield fly','infieldfly'],['intentional walk','walk'],['7.11.2','unsafe'],['playoff cap','runcap']])assert.equal(search(q)[0].id,id,q);
assert.equal(search('zzzzzzz').length,0);
assert.equal(search('', 'Overthrows').length,4);
assert(search('tag-up').some(x=>x.id==='tagfair'));
assert(search('over throw').some(x=>x.id==='general'));
for(const card of cards){
 assert(card.rule&&card.action&&card.example);
 if(card.visual){assert(visuals[card.visual]);assert.equal(visuals[card.visual].steps.length,3);}
}
for(const url of Object.values(sources))assert.equal(new URL(url).protocol,'https:');
assert(cards.find(c=>c.id==='encroachment').note.includes('ALL types'));
assert(cards.find(c=>c.id==='fieldkick').action.includes('automatically dead'));
for(const file of ['api/captain-field-page.js','api/team-page.js']){
 const text=fs.readFileSync(file,'utf8');
 assert(text.indexOf('/umpire-training-data.js')<text.indexOf('/umpire-training-guide.js'));
 assert(text.indexOf('/umpire-training-guide.js')<text.indexOf('/umpire-console.js'));
}
console.log(`PASS ${cards.length} cards, ${Object.keys(visuals).length} diagram sets, natural-language search, rule numbers, source links, captain/player loading.`);
