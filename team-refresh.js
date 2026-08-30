(()=>{
  const btn=document.getElementById('refresh');
  const updated=document.getElementById('updated');
  const error=document.getElementById('error');
  if(!btn)return;

  let lastVersion='';
  let missingTeam=false;
  let activeController=null;
  let activeRequest=0;
  let lastSuccessfulCheck=null;
  let resetButtonTimer=null;

  function liveInning(){return Number((state&&state.gameInning)||(state&&state.fieldInning)||1);}
  function playerAccess(value){const access=value&&typeof value==='object'?value:{};return access.paired===true?{paired:true,playerId:String(access.playerId||''),playerName:String(access.playerName||''),fullName:String(access.fullName||'')}:{paired:false};}
  function accessSignature(value){const access=playerAccess(value);return access.paired?[access.playerId,access.playerName,access.fullName].join('|'):'unpaired';}
  function canonicalizePlayer(access){
    if(!access||access.paired!==true)return;const name=String(access.playerName||'').trim();if(!name)return;
    const storageKey=window.__teamStorageKey?window.__teamStorageKey('playerName'):'teamgameday:playerName';try{localStorage.setItem(storageKey,name);}catch(_){}
    try{const url=new URL(location.href);if(url.searchParams.get('player')===name)return;url.searchParams.set('player',name);history.replaceState(history.state,'',url.pathname+url.search+url.hash);}catch(_){}
  }
  function showMissingTeam(message){
    missingTeam=true;const text=String(message||'Team was not found').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));document.title='Team not found';
    document.body.innerHTML='<main style="max-width:560px;margin:12vh auto;padding:20px;font-family:system-ui,-apple-system,sans-serif;color:#1f2937"><div style="background:#fff;border:1px solid #d1d5db;border-radius:22px;padding:24px;text-align:center;box-shadow:0 12px 35px rgba(15,23,42,.08)"><img src="/generic-team-icon.svg" alt="Game Day" style="width:88px;height:88px"><h1 style="margin:.6rem 0 .35rem">Team not found</h1><p style="color:#6b7280;margin:.2rem 0 1.2rem">'+text+'. The team link may be incorrect or the team may have been removed.</p><a href="/start" style="display:inline-block;text-decoration:none;background:#15803d;color:#fff;font-weight:800;padding:12px 16px;border-radius:12px">Go to Team Game Day</a></div></main>';
  }
  if(typeof renderLineup==='function'){
    renderLineup=function(){
      const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      const n=liveInning(),inn=(state&&state.innings&&state.innings[n])||{},positions=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
      const label=document.getElementById('lineupLabel'),positionsBox=document.getElementById('positions'),homeBox=document.getElementById('homeLineup');if(label)label.textContent='Current game inning '+n;
      const html=positions.map(p=>'<div class="card"><div class="muted">'+escapeHtml(p)+'</div><strong>'+escapeHtml(inn[p]||'Unassigned')+'</strong></div>').join('');if(positionsBox)positionsBox.innerHTML=html;if(homeBox)homeBox.innerHTML=html;
    };
  }
  function timeLabel(value){return new Date(value).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});}
  function showLiveCheck(serverUpdatedAt,prefix='Live'){if(!updated)return;lastSuccessfulCheck=new Date();updated.textContent=prefix+' • '+timeLabel(lastSuccessfulCheck);if(serverUpdatedAt){updated.title='Team data last changed '+new Date(serverUpdatedAt).toLocaleString();updated.dataset.serverUpdatedAt=String(serverUpdatedAt);}}
  function showManualStart(){clearTimeout(resetButtonTimer);btn.disabled=true;btn.textContent='Refreshing…';if(updated)updated.textContent='Checking live data…';}
  function showManualDone(){btn.disabled=false;btn.textContent='Updated ✓';clearTimeout(resetButtonTimer);resetButtonTimer=setTimeout(()=>{if(!missingTeam){btn.textContent='Refresh';btn.disabled=false;}},700);}
  async function refreshLiveTeam(manual=false){
    if(missingTeam)return;if(activeController){if(!manual)return;try{activeController.abort();}catch(_){}}
    const controller=new AbortController(),requestId=++activeRequest;activeController=controller;if(manual)showManualStart();
    try{
      const r=await fetch('/api/team-state?fresh='+Date.now(),{cache:'no-store',signal:controller.signal,headers:{'Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'}}),j=await r.json();
      if(r.status===404){showMissingTeam(j.error);return;}if(!r.ok)throw new Error(j.error||'Could not refresh live team data');
      const incoming=j.state||{},nextAccess=playerAccess(incoming.playerAccess),previousAccess=accessSignature(state&&state.playerAccess),accessChanged=previousAccess!==accessSignature(nextAccess),version=String(j.updatedAt||''),changed=!lastVersion||version!==lastVersion;
      if(changed){state=incoming;state.playerAccess=nextAccess;const n=Number(state.gameInning||state.fieldInning||1);state.gameInning=n;state.fieldInning=n;canonicalizePlayer(nextAccess);if(typeof render==='function')render();window.dispatchEvent(new Event('buntpreferrednamesrefresh'));lastVersion=version;}
      else if(state){state.playerAccess=nextAccess;canonicalizePlayer(nextAccess);}
      if(accessChanged)window.dispatchEvent(new Event('teamplayeraccesschange'));if(error)error.classList.add('hidden');showLiveCheck(j.updatedAt,manual?'Refreshed':'Live');if(manual)showManualDone();
    }catch(e){if(e&&e.name==='AbortError')return;if(manual){if(error){error.textContent=e.message||'Could not refresh live team data';error.classList.remove('hidden');}if(updated)updated.textContent='Refresh failed';btn.disabled=false;btn.textContent='Try again';}}
    finally{if(requestId===activeRequest)activeController=null;}
  }
  btn.onclick=()=>refreshLiveTeam(true);window.teamGameDayRefresh=()=>refreshLiveTeam(true);window.buntCakesRefresh=window.teamGameDayRefresh;
  setInterval(()=>{if(!document.hidden)refreshLiveTeam(false)},2000);window.addEventListener('focus',()=>refreshLiveTeam(false));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLiveTeam(false)});setTimeout(()=>refreshLiveTeam(false),100);
})();

