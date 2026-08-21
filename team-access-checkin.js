(()=>{
  const keyName=()=>window.__teamStorageKey?window.__teamStorageKey('playerName'):'buntCakesPlayerName';
  let lastSent='';
  function status(){return (matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)?'installed':'browser';}
  async function checkIn(name,force=false){
    name=String(name||'').trim();if(!name)return;
    const sig=name+'|'+status();if(!force&&sig===lastSent)return;lastSent=sig;
    try{const r=await fetch('/api/team-state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerName:name,accessStatus:status()})});if(!r.ok)lastSent='';}catch(_){lastSent='';}
  }
  function currentName(){return new URLSearchParams(location.search).get('player')||localStorage.getItem(keyName())||'';}
  document.addEventListener('change',event=>{
    const select=event.target;if(!select||!['myRotationPlayer','installPlayer'].includes(select.id))return;
    const name=select.value||'';if(name)localStorage.setItem(keyName(),name);checkIn(name,true);
  });
  window.addEventListener('pageshow',()=>checkIn(currentName(),true));
  window.addEventListener('focus',()=>checkIn(currentName()));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkIn(currentName());});
  setTimeout(()=>checkIn(currentName(),true),500);
})();
