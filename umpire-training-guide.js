/* Read-only training reference; live game state and historical bindings stay server-owned. */
(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data=()=>window.UmpireTrainingData;
  const normalize=v=>String(v||'').toLowerCase().replace(/tag[ -]?up/g,'tagup').replace(/out[ -]of[ -]bounds/g,'outofbounds').replace(/over[ -]?throws?/g,'overthrow').replace(/[^a-z0-9.]+/g,' ').trim();
  const stop=new Set(['a','an','the','is','it','if','to','of','and','or','can','does','do','what','when','how','on','in','at','that','this','with','my','i','was','are','did','be','by']);
  function search(query,topic='All'){
    const tokens=[...new Set(normalize(String(query).slice(0,120)).split(' ').filter(x=>x&&!stop.has(x)))];
    return (data()?.cards||[]).filter(c=>topic==='All'||c.topic===topic).map((c,i)=>{
      const title=normalize(c.title+' '+c.keywords),body=normalize([c.topic,c.call,c.rule,c.action,c.example,c.note].join(' '));
      const hits=tokens.filter(t=>title.includes(t)||body.includes(t)).length;
      return {c,i,score:tokens.reduce((n,t)=>n+(title.includes(t)?6:body.includes(t)?1:0),0)+(hits===tokens.length?20:0),hits};
    }).filter(x=>!tokens.length||x.hits>0).sort((a,b)=>b.score-a.score||a.i-b.i).map(x=>x.c);
  }
  let dialog=null;
  function open({onGameRules}={}){
    if(dialog){dialog.querySelector('input')?.focus();return;}
    if(!data())return;
    const previous=document.activeElement;
    const sheet=document.createElement('dialog');dialog=sheet;sheet.className='training-guide';sheet.setAttribute('aria-labelledby','trainingTitle');
    let query='',topic='All';
    sheet.innerHTML=`<header class="training-head"><div><small>STONEWALL BOSTON · FALL 2026</small><h2 id="trainingTitle">Find a ruling</h2></div><button type="button" data-close aria-label="Close rules">✕</button></header><p class="training-intro">Quick calls, examples and diagrams from the written rules and Fall training slides.</p><div class="training-search"><label for="trainingQuery">Describe the play or enter a rule number</label><input id="trainingQuery" type="search" maxlength="120" placeholder="Try “tag up”, “overthrow” or “6 runs”" autocomplete="off"><label for="trainingTopic">Topic</label><select id="trainingTopic">${['All',...new Set(data().cards.map(c=>c.topic))].map(t=>`<option>${esc(t)}</option>`).join('')}</select></div><nav class="training-shortcuts" aria-label="Common rulings">${['Overthrows','Running','Fair & foul','Pitch & count'].map(t=>`<button type="button" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}</nav><div data-guide-body></div><footer><details><summary>Sources & training</summary><p>Reference reviewed September 13, 2026. Written rules control where training shorthand differs. These examples do not replace the league rules or change a saved game’s ruleset.</p><p>The PDF filename says August 23; its page footers say July 14, 2026. Both are preserved here.</p>${[['rules','League rulebook (August 23 file)'],['slides','Fall 2026 training slides'],['overthrows','Official field boundary diagrams'],['signals','Official umpire hand signals']].map(([k,t])=>`<a href="${esc(data().sources[k])}" target="_blank" rel="noopener noreferrer">${t} ↗</a>`).join('')}</details>${onGameRules?'<button type="button" data-game-rules>Open saved game Rules & Calls</button>':''}</footer>`;
    const body=sheet.querySelector('[data-guide-body]');
    const close=()=>sheet.close();
    sheet.addEventListener('close',()=>{sheet.remove();if(dialog===sheet)dialog=null;(previous?.isConnected?previous:document.getElementById('umpireRulesCalls'))?.focus();},{once:true});
    sheet.querySelector('[data-close]').onclick=close;
    sheet.querySelector('[data-game-rules]')?.addEventListener('click',()=>{close();onGameRules();});
    function showResults(){
      const found=search(query,topic);
      body.innerHTML=`<p role="status" class="training-result-count">${found.length} ruling${found.length===1?'':'s'}${query?' matching your search':''}</p><div class="training-results">${found.map(c=>{const visual=c.visual&&data().visuals[c.visual];return `<article class="training-result-card" data-card-block="${esc(c.id)}"><small>${esc(c.topic)} · ${esc(c.rule)}</small><strong>${esc(c.title)}</strong><span class="training-result-call">${esc(c.call)}</span><p><b>What to do:</b> ${esc(c.action)}</p>${visual?`<div class="training-inline-visual"><div class="training-inline-label">BEFORE → PLAY → CALL</div><div data-inline-visual="${esc(c.id)}"></div></div>`:''}<button type="button" data-card="${esc(c.id)}">Full ruling & example</button></article>`;}).join('')||'<p>No matching ruling. Try a shorter term or choose All topics. The full rulebook is available under Sources & training.</p>'}</div>`;
      found.forEach(c=>{const visual=c.visual&&data().visuals[c.visual],host=body.querySelector(`[data-inline-visual="${CSS.escape(c.id)}"]`);if(visual&&host&&window.RulesVisualRenderer)window.RulesVisualRenderer.render(host,visual,'Illustrative play; follow the conditions and source rule.');});
      body.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>showCard(b.dataset.card));
    }
    function showCard(id){
      const c=data().cards.find(x=>x.id===id);if(!c)return;
      const visual=c.visual&&data().visuals[c.visual];
      body.innerHTML=`<article class="training-detail"><button type="button" data-back>← Back to results</button><p class="training-result-count">${esc(c.topic)} · Rule ${esc(c.rule)}</p><h3 tabindex="-1">${esc(c.title)}</h3><div class="training-call">${esc(c.call)}</div><section><h4>What to do</h4><p>${esc(c.action)}</p></section><section><h4>Example play</h4><p>${esc(c.example)}</p></section>${c.note?`<section class="training-note"><h4>Check this detail</h4><p>${esc(c.note)}</p></section>`:''}${visual?'<section><h4>Before → Play → Call</h4><p class="training-legend">Blue: runner · Red: fielder · Gold: ball. Schematic, not to scale.</p><div data-guide-visual></div></section>':''}<div class="training-links"><a href="${esc(data().sources.rules)}" target="_blank" rel="noopener noreferrer">Read rule ${esc(c.rule)} ↗</a>${c.topic==='Overthrows'?`<a href="${esc(data().sources.overthrows)}" target="_blank" rel="noopener noreferrer">See official field boundaries ↗</a>`:''}${c.id==='signals'?`<a href="${esc(data().sources.signals)}" target="_blank" rel="noopener noreferrer">View official signal illustrations ↗</a>`:''}</div></article>`;
      if(visual&&window.RulesVisualRenderer)window.RulesVisualRenderer.render(body.querySelector('[data-guide-visual]'),visual,'Illustrative play; follow the conditions and source rule.');
      body.querySelector('[data-back]').onclick=()=>{showResults();body.querySelector(`[data-card="${c.id}"]`)?.focus();};
      body.querySelector('h3').focus();
    }
    sheet.querySelector('input').addEventListener('input',e=>{query=e.target.value;showResults();});
    sheet.querySelector('select').addEventListener('change',e=>{topic=e.target.value;showResults();});
    sheet.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{topic=b.dataset.topic;query='';sheet.querySelector('input').value='';sheet.querySelector('select').value=topic;showResults();});
    document.body.appendChild(sheet);showResults();sheet.showModal();sheet.querySelector('input').focus();
  }
  window.UmpireTrainingGuide={open,search,isOpen:()=>!!dialog?.open};
})();
