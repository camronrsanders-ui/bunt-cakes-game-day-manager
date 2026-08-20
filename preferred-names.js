(function(){
  const SELECT_IDS=['myRotationPlayer','installPlayer'];

  function roster(){
    return Array.isArray(window.state?.players)?window.state.players:[];
  }

  function preferredName(value){
    const players=roster();
    const player=players.find(p=>p?.name===value||p?.fullName===value);
    return player?.name||value||'';
  }

  function normalizeSelect(select){
    if(!select)return;
    const current=select.value;
    const options=[...select.options];
    options.forEach(option=>{
      if(!option.value)return;
      option.textContent=preferredName(option.value);
    });
    const placeholder=options.find(option=>!option.value);
    const named=options.filter(option=>option.value).sort((a,b)=>a.textContent.localeCompare(b.textContent,undefined,{sensitivity:'base'}));
    select.innerHTML='';
    if(placeholder)select.appendChild(placeholder);
    named.forEach(option=>select.appendChild(option));
    select.value=current;
  }

  function normalizeSurveyCards(){
    document.querySelectorAll('#players > .card').forEach(card=>{
      const input=card.querySelector('input.n');
      const label=card.querySelector('.survey-status .muted');
      if(input&&label)label.textContent=preferredName(input.value);
    });
  }

  function normalizeKnownDisplays(){
    SELECT_IDS.forEach(id=>normalizeSelect(document.getElementById(id)));
    normalizeSurveyCards();
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      normalizeKnownDisplays();
    });
  }

  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',schedule);
  window.addEventListener('buntpreferrednamesrefresh',schedule);
  setInterval(schedule,2000);
  schedule();
})();
