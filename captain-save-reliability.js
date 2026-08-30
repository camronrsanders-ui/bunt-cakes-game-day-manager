(()=>{
  let attempts=0;
  function install(){
    if(typeof window.buntCakesSaveNow!=='function'||typeof window.__buntCaptainLiveSyncBusy!=='function'){
      if(attempts++<160)setTimeout(install,50);
      return;
    }
    if(window.__buntCaptainSaveReliabilityInstalled)return;
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
  }
  install();
})();
