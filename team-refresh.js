(()=>{
  const btn=document.getElementById('refresh');
  const updated=document.getElementById('updated');
  const error=document.getElementById('error');
  if(!btn)return;

  let busy=false;
  let lastVersion='';

  function liveInning(){
    return Number((state&&state.gameInning)||(state&&state.fieldInning)||1);
  }

  if(typeof renderLineup==='function'){
    renderLineup=function(){
      const n=liveInning();
      const inn=(state&&state.innings&&state.innings[n])||{};
      const positions=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
      const label=document.getElementById('lineupLabel');
      const positionsBox=document.getElementById('positions');
      const homeBox=document.getElementById('homeLineup');
      if(label)label.textContent='Current game inning '+n;
      const html=positions.map(p=>'<div class="card"><div class="muted">'+p+'</div><strong>'+(inn[p]||'Unassigned')+'</strong></div>').join('');
      if(positionsBox)positionsBox.innerHTML=html;
      if(homeBox)homeBox.innerHTML=html;
    };
  }

  function showLiveTime(serverTime,prefix='Live'){
    if(!updated)return;
    if(!serverTime){updated.textContent=prefix;return;}
    updated.textContent=prefix+' • '+new Date(serverTime).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});
  }

  async function refreshLiveTeam(manual=false){
    if(busy)return;
    busy=true;
    if(manual){
      btn.disabled=true;
      btn.textContent='Refreshing…';
      if(updated)updated.textContent='Refreshing…';
    }

    try{
      const r=await fetch('/api/team-state?fresh='+Date.now(),{
        cache:'no-store',
        headers:{'Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'}
      });
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||'Could not refresh live team data');

      const version=String(j.updatedAt||'');
      if(manual||version!==lastVersion){
        state=j.state||{};
        const n=Number(state.gameInning||state.fieldInning||1);
        state.gameInning=n;
        state.fieldInning=n;
        if(typeof render==='function')render();
        window.dispatchEvent(new Event('buntpreferrednamesrefresh'));
        lastVersion=version;
      }
      if(error)error.classList.add('hidden');
      showLiveTime(j.updatedAt,manual?'Refreshed':'Live');
    }catch(e){
      if(manual){
        if(error){error.textContent=e.message||'Could not refresh live team data';error.classList.remove('hidden');}
        if(updated)updated.textContent='Refresh failed';
      }
    }finally{
      busy=false;
      if(manual){btn.disabled=false;btn.textContent='Refresh';}
    }
  }

  btn.onclick=()=>refreshLiveTeam(true);
  window.teamGameDayRefresh=()=>refreshLiveTeam(true);
  window.buntCakesRefresh=window.teamGameDayRefresh;
  setInterval(()=>{if(!document.hidden)refreshLiveTeam(false)},3000);
  window.addEventListener('focus',()=>refreshLiveTeam(false));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLiveTeam(false)});
  setTimeout(()=>refreshLiveTeam(false),250);
})();

(()=>{
  const founder='those-dirty-bunt-cakes';
  if(window.__teamSlug&&window.__teamSlug!==founder){
    const scoreLabel=document.querySelector('#home .grid.g3 .card .muted');
    if(scoreLabel)scoreLabel.textContent='Team';
    const resources=document.getElementById('resources');
    if(resources)resources.innerHTML='<div class="card"><strong>Team Resources</strong><div class="muted">Links selected by your captain.</div></div><div class="card muted">No resources have been added yet.</div>';
  }

  const tab=document.querySelector('[data-tab="pods"]');
  if(tab)tab.textContent='My Rotation';
  const section=document.getElementById('pods');
  if(section)section.innerHTML='<div class="card"><strong>Loading My Rotation…</strong><div class="muted">Getting the live inning and your seven-inning plan.</div></div>';

  const helpers=[
    ['data-bunt-field-rotation','/team-field-rotation.js?v=8'],
    ['data-bunt-team-usability','/team-usability.js?v=2'],
    ['data-bunt-preferred-names','/preferred-names.js?v=2'],
    ['data-bunt-attendance','/team-attendance.js?v=3'],
    ['data-bunt-access-checkin','/team-access-checkin.js?v=3'],
    ['data-team-branding','/team-branding.js?v=3']
  ];
  helpers.forEach(([attr,src])=>{
    if(document.querySelector('script['+attr+']'))return;
    const script=document.createElement('script');
    script.src=src;
    script.setAttribute(attr,'1');
    document.head.appendChild(script);
  });
})();
