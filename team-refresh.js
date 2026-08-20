(()=>{
  const btn=document.getElementById('refresh');
  const updated=document.getElementById('updated');
  const error=document.getElementById('error');
  if(!btn)return;

  let busy=false;

  async function refreshLiveTeam(){
    if(busy)return;
    busy=true;
    btn.disabled=true;
    btn.textContent='Refreshing…';
    if(updated)updated.textContent='Refreshing…';

    try{
      const r=await fetch('/api/team-state?fresh='+Date.now(),{
        cache:'no-store',
        headers:{
          'Cache-Control':'no-cache, no-store, must-revalidate',
          'Pragma':'no-cache'
        }
      });
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||'Could not refresh live team data');

      state=j.state||{};
      if(typeof render==='function')render();
      if(error)error.classList.add('hidden');
      if(updated)updated.textContent='Refreshed just now';
    }catch(e){
      if(error){
        error.textContent=e.message||'Could not refresh live team data';
        error.classList.remove('hidden');
      }
      if(updated)updated.textContent='Refresh failed';
    }finally{
      busy=false;
      btn.disabled=false;
      btn.textContent='Refresh';
    }
  }

  btn.onclick=refreshLiveTeam;
  window.buntCakesRefresh=refreshLiveTeam;
})();

(()=>{
  if(document.querySelector('script[data-bunt-pods-organizer]'))return;
  const script=document.createElement('script');
  script.src='/team-pods-organizer.js?v=2';
  script.dataset.buntPodsOrganizer='1';
  document.head.appendChild(script);
})();
