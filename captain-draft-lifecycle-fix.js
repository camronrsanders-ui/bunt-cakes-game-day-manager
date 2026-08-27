(function(){
  let clearingLegacy=false;
  const successPrefix='Balanced seven-inning draft built.';

  function manager(){return document.getElementById('gameDayPodManager');}

  function clearLegacyDraft(){
    if(clearingLegacy)return;
    const legacy=document.getElementById('discardPodRotation');
    if(!legacy)return;
    clearingLegacy=true;
    try{
      if(typeof legacy.onclick==='function')legacy.onclick.call(legacy);
      else legacy.closest('.pod-draft')?.remove();
    }catch(_){legacy.closest('.pod-draft')?.remove();}
    finally{clearingLegacy=false;}
  }

  function removeLegacyDraftDom(){
    const root=manager();if(!root)return;
    root.querySelectorAll('.pod-draft').forEach(el=>{
      if(el.id!=='neutralPodDraft'&&el.querySelector('#discardPodRotation'))el.remove();
    });
  }

  function status(text){
    const root=manager();if(!root)return;
    let el=document.getElementById('podDraftLifecycleStatus');
    if(!el){
      el=document.createElement('div');
      el.id='podDraftLifecycleStatus';
      el.className='pod-status';
      el.style.marginTop='10px';
      const actions=root.querySelector('.pod-manager-actions');
      if(actions&&actions.parentElement)actions.parentElement.insertAdjacentElement('afterend',el);
      else root.prepend(el);
    }
    el.textContent=text;
    clearTimeout(el._hideTimer);
    el._hideTimer=setTimeout(()=>{if(el.isConnected)el.remove();},3500);
  }

  function stampCurrentDraft(){
    const draft=document.getElementById('neutralPodDraft');if(!draft)return;
    const discard=draft.querySelector('#discardNeutralPodRotation');
    if(discard)discard.textContent='Delete draft';
    if(draft.dataset.lifecycleStamped==='1')return;
    draft.dataset.lifecycleStamped='1';
    const firstMuted=draft.querySelector('.muted');
    const meta=document.createElement('div');
    meta.className='muted';
    meta.style.marginTop='4px';
    meta.textContent='New draft created '+new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    if(firstMuted)firstMuted.insertAdjacentElement('afterend',meta);else draft.prepend(meta);
  }

  window.addEventListener('click',event=>{
    const target=event.target&&event.target.closest?event.target.closest('#buildPodRotation,#discardNeutralPodRotation'):null;
    if(!target)return;

    if(target.id==='buildPodRotation'){
      clearLegacyDraft();
      removeLegacyDraftDom();
      const originalAlert=window.alert;
      window.alert=function(message){
        if(String(message||'').startsWith(successPrefix))return;
        return originalAlert.call(window,message);
      };
      setTimeout(()=>{
        window.alert=originalAlert;
        clearLegacyDraft();
        removeLegacyDraftDom();
        stampCurrentDraft();
        if(document.getElementById('neutralPodDraft'))status('New rotation draft created. Nothing is published until you tap Publish.');
      },0);
      return;
    }

    if(target.id==='discardNeutralPodRotation'){
      setTimeout(()=>{
        clearLegacyDraft();
        removeLegacyDraftDom();
        document.getElementById('neutralPodDraft')?.remove();
        status('Draft deleted. No rotation changes were published.');
      },0);
    }
  },true);

  const observer=new MutationObserver(()=>{
    clearLegacyDraft();
    removeLegacyDraftDom();
    stampCurrentDraft();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>{clearLegacyDraft();removeLegacyDraftDom();stampCurrentDraft();},0);
})();
