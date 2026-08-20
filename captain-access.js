(function(){
  const fmt=value=>value?new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}):'';

  async function loadAccess(){
    const host=document.getElementById('access');
    if(!host)return;
    let box=document.getElementById('phoneAccessTracker');
    if(!box){
      box=document.createElement('div');
      box.id='phoneAccessTracker';
      box.className='card';
      box.innerHTML='<div class="row wrap"><div><strong>Player Phone Access</strong><div class="muted">Confirms who has opened the team site and who has launched it from their Home Screen.</div></div><button id="refreshPhoneAccess">Refresh</button></div><div id="phoneAccessRows" style="margin-top:10px">Loading…</div>';
      host.prepend(box);
      document.getElementById('refreshPhoneAccess').onclick=loadAccess;
    }
    const rows=document.getElementById('phoneAccessRows');
    try{
      const [accessRes,stateRes]=await Promise.all([
        fetch('/api/player-access',{cache:'no-store',credentials:'same-origin'}),
        fetch('/api/team-state',{cache:'no-store'})
      ]);
      if(!accessRes.ok)throw new Error('Could not load phone access');
      const accessJson=await accessRes.json();
      const stateJson=await stateRes.json();
      const access=accessJson.access||{};
      const players=(stateJson.state?.players||[]).slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));
      const installed=players.filter(p=>access[p.name]?.installedAt).length;
      const browserOnly=players.filter(p=>access[p.name]?.browserSeenAt&&!access[p.name]?.installedAt).length;
      const unseen=players.length-installed-browserOnly;
      rows.innerHTML='<div class="grid g3" style="margin-bottom:10px"><div class="card" style="border-color:#86efac"><div class="muted">Home Screen confirmed</div><div class="big">'+installed+'</div></div><div class="card" style="border-color:#fde68a"><div class="muted">Browser only</div><div class="big">'+browserOnly+'</div></div><div class="card" style="border-color:#fecaca"><div class="muted">Not seen yet</div><div class="big">'+unseen+'</div></div></div>'+players.map(p=>{const a=access[p.name]||{};const status=a.installedAt?'✅ Home Screen confirmed':a.browserSeenAt?'🟡 Browser opened':'❌ Not opened yet';const detail=a.installedAt?'Confirmed '+fmt(a.installedAt):a.browserSeenAt?'First seen '+fmt(a.browserSeenAt):'No phone check-in yet';return '<div class="row wrap" style="padding:9px 0;border-top:1px solid var(--l)"><div><strong>'+(p.fullName||p.name)+'</strong><div class="muted">'+detail+'</div></div><span class="pill">'+status+'</span></div>'}).join('');
    }catch(error){rows.innerHTML='<div class="error">'+error.message+'</div>'}
  }

  const timer=setInterval(()=>{if(document.getElementById('access')){clearInterval(timer);loadAccess()}},300);
  setInterval(loadAccess,30000);
})();