(()=>{
  const founder='those-dirty-bunt-cakes';
  if(window.__teamSlug&&window.__teamSlug!==founder){const scoreLabel=document.querySelector('#home .grid.g3 .card .muted');if(scoreLabel)scoreLabel.textContent='Team';const resources=document.getElementById('resources');if(resources)resources.innerHTML='<div class="card"><strong>Team Resources</strong><div class="muted">Links selected by your captain.</div></div><div class="card muted">No resources have been added yet.</div>';}
  const tab=document.querySelector('[data-tab="pods"]');if(tab)tab.textContent='My Rotation';const section=document.getElementById('pods');if(section)section.innerHTML='<div class="card"><strong>Loading My Rotation…</strong><div class="muted">Getting your live field position, next switch, and full game plan.</div></div>';
  const helpers=[
    ['data-bunt-field-rotation','/team-field-rotation.js?v=9'],
    ['data-bunt-team-usability','/team-usability.js?v=3'],
    ['data-team-officiating-view','/team-officiating-view.js?v=1'],
    ['data-team-role-badges','/team-role-badges.js?v=1'],
    ['data-bunt-preferred-names','/preferred-names.js?v=2'],
    ['data-bunt-attendance','/team-attendance.js?v=6'],
    ['data-bunt-access-checkin','/team-access-checkin.js?v=4'],
    ['data-team-branding','/team-branding.js?v=3'],
    ['data-team-onboarding','/team-onboarding.js?v=3']
  ];
  helpers.forEach(([attr,src])=>{if(document.querySelector('script['+attr+']'))return;const script=document.createElement('script');script.async=false;script.src=src;script.setAttribute(attr,'1');document.head.appendChild(script);});
})();
