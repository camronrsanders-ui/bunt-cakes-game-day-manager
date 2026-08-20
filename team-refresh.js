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

  // Player-facing lineup and score header use the same normalized live inning.
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
  window.buntCakesRefresh=()=>refreshLiveTeam(true);
  setInterval(()=>{if(!document.hidden)refreshLiveTeam(false)},3000);
  window.addEventListener('focus',()=>refreshLiveTeam(false));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLiveTeam(false)});
  setTimeout(()=>refreshLiveTeam(false),250);
})();

(()=>{
  // Replace the old Pods organizer without adding another Serverless Function.
  const tab=document.querySelector('[data-tab="pods"]');
  if(tab)tab.textContent='My Rotation';
  const section=document.getElementById('pods');
  if(section) section.innerHTML='<div class="card"><strong>Loading My Rotation…</strong><div class="muted">Getting the live inning and your seven-inning plan.</div></div>';

  if(!document.querySelector('script[data-bunt-field-rotation]')){
    const script=document.createElement('script');
    script.src='/team-field-rotation.js?v=6';
    script.dataset.buntFieldRotation='1';
    document.head.appendChild(script);
  }
  if(!document.querySelector('script[data-bunt-team-usability]')){
    const script=document.createElement('script');
    script.src='/team-usability.js?v=1';
    script.dataset.buntTeamUsability='1';
    document.head.appendChild(script);
  }
})();
