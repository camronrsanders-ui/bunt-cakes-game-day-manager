(function(){
  const STYLE_ID='bunt-captain-attendance-style';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .cap-attendance{border:2px solid #86efac;background:#f0fdf4}
      .cap-att-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}
      .cap-att-stat{background:#fff;border:1px solid #bbf7d0;border-radius:12px;padding:9px;text-align:center}.cap-att-stat strong{display:block;font-size:1.35rem}
      .cap-att-list{display:grid;gap:6px}.cap-att-row{background:#fff;border:1px solid #dcfce7;border-radius:10px;padding:8px 10px;display:flex;justify-content:space-between;gap:10px}
      .cap-att-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.cap-att-actions button{flex:1 1 190px;font-weight:800}
      .cap-vote{background:#fff;border:2px solid #bbf7d0;border-radius:14px;padding:12px;margin:12px 0}.cap-vote-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:9px}.cap-vote-buttons button{font-weight:900}.cap-vote-buttons button.on{background:#15803d;color:#fff;border-color:#15803d}.cap-vote-buttons button.no.on{background:#b91c1c;border-color:#b91c1c}.cap-vote-buttons button.maybe.on{background:#a16207;border-color:#a16207}.cap-section-title{margin-top:12px;font-weight:900}.cap-vote-saved{font-weight:800;color:#166534;margin-top:7px}
      @media(max-width:520px){.cap-att-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cap-vote-buttons{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }

  const esc=v=>String(v??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
  const valid=s=>s==='yes'||s==='no'||s==='not_sure';
  let captains=[];
  let session=null;
  let saving=false;
  const zone=()=>state?.team?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:zone()});

  function dates(){
    const t=today();
    return [...new Set((state?.events||[]).filter(e=>e&&e.type==='Game'&&e.date>=t).map(e=>e.date).filter(d=>new Date(d+'T12:00:00').getDay()===0))].sort();
  }
  function target(){return dates()[0]||''}
  function pretty(d){return new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}
  function mount(){const dash=document.getElementById('dashboard');if(!dash)return null;let card=document.getElementById('captainAttendance');if(!card){card=document.createElement('div');card.id='captainAttendance';card.className='card cap-attendance';dash.prepend(card)}return card}
  function answerLabel(s){return s==='yes'?'Yes':s==='no'?'No':s==='not_sure'?'Not sure':'No response'}
  function currentCaptain(){
    const email=String(session?.user?.email||'').toLowerCase();
    return captains.find(c=>String(c.email||'').toLowerCase()===email)||null;
  }
  function linkedPlayerName(c){
    if(!c)return'';
    const players=state?.players||[];
    const email=String(c.email||'').trim().toLowerCase();
    const explicit=state?.captainPlayerLinks?.[email];
    if(explicit&&players.some(p=>p&&p.name===explicit))return explicit;
    const display=String(c.display_name||'').trim().toLowerCase();
    const byName=players.find(p=>String(p?.name||'').trim().toLowerCase()===display);
    if(byName)return byName.name;
    const byFull=players.find(p=>String(p?.fullName||'').trim().toLowerCase()===display);
    return byFull?.name||'';
  }
  function captainForPlayer(playerName){return captains.find(c=>linkedPlayerName(c)===playerName)||null}
  function effectivePlayerStatus(playerName,responses,captainResponses){
    const direct=responses[playerName]?.status;if(valid(direct))return direct;
    const cap=captainForPlayer(playerName);if(!cap)return'';
    const legacy=captainResponses[String(cap.email||'').toLowerCase()]?.status;
    return valid(legacy)?legacy:'';
  }

  function render(){
    if(typeof state==='undefined'||!state)return;
    const card=mount();if(!card)return;
    const date=target();
    if(!date){card.innerHTML='<strong>Sunday Availability</strong><div class="muted">No upcoming Sunday game is scheduled.</div>';return}

    const responses=state.availability?.[date]||{};
    const players=state.players||[];
    const captainResponses=responses._captains||{};
    const playerGroups={yes:[],no:[],not_sure:[],missing:[]};
    players.forEach(p=>{const s=effectivePlayerStatus(p.name,responses,captainResponses);if(valid(s))playerGroups[s].push(p.name);else playerGroups.missing.push(p.name)});

    const captainGroups={yes:[],no:[],not_sure:[],missing:[]};
    const unlinkedCaptains=captains.filter(c=>!linkedPlayerName(c));
    unlinkedCaptains.forEach(c=>{
      const key=String(c.email||'').toLowerCase(),s=captainResponses[key]?.status,name=c.display_name||c.email;
      if(valid(s))captainGroups[s].push(name);else captainGroups.missing.push(name);
    });

    const me=currentCaptain(),meKey=String(me?.email||session?.user?.email||'').toLowerCase();
    const mePlayer=linkedPlayerName(me);
    const myAnswer=mePlayer?effectivePlayerStatus(mePlayer,responses,captainResponses):(meKey?captainResponses[meKey]?.status||'':'');
    const total={yes:playerGroups.yes.length+captainGroups.yes.length,no:playerGroups.no.length+captainGroups.no.length,not_sure:playerGroups.not_sure.length+captainGroups.not_sure.length,missing:playerGroups.missing.length+captainGroups.missing.length};
    const order=['yes','no','not_sure','missing'];
    const captainSection=unlinkedCaptains.length?`<div class="cap-section-title">Non-playing captains</div><div class="cap-att-list">${order.map(k=>'<div class="cap-att-row"><strong>'+answerLabel(k)+'</strong><span>'+esc(captainGroups[k].join(', ')||'—')+'</span></div>').join('')}</div>`:'';
    const captainCopyButton=unlinkedCaptains.length?'<button id="copyMissingCaptains">Copy unanswered captains</button>':'';

    card.innerHTML=`<div class="row wrap"><div><div class="muted">SUNDAY LINEUP AVAILABILITY</div><h2 style="margin:.25rem 0">${esc(pretty(date))}</h2><div class="muted">Everyone is counted once. Captains who are also players use their roster record.</div></div><span class="pill">Weekly RSVP</span></div>
      ${session?.authenticated?`<div class="cap-vote"><div class="muted">YOUR AVAILABILITY${mePlayer?' • PLAYER + CAPTAIN':''}</div><strong>${esc(mePlayer||me?.display_name||session?.user?.displayName||'Captain')}, will you be there?</strong><div class="cap-vote-buttons"><button data-cap-vote="yes" class="${myAnswer==='yes'?'on':''}">✅ Yes</button><button data-cap-vote="no" class="no ${myAnswer==='no'?'on':''}">❌ No</button><button data-cap-vote="not_sure" class="maybe ${myAnswer==='not_sure'?'on':''}">🤔 Not sure</button></div>${myAnswer?`<div class="cap-vote-saved">Your vote is saved: ${answerLabel(myAnswer)}</div>`:''}</div>`:''}
      <div class="cap-att-grid"><div class="cap-att-stat"><strong>${total.yes}</strong>Yes</div><div class="cap-att-stat"><strong>${total.no}</strong>No</div><div class="cap-att-stat"><strong>${total.not_sure}</strong>Not sure</div><div class="cap-att-stat"><strong>${total.missing}</strong>No response</div></div>
      <div class="cap-section-title">Team</div><div class="cap-att-list">${order.map(k=>'<div class="cap-att-row"><strong>'+answerLabel(k)+'</strong><span>'+esc(playerGroups[k].join(', ')||'—')+'</span></div>').join('')}</div>
      ${captainSection}
      <div class="cap-att-actions"><button id="applySundayAttendance" class="primary">Use Yes / No for lineup</button><button id="copyMissingAttendance">Copy unanswered team members</button>${captainCopyButton}</div>`;

    card.querySelectorAll('[data-cap-vote]').forEach(btn=>btn.onclick=()=>saveCaptainVote(btn.dataset.capVote,date));
    document.getElementById('applySundayAttendance').onclick=()=>{let changed=0;players.forEach(p=>{const s=effectivePlayerStatus(p.name,responses,captainResponses);if(s==='yes'&&p.present!==true){p.present=true;changed++}if(s==='no'&&p.present!==false){p.present=false;changed++}});if(typeof queueSave==='function')queueSave();if(typeof renderRoster==='function')renderRoster();alert(changed?'Answers applied to the roster. Not sure and unanswered people were left unchanged.':'The roster already matches the Yes / No answers.')};
    document.getElementById('copyMissingAttendance').onclick=()=>copyNames(playerGroups.missing,'Everyone on the team roster has answered.','Unanswered team member names copied.');
    const missingCaptains=document.getElementById('copyMissingCaptains');if(missingCaptains)missingCaptains.onclick=()=>copyNames(captainGroups.missing,'Every non-playing captain has answered.','Unanswered captain names copied.');
  }

  async function copyNames(names,emptyMessage,successMessage){
    const text=names.join(', ');if(!text){alert(emptyMessage);return}
    try{await navigator.clipboard.writeText(text);alert(successMessage)}catch(e){prompt('Copy names:',text)}
  }

  async function saveCaptainVote(status,date){
    if(saving)return;saving=true;
    try{
      const r=await fetch('/api/captains',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'availability-response',gameDate:date,status})});
      const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not save availability');
      state.availability=state.availability||{};state.availability[date]=state.availability[date]||{};
      if(j.playerName){
        state.availability[date][j.playerName]={status,respondedAt:j.respondedAt,displayName:j.displayName,role:session?.team?.role||'captain',source:'captain-login'};
      }else{
        const key=String(session?.user?.email||'').toLowerCase();
        state.availability[date]._captains=state.availability[date]._captains||{};
        state.availability[date]._captains[key]={status,respondedAt:j.respondedAt,displayName:j.displayName,role:session?.team?.role||'captain'};
      }
      render();
    }catch(e){alert(e.message||'Could not save availability')}finally{saving=false}
  }

  async function pull(){
    try{
      const [stateRes,captainRes,sessionRes]=await Promise.all([
        fetch('/api/team-state?attendance='+Date.now(),{cache:'no-store'}),
        fetch('/api/captains',{cache:'no-store',credentials:'include'}),
        fetch('/api/session',{cache:'no-store',credentials:'include'})
      ]);
      const stateJson=await stateRes.json(),captainJson=await captainRes.json(),sessionJson=await sessionRes.json();
      if(stateRes.ok&&state){state.availability=stateJson.state?.availability||{};state.team=stateJson.state?.team||state.team;state.captainPlayerLinks=stateJson.state?.captainPlayerLinks||{}}
      if(captainRes.ok)captains=captainJson.captains||[];
      if(sessionRes.ok)session=sessionJson;
      render();
    }catch(e){}
  }

  const wait=setInterval(()=>{if(typeof state==='undefined'||!state||!document.getElementById('dashboard'))return;clearInterval(wait);pull();setInterval(()=>{if(!document.hidden)pull()},10000)},250);
  window.addEventListener('focus',pull);
})();
