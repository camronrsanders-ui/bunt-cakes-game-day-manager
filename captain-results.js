(function(){
  const STYLE_ID='bunt-results-styles';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .results-card{border:2px solid #86efac;background:#f7fff8}.results-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.results-record{font-size:1.35rem;font-weight:900;color:#166534}.results-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:9px 0;border-top:1px solid #dbe5de;align-items:center}.results-score{font-size:1.1rem;font-weight:900}.results-win{color:#166534}.results-loss{color:#b91c1c}.results-tie{color:#6b7280}.results-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.results-actions button{flex:1 1 160px;min-height:48px}.result-delete{color:#b91c1c}@media(max-width:600px){.results-row{grid-template-columns:1fr}.results-score{font-size:1.25rem}.results-row button{width:100%;margin-top:7px}}
    `;document.head.appendChild(style);
  }

  function games(){return (state.events||[]).filter(e=>e.type==='Game').slice().sort((a,b)=>((a.date||'')+(a.time||'')).localeCompare((b.date||'')+(b.time||'')));}
  function eventKey(e){return e?.sourceUid||e?.id||'';}
  function outcome(r){const a=Number(r.teamScore||0),b=Number(r.opponentScore||0);return a>b?'Win':a<b?'Loss':'Tie';}
  function record(){let w=0,l=0,t=0;(state.gameResults||[]).forEach(r=>{const o=outcome(r);o==='Win'?w++:o==='Loss'?l++:t++});return `${w}-${l}${t?'-'+t:''}`;}
  function shortTitle(e){if(!e)return'Game';return (e.title||'Game').replace(/\s*\(Boston - Kickball - Fall 2026\)\s*$/,'');}
  function defaultGame(){const all=games();if(!all.length)return'';const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});const same=all.find(e=>e.date===today);if(same)return eventKey(same);const future=all.find(e=>e.date>=today);return eventKey(future||all[all.length-1]);}

  function mount(){
    if(typeof state==='undefined'||!state)return;
    state.gameResults=Array.isArray(state.gameResults)?state.gameResults:[];
    const dash=document.getElementById('dashboard');if(!dash)return;
    let card=document.getElementById('gameResultsCard');
    if(!card){card=document.createElement('div');card.id='gameResultsCard';card.className='card results-card';dash.appendChild(card);}
    const all=games();
    const selected=card.querySelector('#resultGame')?.value||defaultGame();
    card.innerHTML='<div class="results-head"><div><strong>Weekly Game Results</strong><div class="muted">When the game is over, choose it below and save the score shown on the Dashboard.</div></div><div class="results-record">Record '+record()+'</div></div><label style="display:block;margin-top:10px">Game<select id="resultGame">'+(all.length?all.map(e=>'<option value="'+eventKey(e)+'" '+(eventKey(e)===selected?'selected':'')+'>'+e.date+' • '+shortTitle(e)+'</option>').join(''):'<option value="">No scheduled games</option>')+'</select></label><div class="results-actions"><button type="button" id="saveFinalResult" class="primary">Save This Final Score</button><button type="button" id="clearLiveScore">Reset Scoreboard to 0-0</button></div><div id="savedResultsList" style="margin-top:10px"></div>';
    const list=card.querySelector('#savedResultsList');
    const rows=state.gameResults.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    list.innerHTML=rows.length?rows.map(r=>{const o=outcome(r),cls=o==='Win'?'results-win':o==='Loss'?'results-loss':'results-tie';return '<div class="results-row"><div><strong>'+r.date+' • '+(r.title||'Game')+'</strong><div class="muted">'+o+'</div></div><div><span class="results-score '+cls+'">Bunt Cakes '+r.teamScore+' — '+r.opponentScore+'</span> <button type="button" class="result-delete" data-delete-result="'+r.key+'">Delete Result</button></div></div>'}).join(''):'<div class="muted">No final game scores saved yet.</div>';
    card.querySelector('#saveFinalResult').disabled=!all.length;
    card.querySelector('#saveFinalResult').onclick=()=>{
      const key=card.querySelector('#resultGame').value;
      const e=all.find(x=>eventKey(x)===key);if(!e)return;
      const team=Number(state.score?.team||0),opponent=Number(state.score?.opponent||0);
      const idx=state.gameResults.findIndex(r=>r.key===key);
      if(idx>=0&&!confirm('A final score is already saved for this game. Replace it with Bunt Cakes '+team+' — '+opponent+'?'))return;
      const row={key,date:e.date,title:shortTitle(e),teamScore:team,opponentScore:opponent,savedAt:new Date().toISOString()};
      if(idx>=0)state.gameResults[idx]=row;else state.gameResults.push(row);
      queueSave();mount();
    };
    card.querySelector('#clearLiveScore').onclick=()=>{
      if(!confirm('Reset the live scoreboard to 0-0? Saved final game results will not be deleted.'))return;
      if(!state.score)state.score={team:0,opponent:0};state.score.team=0;state.score.opponent=0;queueSave();if(typeof renderDash==='function')renderDash();mount();
    };
    card.querySelectorAll('[data-delete-result]').forEach(b=>b.onclick=()=>{
      const row=state.gameResults.find(r=>r.key===b.dataset.deleteResult);
      if(!confirm('Delete the saved result for '+(row?.title||'this game')+'?'))return;
      state.gameResults=state.gameResults.filter(r=>r.key!==b.dataset.deleteResult);queueSave();mount();
    });
  }

  const wait=setInterval(()=>{if(typeof state!=='undefined'&&state&&document.getElementById('dashboard')){clearInterval(wait);mount();}},250);
  const oldRender=window.render;
  if(typeof oldRender==='function')window.render=function(){oldRender();setTimeout(mount,0)};
})();