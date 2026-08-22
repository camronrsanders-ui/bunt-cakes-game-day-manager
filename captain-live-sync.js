(()=>{
  let attempts=0;

  function install(){
    if(typeof queueSave!=='function'||typeof api!=='function'||typeof state==='undefined'||!state){
      if(attempts++<120)setTimeout(install,50);
      return;
    }
    if(window.__buntCaptainLiveSyncInstalled)return;
    window.__buntCaptainLiveSyncInstalled=true;

    let timer=null;
    let saving=false;
    let pending=null;
    let retryTimer=null;
    let lastServerVersion='';
    let lastSyncedState=null;
    const bootState=JSON.parse(JSON.stringify(state||{}));
    const status=document.getElementById('saveStatus');

    const snapshot=()=>JSON.parse(JSON.stringify(state||{}));
    const clone=v=>JSON.parse(JSON.stringify(v==null?{}:v));
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const isObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
    const show=(html)=>{if(status)status.innerHTML=html};
    const whenLabel=value=>value?new Date(value).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}):'now';

    function mergeLocalChanges(base,local,remote){
      if(Array.isArray(local)||Array.isArray(base)||Array.isArray(remote))return same(local,base)?clone(remote):clone(local);
      if(!isObject(local)||!isObject(base)||!isObject(remote))return same(local,base)?clone(remote):clone(local);
      const out=clone(remote);
      const keys=new Set([...Object.keys(base),...Object.keys(local)]);
      for(const key of keys){
        const inBase=Object.prototype.hasOwnProperty.call(base,key);
        const inLocal=Object.prototype.hasOwnProperty.call(local,key);
        if(!inLocal&&inBase){delete out[key];continue;}
        if(inLocal&&!inBase){out[key]=clone(local[key]);continue;}
        if(inLocal&&inBase){
          const b=base[key],l=local[key],r=remote[key];
          if(isObject(b)&&isObject(l)&&isObject(r))out[key]=mergeLocalChanges(b,l,r);
          else if(!same(l,b))out[key]=clone(l);
        }
      }
      return out;
    }

    async function sharedState(){
      return api('/api/team-state?fresh='+Date.now());
    }

    function renderShared(){
      if(typeof render==='function')render();
      if(typeof renderCaptainField==='function')renderCaptainField();
      window.dispatchEvent(new Event('buntpreferrednamesrefresh'));
    }

    let primePromise=null;
    async function ensurePrime(){
      if(lastServerVersion)return;
      if(primePromise)return primePromise;
      primePromise=(async()=>{
        try{
          const r=await sharedState();
          const remote=clone(r.state||{});
          const local=snapshot();
          lastServerVersion=String(r.updatedAt||'');
          lastSyncedState=clone(remote);
          if(!same(local,bootState)){
            const merged=mergeLocalChanges(bootState,local,remote);
            state=clone(merged);
            pending=clone(merged);
            renderShared();
          }else if(!same(local,remote)){
            state=clone(remote);
            renderShared();
          }
        }catch(_){}
      })();
      await primePromise;
    }

    async function savePayload(payload){
      const r=await fetch('/api/team-state',{
        method:'PUT',
        credentials:'include',
        cache:'no-store',
        headers:{'Content-Type':'application/json','Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'},
        body:JSON.stringify({state:payload,expectedUpdatedAt:lastServerVersion||''})
      });
      const j=await r.json().catch(()=>({}));
      if(r.status===409&&j&&j.state)return{conflict:true,...j};
      if(!r.ok)throw new Error(j.error||'Live save failed');
      return j;
    }

    async function drain(){
      if(saving||!pending)return;
      saving=true;
      clearTimeout(retryTimer);
      retryTimer=null;
      try{
        await ensurePrime();
        while(pending){
          const payload=pending;
          pending=null;
          try{
            const r=await savePayload(payload);
            if(r.conflict){
              const remote=clone(r.state||{});
              const base=lastSyncedState||remote;
              const merged=mergeLocalChanges(base,payload,remote);
              lastServerVersion=String(r.updatedAt||'');
              lastSyncedState=clone(remote);
              state=clone(merged);
              pending=clone(merged);
              renderShared();
              show('Syncing your change with a recent player update…');
              continue;
            }
            lastServerVersion=String(r.updatedAt||lastServerVersion);
            lastSyncedState=clone(payload);
            show('<span class="ok">Saved live</span> • players updating • '+whenLabel(r.updatedAt));
          }catch(e){
            if(!pending)pending=payload;
            show('<span class="warn">Not saved: '+(e.message||'live save failed')+'</span>');
            retryTimer=setTimeout(drain,1200);
            break;
          }
        }
      }finally{
        saving=false;
        if(pending&&!retryTimer)retryTimer=setTimeout(drain,100);
      }
    }

    queueSave=function(){
      clearTimeout(timer);
      pending=snapshot();
      show('Saving live…');
      timer=setTimeout(drain,80);
    };

    window.buntCakesSaveNow=function(){
      clearTimeout(timer);
      pending=snapshot();
      show('Saving live…');
      return drain();
    };

    window.__buntCaptainLiveSyncBusy=()=>saving||!!pending;

    async function syncExternalChanges(){
      if(!state||saving||pending||document.hidden)return;
      const active=document.activeElement;
      if(active&&/^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName))return;
      try{
        const r=await sharedState();
        const version=String(r.updatedAt||'');
        if(!version)return;
        if(!lastServerVersion){
          lastServerVersion=version;
          lastSyncedState=clone(r.state||{});
          return;
        }
        if(version===lastServerVersion)return;
        state=clone(r.state||{});
        const n=Math.min(7,Math.max(1,Number(state.gameInning)||1));
        state.gameInning=n;
        state.fieldInning=n;
        lastServerVersion=version;
        lastSyncedState=clone(state);
        renderShared();
        show('<span class="ok">Live lineup updated</span> • player change received • '+whenLabel(r.updatedAt));
      }catch(_){}
    }

    function setLiveInning(value){
      if(!state)return;
      const n=Math.min(7,Math.max(1,Number(value)||1));
      state.gameInning=n;
      state.fieldInning=n;

      const dashboardInning=document.getElementById('inning');
      const lineupInning=document.getElementById('lineupInning');
      if(dashboardInning)dashboardInning.value=String(n);
      if(lineupInning)lineupInning.value=String(n);

      if(typeof renderDash==='function')renderDash();
      if(typeof renderLineup==='function')renderLineup();
      if(typeof renderCaptainField==='function')renderCaptainField();
      queueSave();
    }

    const currentInning=document.getElementById('inning');
    if(currentInning){
      const label=currentInning.closest('label');
      if(label&&label.firstChild)label.firstChild.nodeValue='Live game inning ';
      currentInning.onchange=()=>setLiveInning(currentInning.value);
    }

    const lineupInning=document.getElementById('lineupInning');
    if(lineupInning){
      const label=lineupInning.closest('label');
      if(label&&label.firstChild)label.firstChild.nodeValue='Live inning — players see this ';
      lineupInning.onchange=()=>setLiveInning(lineupInning.value);

      const card=lineupInning.closest('.card');
      if(card&&!document.getElementById('lineupInningHelp')){
        const help=document.createElement('div');
        help.id='lineupInningHelp';
        help.className='muted';
        help.style.marginTop='6px';
        help.textContent='Changing this inning immediately makes the same inning and defensive lineup live on every player view.';
        card.appendChild(help);
      }
    }

    function repairOldMismatch(tries=0){
      if(!state){
        if(tries<100)setTimeout(()=>repairOldMismatch(tries+1),100);
        return;
      }
      const editor=Number(state.fieldInning)||1;
      const live=Number(state.gameInning)||1;
      if(editor!==live)setLiveInning(editor);
    }

    ensurePrime();
    setTimeout(()=>repairOldMismatch(),100);
    setInterval(syncExternalChanges,2000);
    window.addEventListener('focus',syncExternalChanges);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden&&pending)drain();
      if(!document.hidden)syncExternalChanges();
    });
  }

  install();
})();
