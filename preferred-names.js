(function(){
  const SELECT_IDS=['myRotationPlayer','installPlayer'];

  function roster(){
    const shared=typeof state!=='undefined'?state:window.state;
    return Array.isArray(shared?.players)?shared.players:[];
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
      const preferred=preferredName(option.value);
      if(option.textContent!==preferred)option.textContent=preferred;
    });

    const placeholder=options.find(option=>!option.value);
    const named=options.filter(option=>option.value);
    const sorted=[...named].sort((a,b)=>a.textContent.localeCompare(b.textContent,undefined,{sensitivity:'base'}));
    const currentOrder=named.map(option=>option.value).join('\u0000');
    const sortedOrder=sorted.map(option=>option.value).join('\u0000');
    if(currentOrder!==sortedOrder){
      select.innerHTML='';
      if(placeholder)select.appendChild(placeholder);
      sorted.forEach(option=>select.appendChild(option));
      select.value=current;
    }
  }

  function normalizeSurveyCards(){
    document.querySelectorAll('#players > .card').forEach(card=>{
      const input=card.querySelector('input.n');
      const label=card.querySelector('.survey-status .muted');
      if(!input||!label)return;
      const preferred=preferredName(input.value);
      if(label.textContent!==preferred)label.textContent=preferred;
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
