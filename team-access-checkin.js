(()=>{
  const keyName=()=>window.__teamStorageKey?window.__teamStorageKey('playerName'):'buntCakesPlayerName';
  let lastSent='';
  function status(){return (matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)?'installed':'browser';}
  function authenticatedName(){
    const access=typeof state!=='undefined'&&state&&state.playerAccess;
    return access&&access.paired===true?String(access.playerName||'').trim():'';
  }
  async function checkIn(force=false){
    const name=authenticatedName();if(!name)return;
    const sig=name+'|'+status();if(!force&&sig===lastSent)return;lastSent=sig;
    try{const r=await fetch('/api/team-state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerName:name,accessStatus:status()})});if(!r.ok)lastSent='';}catch(_){lastSent='';}
  }
  document.addEventListener('change',event=>{
    const select=event.target;if(!select||!['myRotationPlayer','installPlayer'].includes(select.id))return;
    const name=select.value||'';if(name)localStorage.setItem(keyName(),name);checkIn(true);
  });
  window.addEventListener('teamplayeraccesschange',()=>checkIn(true));
  window.addEventListener('pageshow',()=>checkIn(true));
  window.addEventListener('focus',()=>checkIn());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkIn();});
  setTimeout(()=>checkIn(true),500);
})();
