(()=>{
  if(window.__bcEnhancementsLoaded)return;window.__bcEnhancementsLoaded=true;
  const WHATSAPP='https://chat.whatsapp.com/EUg12yVH0YVKfQPEJplnow';
  const HISTORY_KEY='bc-score-history-v1';
  const $=id=>document.getElementById(id);
  const makeButton=(text,href)=>{const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener';const b=document.createElement('button');b.textContent=text;b.className='primary';a.appendChild(b);return a};

  function addWhatsApp(){
    const top=document.querySelector('.app > .row.wrap')||document.querySelector('.app > .row');
    if(top&&!document.getElementById('bcWhatsAppTop')){const a=makeButton('Open Team Chat',WHATSAPP);a.id='bcWhatsAppTop';top.appendChild(a)}
    const share=$('share');
    if(share&&!document.getElementById('bcWhatsAppCard')){const card=document.createElement('div');card.className='card';card.id='bcWhatsAppCard';card.innerHTML='<strong>Team Communication</strong><p class="muted">Use the Bunt Cakes WhatsApp group for team communication.</p>';card.appendChild(makeButton('Open Bunt Cakes WhatsApp',WHATSAPP));share.prepend(card)}
  }

  function readHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{return[]}}
  function writeHistory(rows){localStorage.setItem(HISTORY_KEY,JSON.stringify(rows))}
  function renderHistory(){
    const box=$('bcScoreHistoryList');if(!box)return;const rows=readHistory();
    if(!rows.length){box.innerHTML='<div class="muted">No saved game scores yet.</div>';return}
    box.innerHTML=rows.slice().reverse().map(r=>`<div style="display:grid;grid-template-columns:1.4fr .7fr .7fr auto;gap:8px;align-items:center;padding:9px 0;border-top:1px solid var(--line)"><div><strong>${r.date}</strong><div class="muted">${r.opponent}</div></div><div>Bunt Cakes <strong>${r.team}</strong></div><div>Opponent <strong>${r.them}</strong></div><button data-delete-history="${r.id}">Delete</button></div>`).join('');
    box.querySelectorAll('[data-delete-history]').forEach(b=>b.addEventListener('click',()=>{writeHistory(readHistory().filter(r=>r.id!==b.dataset.deleteHistory));renderHistory()}));
  }
  function addScoreHistory(){
    const score=$('score');if(!score||$('bcSaveScore'))return;
    const controls=document.createElement('div');controls.className='card';controls.innerHTML='<strong>Weekly Game Result</strong><p class="muted">Save the final score after each game so the season record stays in the app.</p><div class="grid g2"><label>Opponent<input id="bcHistoryOpponent" placeholder="Opponent name"></label><label>Game date<input id="bcHistoryDate" type="date"></label></div><button id="bcSaveScore" class="primary" style="margin-top:8px">Save This Game Score</button>';
    const history=document.createElement('div');history.className='card';history.innerHTML='<div class="row wrap"><strong>Saved Game Scores</strong><span id="bcSeasonRecord" class="pill"></span></div><div id="bcScoreHistoryList" style="margin-top:8px"></div>';
    score.appendChild(controls);score.appendChild(history);
    const date=$('bcHistoryDate');if(date&&!date.value)date.value=new Date().toISOString().slice(0,10);
    $('bcSaveScore').addEventListener('click',()=>{
      const team=Number(($('teamScore')?.textContent||'0').trim())||0;const them=Number(($('opponentScore')?.textContent||'0').trim())||0;
      const opponent=($('bcHistoryOpponent').value||'Opponent').trim();const raw=$('bcHistoryDate').value;const formatted=raw?new Date(raw+'T12:00:00').toLocaleDateString() : new Date().toLocaleDateString();
      const rows=readHistory();rows.push({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),date:formatted,opponent,team,them});writeHistory(rows);renderHistory();renderRecord();
    });
    renderHistory();renderRecord();
  }
  function renderRecord(){const el=$('bcSeasonRecord');if(!el)return;const rows=readHistory();let w=0,l=0,t=0;rows.forEach(r=>r.team>r.them?w++:r.team<r.them?l++:t++);el.textContent=`Record ${w}-${l}${t?'-'+t:''}`}
  function init(){addWhatsApp();addScoreHistory()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();