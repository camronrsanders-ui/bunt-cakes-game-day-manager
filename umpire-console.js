(()=>{
  const API=()=>`/api/team-state/umpire?team=${encodeURIComponent(window.__teamSlug||'those-dirty-bunt-cakes')}`;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clean=v=>String(v??'').trim();
  const isCaptain=()=>!!document.getElementById('manager');
  const pairedPlayer=()=>typeof state!=='undefined'&&state?.playerAccess?.paired===true?clean(state.playerAccess.playerName):'';
  const zone=()=>typeof state!=='undefined'&&state?.team?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:zone()});
  let remote={role:'',actorName:'',events:[],games:{}};
  let selectedEventId='';
  let loading=false;
  let writing=false;
  let writeChain=Promise.resolve();
  let installed=false;

  function defaultGame(){return{teamAName:'',teamBName:'',teamAScore:0,teamBScore:0,balls:0,fouls:0,outs:0,inning:1,kickingTeam:'b',updatedAt:null,updatedBy:''};}
  function normalizedGame(value){
    const raw=value&&typeof value==='object'?value:{};
    const n=(v,min,max,fallback)=>{const x=Number(v);return Number.isInteger(x)?Math.max(min,Math.min(max,x)):fallback;};
    return{...defaultGame(),...raw,teamAName:clean(raw.teamAName).slice(0,80),teamBName:clean(raw.teamBName).slice(0,80),teamAScore:n(raw.teamAScore,0,99,0),teamBScore:n(raw.teamBScore,0,99,0),balls:n(raw.balls,0,4,0),fouls:n(raw.fouls,0,4,0),outs:n(raw.outs,0,3,0),inning:n(raw.inning,1,12,1),kickingTeam:raw.kickingTeam==='a'?'a':'b'};
  }
  function gameFor(id){return normalizedGame(remote.games?.[id]);}
  function eventSort(a,b){return((a.date||'9999-12-31')+(a.time||'')).localeCompare((b.date||'9999-12-31')+(b.time||''));}
  function visibleEvents(){
    const all=(remote.events||[]).slice().sort(eventSort),t=today(),up=all.filter(e=>!e.date||e.date>=t);
    return up.length?up:all.slice(-3);
  }
  function selectDefaultEvent(){
    const events=visibleEvents();
    if(events.some(e=>e.eventId===selectedEventId))return;
    const t=today(),sameDay=events.find(e=>e.date===t);
    selectedEventId=(sameDay||events[0]||{}).eventId||'';
  }
  function time12(value){if(!value)return'';const [h,m]=String(value).split(':').map(Number);return new Date(2000,0,1,h,m||0).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});}
  function eventLabel(e){
    if(!e)return'Officiating game';
    const d=e.date?new Date(e.date+'T12:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}):'Date TBD';
    return `${d}${e.time?' • '+time12(e.time):''}${e.location?' • '+e.location:''}`;
  }
  function teamA(g){return clean(g.teamAName)||'Home';}
  function teamB(g){return clean(g.teamBName)||'Away';}
  function editingConsole(){
    const el=document.activeElement;
    if(!el||!['INPUT','SELECT','TEXTAREA'].includes(el.tagName))return false;
    return !!(el.closest('#umpire')||el.closest('#captainUmpireConsole'));
  }

  function ensureStyles(){
    if(document.getElementById('umpireConsoleStyles'))return;
    const style=document.createElement('style');style.id='umpireConsoleStyles';style.textContent=`
      .umpire-console{display:grid;gap:10px}.umpire-hero{border:2px solid #f59e0b;background:#fffaf0}.umpire-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.umpire-title{margin:.2rem 0}.umpire-event-select{width:100%;margin-top:8px}.umpire-team-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.umpire-team-card{padding:12px;text-align:center}.umpire-team-card input{font-weight:800;text-align:center}.umpire-score{font-size:3rem;font-weight:900;line-height:1;margin:12px 0}.umpire-score-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.umpire-score-actions button{font-size:1.25rem;font-weight:900}.umpire-status-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.umpire-count-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.umpire-count{padding:12px;text-align:center}.umpire-count strong{display:block;font-size:2rem}.umpire-count-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.umpire-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.umpire-live{font-size:.86rem;color:#166534;font-weight:800}.umpire-live.warn{color:#991b1b}.captain-dashboard-umpire-moved{display:none!important}#dashboard.umpire-dashboard-compact>.grid.g3:first-child{grid-template-columns:1fr 1fr!important}#dashboard.umpire-dashboard-compact>.grid.g3:first-child>.card:nth-child(3){grid-column:1/-1}#dashboard.umpire-dashboard-compact>.grid.g3:first-child>.card{padding:12px}
      @media(max-width:560px){.umpire-team-grid,.umpire-status-grid,.umpire-actions{grid-template-columns:1fr}.umpire-count-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.umpire-score{font-size:2.5rem}}
      @media(max-width:390px){.umpire-count-grid{grid-template-columns:1fr}.umpire-count{display:grid;grid-template-columns:1fr 1fr;align-items:center}.umpire-count-actions{grid-column:1/-1}}
    `;document.head.appendChild(style);
  }

  function compactCaptainDashboard(){
    if(!isCaptain())return;
    const dash=document.getElementById('dashboard');if(!dash)return;
    dash.classList.add('umpire-dashboard-compact');
    const grids=[...dash.children].filter(el=>el.classList?.contains('grid')&&el.classList?.contains('g3'));
    if(grids[1])grids[1].classList.add('captain-dashboard-umpire-moved');
  }

  function playerTabButton(){return document.getElementById('umpirePlayerTab');}
  function playerSection(){return document.getElementById('umpire');}
  function activatePlayerUmpire(){
    document.querySelectorAll('.tabs button').forEach(btn=>btn.classList.toggle('on',btn.id==='umpirePlayerTab'));
    ['home','schedule','lineup','pods','kicking','officials','resources','umpire'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
    playerSection()?.classList.remove('hidden');
    loadRemote(true);
  }
  function ensurePlayerMount(show){
    if(isCaptain())return null;
    let btn=playerTabButton(),section=playerSection();
    if(!show){
      if(btn)btn.remove();
      if(section){const wasOpen=!section.classList.contains('hidden');section.remove();if(wasOpen)document.querySelector('[data-tab="home"]')?.click();}
      return null;
    }
    const tabs=document.querySelector('.tabs');
    if(!btn&&tabs){btn=document.createElement('button');btn.id='umpirePlayerTab';btn.type='button';btn.textContent='Umpire';btn.onclick=activatePlayerUmpire;const officials=tabs.querySelector('[data-tab="officials"]');if(officials)officials.insertAdjacentElement('afterend',btn);else tabs.appendChild(btn);}
    if(!section){section=document.createElement('section');section.id='umpire';section.className='stack hidden';const app=document.querySelector('.app');app?.appendChild(section);}
    return section;
  }
  function ensureCaptainMount(){
    if(!isCaptain())return null;
    const section=document.getElementById('officials');if(!section)return null;
    let host=document.getElementById('captainUmpireConsole');
    if(!host){host=document.createElement('div');host.id='captainUmpireConsole';host.className='stack';section.insertAdjacentElement('afterbegin',host);}
    return host;
  }

  function setLiveStatus(message,warn=false){
    document.querySelectorAll('[data-umpire-live]').forEach(el=>{el.textContent=message;el.classList.toggle('warn',warn);});
  }

  function renderConsole(host){
    if(!host)return;
    const events=visibleEvents();selectDefaultEvent();
    if(!events.length){
      host.innerHTML='<div class="card umpire-hero"><h2 class="umpire-title">Umpire Console</h2><div class="muted">No umpire assignment is available right now.</div></div>';
      return;
    }
    const event=events.find(e=>e.eventId===selectedEventId)||events[0],g=gameFor(event.eventId),a=teamA(g),b=teamB(g);
    const eventOptions=events.map(e=>`<option value="${esc(e.eventId)}" ${e.eventId===event.eventId?'selected':''}>${esc(eventLabel(e))}</option>`).join('');
    const innings=Array.from({length:12},(_,i)=>`<option value="${i+1}" ${g.inning===i+1?'selected':''}>${i+1}</option>`).join('');
    const nextHalf=g.kickingTeam==='b'?`Switch sides → ${a}`:`Next inning → ${Math.min(12,g.inning+1)}`;
    host.innerHTML=`<div class="umpire-console"><div class="card umpire-hero"><div class="umpire-head"><div><div class="muted">LIVE OFFICIATING TOOL</div><h2 class="umpire-title">Umpire Console</h2><div class="muted">${esc(eventLabel(event))}</div><div class="muted">Away kicks first • Home fields first</div></div><span class="pill">${isCaptain()?'Captain view':'You are the umpire'}</span></div>${events.length>1?`<label>Officiating slot<select id="umpireEventSelect" class="umpire-event-select">${eventOptions}</select></label>`:''}<div class="umpire-live" data-umpire-live>${g.updatedAt?'Live • updated '+new Date(g.updatedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}):'Ready'}</div></div><div class="umpire-team-grid"><div class="card umpire-team-card"><label>Home<input id="umpireTeamA" value="${esc(g.teamAName)}" placeholder="Enter home team" autocomplete="off"></label><div class="umpire-score">${g.teamAScore}</div><div class="umpire-score-actions"><button type="button" data-score-team="a" data-score-delta="-1">−</button><button type="button" class="primary" data-score-team="a" data-score-delta="1">+ Run</button></div></div><div class="card umpire-team-card"><label>Away<input id="umpireTeamB" value="${esc(g.teamBName)}" placeholder="Enter away team" autocomplete="off"></label><div class="umpire-score">${g.teamBScore}</div><div class="umpire-score-actions"><button type="button" data-score-team="b" data-score-delta="-1">−</button><button type="button" class="primary" data-score-team="b" data-score-delta="1">+ Run</button></div></div></div><div class="card"><div class="umpire-status-grid"><label>Inning<select id="umpireInning">${innings}</select></label><label>Kicking now<select id="umpireKicking"><option value="a" ${g.kickingTeam==='a'?'selected':''}>${esc(a)}</option><option value="b" ${g.kickingTeam==='b'?'selected':''}>${esc(b)}</option></select></label></div><div class="umpire-count-grid" style="margin-top:10px"><div class="umpire-count"><span class="muted">Balls</span><strong>${g.balls}</strong><div class="umpire-count-actions"><button type="button" data-count="balls" data-count-delta="-1">−</button><button type="button" data-count="balls" data-count-delta="1">+</button></div></div><div class="umpire-count"><span class="muted">Fouls</span><strong>${g.fouls}</strong><div class="umpire-count-actions"><button type="button" data-count="fouls" data-count-delta="-1">−</button><button type="button" data-count="fouls" data-count-delta="1">+</button></div></div><div class="umpire-count"><span class="muted">Outs</span><strong>${g.outs}</strong><div class="umpire-count-actions"><button type="button" data-count="outs" data-count-delta="-1">−</button><button type="button" data-count="outs" data-count-delta="1">+</button></div></div></div><div class="umpire-actions" style="margin-top:10px"><button type="button" id="umpireResetCounts">Reset balls / fouls / outs</button><button type="button" id="umpireNextHalf" class="primary">${esc(nextHalf)}</button></div></div></div>`;

    host.querySelector('#umpireEventSelect')?.addEventListener('change',e=>{selectedEventId=e.target.value;renderAll();});
    host.querySelector('#umpireTeamA')?.addEventListener('change',e=>mutate({teamAName:e.target.value}));
    host.querySelector('#umpireTeamB')?.addEventListener('change',e=>mutate({teamBName:e.target.value}));
    host.querySelector('#umpireInning')?.addEventListener('change',e=>mutate({inning:Number(e.target.value)}));
    host.querySelector('#umpireKicking')?.addEventListener('change',e=>mutate({kickingTeam:e.target.value}));
    host.querySelectorAll('[data-score-team]').forEach(btn=>btn.onclick=()=>{
      const current=gameFor(selectedEventId),key=btn.dataset.scoreTeam==='a'?'teamAScore':'teamBScore',delta=Number(btn.dataset.scoreDelta||0);
      mutate({[key]:Math.max(0,Math.min(99,current[key]+delta))});
    });
    host.querySelectorAll('[data-count]').forEach(btn=>btn.onclick=()=>{
      const current=gameFor(selectedEventId),key=btn.dataset.count,delta=Number(btn.dataset.countDelta||0),max=key==='outs'?3:4;
      mutate({[key]:Math.max(0,Math.min(max,current[key]+delta))});
    });
    host.querySelector('#umpireResetCounts')?.addEventListener('click',()=>mutate({balls:0,fouls:0,outs:0}));
    host.querySelector('#umpireNextHalf')?.addEventListener('click',()=>{
      const current=gameFor(selectedEventId);
      mutate(current.kickingTeam==='b'
        ?{kickingTeam:'a',balls:0,fouls:0,outs:0}
        :{kickingTeam:'b',inning:Math.min(12,current.inning+1),balls:0,fouls:0,outs:0});
    });
  }

  function renderAll(){
    ensureStyles();compactCaptainDashboard();
    if(isCaptain())renderConsole(ensureCaptainMount());
    else{
      const eligible=(remote.events||[]).length>0;
      const host=ensurePlayerMount(eligible);
      if(host)renderConsole(host);
    }
  }

  async function loadRemote(force=false){
    if(loading&&!force)return;
    if(!isCaptain()&&!pairedPlayer()){remote={role:'',actorName:'',events:[],games:{}};renderAll();return;}
    loading=true;
    try{
      const r=await fetch(API(),{credentials:'include',cache:'no-store',headers:{'Cache-Control':'no-cache, no-store, must-revalidate'}}),j=await r.json().catch(()=>({}));
      if(!r.ok){
        if(r.status===401||r.status===403){remote={role:'',actorName:'',events:[],games:{}};if(!editingConsole())renderAll();return;}
        throw new Error(j.error||'Could not load umpire console');
      }
      remote={role:j.role||'',actorName:j.actorName||'',events:Array.isArray(j.events)?j.events:[],games:j.games&&typeof j.games==='object'?j.games:{}};
      selectDefaultEvent();if(!editingConsole())renderAll();
    }catch(e){setLiveStatus(e.message||'Umpire console offline',true);}
    finally{loading=false;}
  }

  function mutate(patch){
    const eventId=selectedEventId;if(!eventId)return Promise.resolve(false);
    writeChain=writeChain.then(async()=>{
      writing=true;
      try{
        const current=gameFor(eventId);remote.games[eventId]={...current,...patch,updatedAt:new Date().toISOString(),updatedBy:remote.actorName||''};renderAll();setLiveStatus('Saving…');
        const r=await fetch(API(),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId,patch})}),j=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(j.error||'Could not save umpire update');
        remote.games[eventId]=normalizedGame(j.game);renderAll();setLiveStatus('Saved live • '+new Date(j.game?.updatedAt||Date.now()).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}));return true;
      }finally{writing=false;}
    }).catch(async e=>{setLiveStatus(e.message||'Save failed',true);await loadRemote(true);return false;});
    return writeChain;
  }

  function shouldPoll(){
    if(document.hidden||writing||editingConsole())return false;
    if(isCaptain())return !document.getElementById('officials')?.classList.contains('hidden');
    return !playerSection()?.classList.contains('hidden');
  }
  function install(){
    if(installed)return;if(typeof state==='undefined'||!state){setTimeout(install,150);return;}
    installed=true;ensureStyles();compactCaptainDashboard();
    document.querySelector('[data-tab="officials"]')?.addEventListener('click',()=>setTimeout(()=>loadRemote(true),0));
    window.addEventListener('buntpreferrednamesrefresh',()=>{if(!editingConsole())loadRemote(true)});
    window.addEventListener('teamplayeraccesschange',()=>loadRemote(true));
    window.addEventListener('focus',()=>{if(!editingConsole())loadRemote(true)});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!editingConsole())loadRemote(true)});
    document.addEventListener('focusout',event=>{if(event.target?.closest?.('#umpire,#captainUmpireConsole'))setTimeout(()=>renderAll(),80)},true);
    setInterval(()=>{if(shouldPoll())loadRemote(false)},2000);
    loadRemote(true);
  }
  window.BuntUmpireConsole={refresh:()=>loadRemote(true)};
  install();
})();