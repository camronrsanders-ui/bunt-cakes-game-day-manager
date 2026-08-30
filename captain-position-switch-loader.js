(()=>{
  let loaded=false,loading=false;
  const zone=()=>typeof state!=='undefined'&&state?.team?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:zone()});
  function hasUpcomingGame(){
    return typeof state!=='undefined'&&state&&Array.isArray(state.events)&&state.events.some(e=>e&&e.type==='Game'&&e.date&&e.date>=today());
  }
  function showNoGame(){
    const section=document.getElementById('pods');if(!section)return;
    const tab=document.querySelector('[data-tab="pods"]');if(tab)tab.textContent='Fielding';
    section.innerHTML='<div class="card"><h2 style="margin:.2rem 0">Fielding</h2><div class="muted">No upcoming game is posted yet. Sync or add the next game first; then Fielding will use that game’s RSVPs and rotation assignments.</div></div>';
  }
  function load(){
    if(loaded||loading)return;
    if(typeof state==='undefined'||!state){setTimeout(load,150);return;}
    if(!hasUpcomingGame()){showNoGame();return;}
    loading=true;
    const script=document.createElement('script');
    script.src='/captain-position-switches.js?v=3';
    script.dataset.positionSwitchController='1';
    script.onload=()=>{loaded=true;loading=false};
    script.onerror=()=>{loading=false;setTimeout(load,1000)};
    document.head.appendChild(script);
  }
  window.addEventListener('buntpreferrednamesrefresh',load);
  window.addEventListener('focus',load);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
  load();
})();
