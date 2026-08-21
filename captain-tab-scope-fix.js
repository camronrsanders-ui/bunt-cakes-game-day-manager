(()=>{
  document.addEventListener('click',event=>{
    const button=event.target.closest&&event.target.closest('#manager .tabs button[data-tab]');
    if(!button)return;
    const teamSettings=document.getElementById('team-settings');
    if(teamSettings&&button.dataset.tab!=='team-settings')teamSettings.classList.add('hidden');
  });
})();
