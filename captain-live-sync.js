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
    let deferredRenderTimer=null;
    let conflictRetries=0;
    let lastServerVersion='';
    let lastSyncedState=null;
    let scrollBusyUntil=0;
    const bootState=JSON.parse(JSON.stringify(state||{}));
    const status=document.getElementById('saveStatus');

    const snapshot=()=>JSON.parse(JSON.stringify(state||{}));
    const clone=v=>JSON.parse(JSON.stringify(v==null?{}:v));
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const isObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
    const entityCollections=new Set(['players','events','pods']);
    const show=(html)=>{if(status)status.innerHTML=html};
    const whenLabel=value=>value?new Date(value).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}):'now';

    function markScrollBusy(){
      scrollBusyUntil=Date.now()+900;
    }

    function interactionBusy(){
      if(Date.now()<scrollBusyUntil)return true;
      try{
        if(typeof window.__buntCaptainInteractionBusy==='function')return !!window.__buntCaptainInteractionBusy();
      }catch(_){}
      const active=document.activeElement;
      return !!(active&&/^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName));
    }

    function entityKey(item,collection){
      if(!item||typeof item!=='object'||Array.isArray(item))return'';
      const id=String(item.id||'').trim();
      if(id)return'id:'+id;
      if(collection==='events'){
        const sourceUid=String(item.sourceUid||'').trim();
        if(sourceUid)return'source:'+sourceUid;
      }
      return'';
    }

    function mergeEntityArray(base,local,remote,path,collection){
      if(![base,local,remote].every(Array.isArray))return same(local,base)?clone(remote):clone(local);
      const all=[...base,...local,...remote];
      if(all.some(item=>!entityKey(item,collection)))return same(local,base)?clone(remote):clone(local);

      const baseMap=new Map(base.map(item=>[entityKey(item,collection),item]));
      const localMap=new Map(local.map(item=>[entityKey(item,collection),item]));
      const remoteMap=new Map(remote.map(item=>[entityKey(item,collection),item]));
      const localRemoved=new Set([...baseMap.keys()].filter(key=>!localMap.has(key)));
      const handled=new Set();
      const out=[];

      remote.forEach(remoteItem=>{
        const key=entityKey(remoteItem,collection);
        handled.add(key);
        if(localRemoved.has(key))return;
        const localItem=localMap.get(key);
        const baseItem=baseMap.get(key);
        if(localItem&&baseItem){
          out.push(mergeLocalChanges(baseItem,localItem,remoteItem,path+'[]'));
        }else if(localItem){
          out.push(clone(localItem));
        }else{
          out.push(clone(remoteItem));
        }
      });

      local.forEach(localItem=>{
        const key=entityKey(localItem,collection);
        if(handled.has(key))return;
        const baseItem=baseMap.get(key);
        if(!baseItem){
          out.push(clone(localItem));
          return;
        }
        if(!remoteMap.has(key)&&!same(localItem,baseItem))out.push(clone(localItem));
      });

      return out;
    }

    function mergeLocalChanges(base,local,remote,path=''){
      if(Array.isArray(local)||Array.isArray(base)||Array.isArray(remote)){
        const collection=String(path||'').split('.').pop();
        if(entityCollections.has(collection))return mergeEntityArray(base,local,remote,path,collection);
        return same(local,base)?clone(remote):clone(local);
      }
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
          const childPath=path?path+'.'+key:key;
          if((isObject(b)&&isObject(l)&&isObject(r))||(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r))){
            out[key]=mergeLocalChanges(b,l,r,childPath);
          }else if(!same(l,b)){
            out[key]=clone(l);
          }
        }
      }
      return out;
    }

    async function sharedState(){
      return api('/api/team-state?fresh='+Date.now());
    }

    function restoreScrollPosition(x,y){
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          if(Math.abs((window.scrollY||0)-y)>1||Math.abs((window.scrollX||0)-x)>1){
            window.scrollTo(x,y);
          }
        });
      });
    }

    function renderSharedNow(){
      const scrollX=window.scrollX||0;
      const scrollY=window.scrollY||0;
      if(typeof render==='function')render();
      if(typeof renderCaptainField==='function')renderCaptainField();
      window.dispatchEvent(new Event('buntpreferrednamesrefresh'));
      restoreScrollPosition(scrollX,scrollY);
    }

    function scheduleDeferredRender(){
      clearTimeout(deferredRenderTimer);
      deferredRenderTimer=setTimeout(()=>{
        deferredRenderTimer=null;
        if(interactionBusy()){
          scheduleDeferredRender();
          return;
        }
        renderSharedNow();
      },500);
    }

    function renderShared(){
      if(interactionBusy()){
        scheduleDeferredRender();
        return false;
      }
      clearTimeout(deferredRenderTimer);
      deferredRenderTimer=null;
      renderSharedNow();
      return true;
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
              show('Syncing your change with a recent player update…');
              conflictRetries=Math.min(conflictRetries+1,5);
              const delay=Math.min(1600,250*Math.pow(2,conflictRetries-1));
              retryTimer=setTimeout(drain,delay);
              break;
            }
            conflictRetries=0;
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
      if(!state||saving||pending||document.hidden||interactionBusy())return;
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

    window.addEventListener('scroll',markScrollBusy,{passive:true});
    document.addEventListener('touchmove',markScrollBusy,{passive:true});
    document.addEventListener('wheel',markScrollBusy,{passive:true});

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
