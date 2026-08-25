(function(){
  const fmt=value=>value?new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}):'';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let loading=false;

  async function jsonFetch(url,opt={}){
    const response=await fetch(url,{credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
    return data;
  }

  async function copyText(value){
    if(navigator.clipboard&&typeof navigator.clipboard.writeText==='function'){
      try{await navigator.clipboard.writeText(value);return true}catch(_){}
    }
    let area=null;
    try{
      area=document.createElement('textarea');
      area.value=value;
      area.setAttribute('readonly','');
      area.style.position='fixed';
      area.style.opacity='0';
      document.body.appendChild(area);
      area.select();
      if(document.execCommand('copy'))return true;
    }catch(_){}finally{
      if(area)area.remove();
    }
    window.prompt('Copy this one-time player setup link:',value);
    return false;
  }

  function button(label,className){
    const b=document.createElement('button');
    b.type='button';
    b.textContent=label;
    if(className)b.className=className;
    return b;
  }

  function playerRow(player,appAccess,identity,notice){
    const row=document.createElement('div');
    row.style.padding='11px 0';
    row.style.borderTop='1px solid var(--l)';

    const top=document.createElement('div');
    top.className='row wrap';
    const info=document.createElement('div');
    const name=document.createElement('strong');
    name.textContent=player.fullName||player.name||'Player';
    info.appendChild(name);

    const appDetail=document.createElement('div');
    appDetail.className='muted';
    appDetail.textContent=appAccess.installedAt?'App access: Home Screen confirmed '+fmt(appAccess.installedAt):appAccess.captainLoginAt?'App access: Captain login confirmed '+fmt(appAccess.captainLoginAt):appAccess.browserSeenAt?'App access: Browser opened '+fmt(appAccess.browserSeenAt):'App access: Not opened yet';
    info.appendChild(appDetail);

    const identityDetail=document.createElement('div');
    identityDetail.className='muted';
    const count=Number(identity.activeDevices||0);
    let identityText=count===1?'Player access: 1 paired device':count>1?`Player access: ${count} paired devices`:'Player access: Not paired';
    if(identity.pendingInvite){
      identityText+=' • Setup link pending';
      if(identity.inviteExpiresAt)identityText+=' until '+fmt(identity.inviteExpiresAt);
    }
    identityDetail.textContent=identityText;
    info.appendChild(identityDetail);
    top.appendChild(info);

    const pill=document.createElement('span');
    pill.className='pill';
    pill.textContent=count>0?`✅ ${count} paired`:(identity.pendingInvite?'🟡 Setup pending':'🔒 Not paired');
    top.appendChild(pill);
    row.appendChild(top);

    const actions=document.createElement('div');
    actions.className='row wrap';
    actions.style.justifyContent='flex-start';
    actions.style.marginTop='8px';
    const setup=button('New setup link','primary');
    const reset=button('Reset player access','danger');
    actions.appendChild(setup);
    actions.appendChild(reset);
    row.appendChild(actions);

    setup.onclick=async()=>{
      setup.disabled=true;
      setup.textContent='Creating…';
      try{
        const result=await jsonFetch('/api/team-state',{method:'POST',body:JSON.stringify({action:'create-player-invite',playerId:player.id})});
        const absolute=new URL(String(result.inviteUrl||''),location.origin);
        if(absolute.origin!==location.origin||!/^[A-Za-z0-9_-]{43}$/.test(new URLSearchParams(absolute.hash.slice(1)).get('pair')||''))throw new Error('Could not create a valid player setup link');
        const copied=await copyText(absolute.href);
        notice.textContent=copied?`New setup link copied for ${player.fullName||player.name}.`:`New setup link created for ${player.fullName||player.name}. Copy it from the prompt.`;
        setup.textContent=copied?'Copied':'Link created';
        setTimeout(loadAccess,500);
      }catch(error){
        notice.textContent=error.message||'Could not create player setup link';
        setup.disabled=false;
        setup.textContent='New setup link';
      }
    };

    reset.onclick=async()=>{
      const label=player.fullName||player.name||'this player';
      if(!window.confirm(`Reset player access for ${label}? This signs out all paired devices and invalidates any unused setup link.`))return;
      reset.disabled=true;
      reset.textContent='Resetting…';
      try{
        await jsonFetch('/api/team-state',{method:'POST',body:JSON.stringify({action:'reset-player-access',playerId:player.id})});
        notice.textContent=`Player access reset for ${label}.`;
        await loadAccess();
      }catch(error){
        notice.textContent=error.message||'Could not reset player access';
        reset.disabled=false;
        reset.textContent='Reset player access';
      }
    };

    return row;
  }

  async function loadAccess(){
    const host=document.getElementById('access');
    if(!host||loading)return;
    let box=document.getElementById('phoneAccessTracker');
    if(!box){
      box=document.createElement('div');
      box.id='phoneAccessTracker';
      box.className='card';
      box.innerHTML='<div class="row wrap"><div><strong>Team Access</strong><div class="muted">App access shows who opened or installed the team site. Player access shows authenticated paired devices.</div><div class="muted" style="margin-top:4px">Creating a new setup link replaces any unused setup link but does not disconnect already paired devices.</div></div><button id="refreshPhoneAccess">Refresh</button></div><div id="playerAccessNotice" class="muted" style="margin-top:8px"></div><div id="phoneAccessRows" style="margin-top:10px">Loading…</div>';
      host.prepend(box);
      document.getElementById('refreshPhoneAccess').onclick=loadAccess;
    }
    const rows=document.getElementById('phoneAccessRows');
    const notice=document.getElementById('playerAccessNotice');
    loading=true;
    try{
      const [stateJson,identityJson]=await Promise.all([
        jsonFetch('/api/team-state'),
        jsonFetch('/api/team-state?playerAccess=1')
      ]);
      const access=stateJson.state?.appAccess||{};
      const players=(stateJson.state?.players||[]).slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));
      const identityById=new Map((identityJson.players||[]).map(item=>[String(item.playerId||''),item]));
      const confirmed=players.filter(p=>access[p.name]?.installedAt||access[p.name]?.captainLoginAt).length;
      const browserOnly=players.filter(p=>access[p.name]?.browserSeenAt&&!access[p.name]?.installedAt&&!access[p.name]?.captainLoginAt).length;
      const unseen=players.length-confirmed-browserOnly;
      rows.innerHTML='<div class="grid g3" style="margin-bottom:10px"><div class="card" style="border-color:#86efac"><div class="muted">Access confirmed</div><div class="big">'+confirmed+'</div></div><div class="card" style="border-color:#fde68a"><div class="muted">Browser only</div><div class="big">'+browserOnly+'</div></div><div class="card" style="border-color:#fecaca"><div class="muted">Not seen yet</div><div class="big">'+unseen+'</div></div></div>';
      players.forEach(player=>{
        const appAccess=access[player.name]||{};
        const identity=identityById.get(String(player.id||''))||{playerId:String(player.id||''),activeDevices:0,pendingInvite:false,inviteExpiresAt:null};
        rows.appendChild(playerRow(player,appAccess,identity,notice));
      });
    }catch(error){
      rows.innerHTML='<div class="error">'+esc(error.message||'Could not load team access')+'</div>';
    }finally{
      loading=false;
    }
  }

  const timer=setInterval(()=>{if(document.getElementById('access')){clearInterval(timer);loadAccess()}},300);
  setInterval(loadAccess,30000);
})();
// Build retry after Vercel rate-limit window cleared.
