(function(){
  const STYLE_ID='bunt-captain-attendance-style';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .cap-attendance{border:2px solid #86efac;background:#f0fdf4}
      .cap-att-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}
      .cap-att-stat{background:#fff;border:1px solid #bbf7d0;border-radius:12px;padding:9px;text-align:center}.cap-att-stat strong{display:block;font-size:1.35rem}
      .cap-att-list{display:grid;gap:6px}.cap-att-row{background:#fff;border:1px solid #dcfce7;border-radius:10px;padding:8px 10px;display:flex;justify-content:space-between;gap:10px}
      .cap-att-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.cap-att-actions button{flex:1 1 190px;font-weight:800}
      @media(max-width:520px){.cap-att-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;document.head.appendChild(style);
  }
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});
  const esc=v=>String(v??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
  function dates(){const t=today();return[...new Set((state?.events||[]).filter(e=>e&&e.type==='Game'&&e.date>=t).map(e=>e.date).filter(d=>new Date(d+'T12:00:00').getDay()===0))].sort()}
  function target(){return dates()[0]||''}
  function pretty(d){return new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}
  function mount(){const dash=document.getElementById('dashboard');if(!dash)return null;let card=document.getElementById('captainAttendance');if(!card){card=document.createElement('div');card.id='captainAttendance';card.className='card cap-attendance';dash.prepend(card)}return card}
  function render(){
    if(typeof state==='undefined'||!state)return;const card=mount();if(!card)return;const date=target();
    if(!date){card.innerHTML='<strong>Sunday Availability</strong><div class="muted">No upcoming Sunday game is scheduled.</div>';return}
    const responses=state.availability?.[date]||{},players=state.players||[];
    const groups={yes:[],no:[],not_sure:[],missing:[]};players.forEach(p=>{const s=responses[p.name]?.status;if(s==='yes'||s==='no'||s==='not_sure')groups[s].push(p.name);else groups.missing.push(p.name)});
    const label=s=>s==='yes'?'Yes':s==='no'?'No':s==='not_sure'?'Not sure':'No response';
    const order=['yes','no','not_sure','missing'];
    card.innerHTML=`<div class="row wrap"><div><div class="muted">SUNDAY LINEUP AVAILABILITY</div><h2 style="margin:.25rem 0">${esc(pretty(date))}</h2><div class="muted">Players answer from Team View. This panel refreshes automatically.</div></div><span class="pill">Thursday reminder</span></div>
      <div class="cap-att-grid"><div class="cap-att-stat"><strong>${groups.yes.length}</strong>Yes</div><div class="cap-att-stat"><strong>${groups.no.length}</strong>No</div><div class="cap-att-stat"><strong>${groups.not_sure.length}</strong>Not sure</div><div class="cap-att-stat"><strong>${groups.missing.length}</strong>No response</div></div>
      <div class="cap-att-list">${order.map(k=>'<div class="cap-att-row"><strong>'+label(k)+'</strong><span>'+esc(groups[k].join(', ')||'—')+'</span></div>').join('')}</div>
      <div class="cap-att-actions"><button id="applySundayAttendance" class="primary">Use Yes / No for lineup</button><button id="copyMissingAttendance">Copy unanswered names</button></div>`;
    document.getElementById('applySundayAttendance').onclick=()=>{let changed=0;players.forEach(p=>{const s=responses[p.name]?.status;if(s==='yes'&&p.present!==true){p.present=true;changed++}if(s==='no'&&p.present!==false){p.present=false;changed++}});if(typeof queueSave==='function')queueSave();if(typeof renderRoster==='function')renderRoster();alert(changed?'Sunday answers applied to the roster. Not sure and unanswered players were left unchanged.':'The roster already matches the Yes / No answers.')};
    document.getElementById('copyMissingAttendance').onclick=async()=>{const text=groups.missing.join(', ');if(!text){alert('Everyone has answered.');return}try{await navigator.clipboard.writeText(text);alert('Unanswered player names copied.')}catch(e){prompt('Copy unanswered players:',text)}};
  }
  async function pull(){try{const r=await fetch('/api/team-state?attendance='+Date.now(),{cache:'no-store'}),j=await r.json();if(r.ok&&state){state.availability=j.state?.availability||{};render()}}catch(e){}}
  const wait=setInterval(()=>{if(typeof state==='undefined'||!state||!document.getElementById('dashboard'))return;clearInterval(wait);render();setInterval(()=>{if(!document.hidden)pull()},10000)},250);
  window.addEventListener('focus',pull);
})();
