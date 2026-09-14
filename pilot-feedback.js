(()=>{
  if(window.__feildhausPilotFeedbackInstalled)return;
  window.__feildhausPilotFeedbackInstalled=true;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const $=id=>document.getElementById(id);
  const style=document.createElement('style');
  style.textContent=`
    #fhPilotFeedbackButton{position:fixed;right:14px;bottom:88px;z-index:9990;border:1px solid #2b4e57;background:#071926;color:#fff;border-radius:999px;padding:10px 13px;font-weight:850;box-shadow:0 8px 24px rgba(0,0,0,.18)}
    #fhPilotFeedbackOverlay{position:fixed;inset:0;z-index:10050;background:rgba(2,14,22,.72);display:grid;place-items:center;padding:16px}
    #fhPilotFeedbackCard{width:min(520px,100%);background:#fff;color:#0f172a;border-radius:22px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.32)}
    #fhPilotFeedbackCard h2{margin:.1rem 0 .3rem}.fh-feedback-cats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:12px 0}.fh-feedback-cats button{min-height:42px;font-weight:850}
    .fh-feedback-cats button.on{background:#071926;color:#fff;border-color:#071926}
    #fhPilotFeedbackMessage{width:100%;min-height:120px;resize:vertical}.fh-feedback-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.fh-feedback-status{margin-top:8px;font-size:.86rem}
    @media(max-width:520px){#fhPilotFeedbackButton{right:10px;bottom:82px;padding:9px 11px}.fh-feedback-cats{grid-template-columns:1fr 1fr}#fhPilotFeedbackOverlay{padding:0;align-items:end}#fhPilotFeedbackCard{border-radius:22px 22px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom))}}
  `;
  document.head.appendChild(style);

  const button=document.createElement('button');
  button.id='fhPilotFeedbackButton';button.type='button';button.textContent='Pilot Feedback';
  document.body.appendChild(button);

  function screenName(){
    const on=[...document.querySelectorAll('#manager .tabs button.on,.tabs button.on,.tabs button.active')].find(b=>b.offsetParent!==null);
    return on?.textContent?.trim()||document.title||location.pathname;
  }

  function open(){
    if($('fhPilotFeedbackOverlay'))return;
    const overlay=document.createElement('div');overlay.id='fhPilotFeedbackOverlay';
    overlay.innerHTML=`<div id="fhPilotFeedbackCard" role="dialog" aria-modal="true" aria-labelledby="fhPilotFeedbackTitle"><div class="muted">FOUNDING TEAMS PILOT</div><h2 id="fhPilotFeedbackTitle">Help improve FeildHaus</h2><div class="muted">Tell us what happened while it is fresh.</div><div class="fh-feedback-cats"><button type="button" data-cat="bug">🐛 Bug</button><button type="button" data-cat="confusing">🤔 Confusing</button><button type="button" data-cat="idea">💡 Idea</button><button type="button" data-cat="love">❤️ Love</button></div><label>What did you notice?<textarea id="fhPilotFeedbackMessage" maxlength="1200" placeholder="What happened, what did you expect, or what would make this better?"></textarea></label><div id="fhPilotFeedbackStatus" class="fh-feedback-status muted"></div><div class="fh-feedback-actions"><button id="fhPilotFeedbackCancel" type="button">Cancel</button><button id="fhPilotFeedbackSend" class="primary" type="button">Send Feedback</button></div></div>`;
    document.body.appendChild(overlay);
    let category='bug';
    const cats=[...overlay.querySelectorAll('[data-cat]')];
    const select=cat=>{category=cat;cats.forEach(b=>b.classList.toggle('on',b.dataset.cat===cat));};
    cats.forEach(b=>b.onclick=()=>select(b.dataset.cat));select(category);
    $('fhPilotFeedbackCancel').onclick=()=>overlay.remove();
    overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};
    $('fhPilotFeedbackSend').onclick=async()=>{
      const send=$('fhPilotFeedbackSend'),status=$('fhPilotFeedbackStatus'),message=$('fhPilotFeedbackMessage').value.trim();
      if(!message){status.textContent='Add a short note before sending.';return;}
      send.disabled=true;send.textContent='Sending…';status.textContent='';
      try{
        const r=await fetch('/api/team-state',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'pilot-feedback',category,message,screen:screenName()})});
        const j=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(j.error||'Could not send feedback');
        status.textContent='Thanks — your feedback was sent to the FeildHaus pilot team.';
        send.textContent='Sent ✓';
        setTimeout(()=>overlay.remove(),900);
      }catch(e){status.textContent=e.message||'Could not send feedback';send.disabled=false;send.textContent='Send Feedback';}
    };
    setTimeout(()=>$('fhPilotFeedbackMessage')?.focus(),50);
  }
  button.onclick=open;
})();