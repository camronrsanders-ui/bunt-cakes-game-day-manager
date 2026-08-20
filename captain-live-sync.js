(()=>{
  let attempts=0;

  function install(){
    if(typeof queueSave!=='function'||typeof api!=='function'||typeof state==='undefined'){
      if(attempts++<80)setTimeout(install,50);
      return;
    }
    if(window.__buntCaptainLiveSyncInstalled)return;
    window.__buntCaptainLiveSyncInstalled=true;

    let timer=null;
    let saving=false;
    let pending=null;
    let retryTimer=null;
    const status=document.getElementById('saveStatus');

    const snapshot=()=>JSON.parse(JSON.stringify(state||{}));
    const show=(html)=>{if(status)status.innerHTML=html};

    async function drain(){
      if(saving||!pending)return;
      saving=true;
      clearTimeout(retryTimer);
      try{
        while(pending){
          const payload=pending;
          pending=null;
          try{
            const r=await api('/api/team-state',{
              method:'PUT',
              body:JSON.stringify({state:payload})
            });
            const when=r.updatedAt?new Date(r.updatedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}):'now';
            show('<span class="ok">Saved live</span> • players updating • '+when);
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

    // Repair state created by the old split controls. Once captain data has loaded,
    // the lineup inning becomes the live inning so player and captain views agree.
    function repairOldMismatch(tries=0){
      if(!state){
        if(tries<100)setTimeout(()=>repairOldMismatch(tries+1),100);
        return;
      }
      const editor=Number(state.fieldInning)||1;
      const live=Number(state.gameInning)||1;
      if(editor!==live)setLiveInning(editor);
    }
    setTimeout(()=>repairOldMismatch(),100);

    document.addEventListener('visibilitychange',()=>{
      if(document.hidden&&pending)drain();
    });
  }

  install();
})();
