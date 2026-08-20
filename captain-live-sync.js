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

    const currentInning=document.getElementById('inning');
    if(currentInning){
      const label=currentInning.closest('label');
      if(label&&label.firstChild)label.firstChild.nodeValue='Current game inning ';
      currentInning.addEventListener('change',()=>{
        state.gameInning=Number(currentInning.value)||1;
        state.fieldInning=state.gameInning;
        const editInning=document.getElementById('lineupInning');
        if(editInning)editInning.value=String(state.fieldInning);
        if(typeof renderLineup==='function')renderLineup();
        if(typeof renderCaptainField==='function')renderCaptainField();
        queueSave();
      });
    }

    const lineupInning=document.getElementById('lineupInning');
    if(lineupInning){
      const label=lineupInning.closest('label');
      if(label&&label.firstChild)label.firstChild.nodeValue='Edit lineup for inning ';
      const card=lineupInning.closest('.card');
      if(card&&!document.getElementById('lineupInningHelp')){
        const help=document.createElement('div');
        help.id='lineupInningHelp';
        help.className='muted';
        help.style.marginTop='6px';
        help.textContent='This only changes the inning you are editing. Players follow Current game inning on the Dashboard.';
        card.appendChild(help);
      }
    }

    document.addEventListener('visibilitychange',()=>{
      if(document.hidden&&pending)drain();
    });
  }

  install();
})();
