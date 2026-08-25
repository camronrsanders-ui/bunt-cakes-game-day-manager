(()=>{
  const CONTROL_SELECTOR='input,select,textarea,[contenteditable="true"]';
  let recentControlUntil=0;

  function managerControl(target){
    return !!(target&&target.matches&&target.matches(CONTROL_SELECTOR)&&target.closest('#manager'));
  }

  function markInteraction(target,long=false){
    if(!managerControl(target))return;
    recentControlUntil=Date.now()+(long?30000:900);
  }

  function releaseInteraction(target){
    if(!managerControl(target))return;
    recentControlUntil=Date.now()+700;
  }

  window.__buntCaptainInteractionBusy=()=>{
    if(Date.now()<recentControlUntil)return true;
    const active=document.activeElement;
    if(!managerControl(active))return false;
    return active.tagName!=='SELECT';
  };

  document.addEventListener('pointerdown',event=>{
    if(managerControl(event.target))markInteraction(event.target,event.target.tagName==='SELECT');
  },true);
  document.addEventListener('touchstart',event=>{
    if(managerControl(event.target))markInteraction(event.target,event.target.tagName==='SELECT');
  },{capture:true,passive:true});
  document.addEventListener('focusin',event=>markInteraction(event.target,event.target&&event.target.tagName==='SELECT'),true);
  document.addEventListener('input',event=>markInteraction(event.target,false),true);
  document.addEventListener('change',event=>releaseInteraction(event.target),true);
  document.addEventListener('focusout',event=>releaseInteraction(event.target),true);

  function enforceTab(button){
    if(!button)return;
    const manager=document.getElementById('manager');
    const targetId=String(button.dataset.tab||'');
    const target=targetId&&document.getElementById(targetId);
    if(!manager||!target)return;

    manager.querySelectorAll('.tabs button[data-tab]').forEach(tab=>{
      tab.classList.toggle('on',tab===button);
    });

    Array.from(manager.children).forEach(child=>{
      if(child.tagName==='SECTION')child.classList.toggle('hidden',child!==target);
    });

    if(targetId==='access'&&typeof renderAccess==='function')renderAccess();
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest&&event.target.closest('#manager .tabs button[data-tab]');
    if(!button)return;
    requestAnimationFrame(()=>enforceTab(button));
  });
})();
