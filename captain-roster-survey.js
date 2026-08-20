(function(){
  const STYLE_ID='bunt-roster-survey-styles';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .survey-status{grid-column:1/-1;border-radius:12px;padding:10px 12px;display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .survey-status.complete{background:#f0fdf4;border:1px solid #86efac;color:#166534}
      .survey-status.missing{background:#fff1f2;border:1px solid #fecdd3;color:#9f1239}
      .survey-status strong{display:block}.survey-status .muted{color:inherit;opacity:.78}
      .survey-editor{grid-column:1/-1;border-top:1px solid var(--l);padding-top:8px}
      .survey-editor summary{cursor:pointer;font-weight:800;min-height:44px;display:flex;align-items:center}
      .survey-position-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}
      .survey-position{display:flex;align-items:center;gap:7px;border:1px solid var(--l);border-radius:10px;padding:8px;background:#fff}
      .survey-position input{width:auto;margin:0}.survey-position:has(input:checked){background:#dcfce7;border-color:#4ade80}
      .survey-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.survey-actions button{flex:1 1 160px}
      @media(max-width:620px){.survey-position-grid{grid-template-columns:1fr}.survey-status{flex-direction:column}}
    `;document.head.appendChild(style);
  }

  function decorate(){
    if(typeof state==='undefined'||!state)return;
    const box=document.getElementById('players');if(!box)return;
    [...box.children].forEach(card=>{
      if(card.dataset.surveyEnhanced==='1')return;
      const nameInput=card.querySelector('input.n');if(!nameInput)return;
      const player=(state.players||[]).find(p=>p.name===nameInput.value);if(!player)return;
      card.dataset.surveyEnhanced='1';
      const status=document.createElement('div');
      status.className='survey-status '+(player.surveyComplete?'complete':'missing');
      const prefs=Array.isArray(player.preferences)?player.preferences:[];
      status.innerHTML='<div><strong>'+(player.surveyComplete?'✅ Survey complete':'❌ Position survey missing')+'</strong><div class="muted">'+(player.fullName||player.name)+'</div></div><div><strong>'+(prefs.length?prefs.join(', '):'No field preferences on file')+'</strong></div>';
      card.prepend(status);

      const details=document.createElement('details');details.className='survey-editor';
      details.innerHTML='<summary>Edit position preferences</summary><div class="survey-position-grid">'+POS.map(pos=>'<label class="survey-position"><input type="checkbox" value="'+pos+'" '+(prefs.includes(pos)?'checked':'')+'>'+pos+'</label>').join('')+'</div><div class="survey-actions"><button type="button" class="surveyCompleteBtn primary">Mark survey complete</button><button type="button" class="surveyMissingBtn">Mark as missing</button></div>';
      details.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.onchange=()=>{
        player.preferences=[...details.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);
        queueSave();
        card.dataset.surveyEnhanced='';
        renderRoster();
      });
      details.querySelector('.surveyCompleteBtn').onclick=()=>{player.surveyComplete=true;queueSave();renderRoster()};
      details.querySelector('.surveyMissingBtn').onclick=()=>{player.surveyComplete=false;queueSave();renderRoster()};
      card.appendChild(details);
    });
  }

  const wait=setInterval(()=>{if(typeof state!=='undefined'&&state&&document.getElementById('players')){clearInterval(wait);decorate();new MutationObserver(()=>requestAnimationFrame(decorate)).observe(document.getElementById('players'),{childList:true});}},250);
})();