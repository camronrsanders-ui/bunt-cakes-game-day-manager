(()=>{
  let attempts=0;
  function loadFieldAutoSync(){
    if(window.__buntFieldAutoSyncLoaderAdded||document.querySelector('script[data-bunt-field-auto-sync]'))return;
    window.__buntFieldAutoSyncLoaderAdded=true;
    const script=document.createElement('script');
    script.src='/captain-field-auto-sync.js?v=1';
    script.dataset.buntFieldAutoSync='1';
    document.head.appendChild(script);
  }
  function install(){
    if(typeof window.buntCakesSaveNow!=='function'||typeof window.__buntCaptainLiveSyncBusy!=='function'){
      if(attempts++<160)setTimeout(install,50);
      return;
    }
    if(window.__buntCaptainSaveReliabilityInstalled){loadFieldAutoSync();return;}
    window.__buntCaptainSaveReliabilityInstalled=true;
    const baseSaveNow=window.buntCakesSaveNow;
    window.buntCakesSaveNow=async function(){
      await Promise.resolve(baseSaveNow());
      const deadline=Date.now()+8000;
      while(window.__buntCaptainLiveSyncBusy()){
        if(Date.now()>deadline)throw new Error('Save is still syncing');
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      return true;
    };
    window.addEventListener('pagehide',()=>{
      try{if(window.__buntCaptainLiveSyncBusy())baseSaveNow();}catch(_){}
    });
    loadFieldAutoSync();
  }
  install();
})();
