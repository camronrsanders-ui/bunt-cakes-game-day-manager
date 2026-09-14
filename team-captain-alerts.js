(()=>{
  if(window.__feildhausPlayerAlertsInstalled)return;
  window.__feildhausPlayerAlertsInstalled=true;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function key(id){return (window.__teamStorageKey?window.__teamStorageKey('dismissedCaptainAlert'):'teamgameday:dismissedCaptainAlert')+':'+id}
  function mount(){
    if(typeof state==='undefined'||!state)return;
    const home=document.getElementById('home');if(!home)return;
    let card=document.getElementById('playerCaptainAlert');
    const alerts=Array.isArray(state.captainAlerts)?state.captainAlerts:[];
    const latest=alerts.slice().reverse().find(a=>a&&a.id&&!localStorage.getItem(key(a.id)));
    if(!latest){if(card)card.remove();return;}
    if(!card){card=document.createElement('div');card.id='playerCaptainAlert';card.className='card';card.style.cssText='border:2px solid #f59e0b;background:#fffbeb;color:#78350f';home.prepend(card);}
    const when=latest.createdAt?new Date(latest.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
    card.innerHTML='<div class="row wrap"><div><div style="font-size:.72rem;font-weight:900;letter-spacing:.08em;color:#b45309">CAPTAIN ALERT</div><strong>'+esc(latest.message)+'</strong><div class="muted" style="margin-top:4px">'+esc(latest.createdBy||'Captain')+(when?' • '+esc(when):'')+'</div></div><button id="dismissCaptainAlert" type="button">Got it</button></div>';
    document.getElementById('dismissCaptainAlert').onclick=()=>{localStorage.setItem(key(latest.id),'1');card.remove();};
  }
  window.addEventListener('teamlivestatechange',mount);
  window.addEventListener('buntpreferrednamesrefresh',mount);
  setInterval(mount,3000);
  setTimeout(mount,200);
})();