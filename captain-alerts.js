(()=>{
  if(window.__feildhausCaptainAlertsInstalled)return;
  window.__feildhausCaptainAlertsInstalled=true;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function mount(){
    if(typeof state==='undefined'||!state)return false;
    const dashboard=document.getElementById('dashboard');if(!dashboard)return false;
    let card=document.getElementById('feildhausCaptainAlerts');
    if(!card){
      card=document.createElement('div');card.id='feildhausCaptainAlerts';card.className='card';
      card.style.border='2px solid #fed7aa';card.style.background='#fffaf5';
      dashboard.prepend(card);
    }
    const latest=(Array.isArray(state.captainAlerts)?state.captainAlerts:[]).slice(-1)[0];
    card.innerHTML='<div class="row wrap"><div><strong>Captain Alert</strong><div class="muted">Send one important game-day notice to paired players. This is not a chat.</div></div><span class="pill">One-way</span></div><textarea id="captainAlertMessage" maxlength="240" placeholder="Example: Field changed to Field 3. Please arrive by 12:15 PM." style="margin-top:10px;min-height:86px"></textarea><div class="row wrap" style="margin-top:8px"><div id="captainAlertStatus" class="muted">'+(latest?'Last alert: '+esc(latest.message):'No alerts sent yet.')+'</div><button id="sendCaptainAlert" class="primary" type="button">Send Alert</button></div>';
    const btn=document.getElementById('sendCaptainAlert'),box=document.getElementById('captainAlertMessage'),status=document.getElementById('captainAlertStatus');
    btn.onclick=async()=>{
      const message=String(box.value||'').trim();if(!message){status.textContent='Write an alert first.';box.focus();return;}
      if(!confirm('Send this Captain Alert to paired players?'))return;
      btn.disabled=true;btn.textContent='Sending…';status.textContent='';
      const requestId=crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random();
      try{
        const r=await fetch('/api/team-state',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'captain-alert',message,requestId})});
        const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not send alert');
        state.captainAlerts=Array.isArray(state.captainAlerts)?state.captainAlerts:[];
        state.captainAlerts.push(j.alert);
        box.value='';status.textContent='Sent to '+Number(j.sent||0)+' device'+(Number(j.sent||0)===1?'':'s')+(j.failed?' • '+j.failed+' failed':'')+'.';
        btn.textContent='Sent ✓';setTimeout(()=>{btn.textContent='Send Alert';btn.disabled=false},1200);
      }catch(e){status.textContent=e.message||'Could not send alert';btn.disabled=false;btn.textContent='Send Alert';}
    };
    return true;
  }
  const timer=setInterval(()=>{if(mount())clearInterval(timer)},200);
  setTimeout(()=>clearInterval(timer),20000);
  window.addEventListener('teamlivestatechange',mount);
})();