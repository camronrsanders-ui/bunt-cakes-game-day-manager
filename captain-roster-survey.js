(function(){
  const STYLE_ID='bunt-roster-survey-styles';
  const model=()=>window.BuntFieldProfile||{};
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .survey-status{grid-column:1/-1;border-radius:12px;padding:10px 12px;display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .survey-status.complete{background:#f0fdf4;border:1px solid #86efac;color:#166534}.survey-status.missing{background:#fff1f2;border:1px solid #fecdd3;color:#9f1239}
      .survey-status strong{display:block}.survey-status .muted{color:inherit;opacity:.78}.survey-editor{grid-column:1/-1;border-top:1px solid var(--l);padding-top:8px}
      .survey-editor summary{cursor:pointer;font-weight:800;min-height:44px;display:flex;align-items:center}.survey-position-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}
      .survey-position{display:flex;align-items:center;gap:7px;border:1px solid var(--l);border-radius:10px;padding:8px;background:#fff}.survey-position input{width:auto;margin:0}.survey-position:has(input:checked){background:#dcfce7;border-color:#4ade80}
      .survey-mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.survey-mode{display:flex;align-items:flex-start;gap:8px;border:1px solid var(--l);border-radius:12px;padding:10px;background:#f8fafc}.survey-mode input{width:auto;margin:3px 0 0}.survey-mode:has(input:checked){background:#eff6ff;border-color:#93c5fd}.survey-mode strong{display:block}.survey-mode span{display:block;font-size:.82rem;color:var(--m);margin-top:2px}.survey-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.survey-actions button{flex:1 1 160px}.survey-note{margin-top:8px;font-size:.86rem;color:var(--m)}
      @media(max-width:620px){.survey-position-grid,.survey-mode-grid{grid-template-columns:1fr}.survey-status{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function prefs(player){return model().prefs?model().prefs(player):(Array.isArray(player?.preferences)?player.preferences:[]);}
  function isFlexible(player){return model().flexible?model().flexible(player):(player?.flexible===true||player?.flexibleAnywhere===true||player?.preferenceMode==='flexible');}
  function isWilling(player){return model().willing?model().willing(player):(player?.willingElsewhere===true||player?.flexibleElsewhere===true);}
  function submitted(player){return model().submitted?model().submitted(player):player?.surveySubmitted===true;}
  function ready(player){return model().ready?model().ready(player):(submitted(player)||prefs(player).length>0||isFlexible(player)||isWilling(player));}
  function source(player){return model().source?model().source(player):(submitted(player)?'survey':(ready(player)?'captain':'none'));}
  function sync(player,reason){
    if(model().sync)return model().sync(player,reason);
    const hasGuidance=prefs(player).length>0||isFlexible(player)||isWilling(player);
    player.surveyComplete=submitted(player);
    player.fieldProfileReady=submitted(player)||hasGuidance;
    if(reason==='survey')player.fieldPreferenceSource='survey';
    else if(reason==='captain'&&!submitted(player)&&hasGuidance)player.fieldPreferenceSource='captain';
    else if(!player.fieldProfileReady)delete player.fieldPreferenceSource;
    return player;
  }
  function preferenceText(player){
    const parts=[];
    if(prefs(player).length)parts.push(prefs(player).join(' → '));
    if(isFlexible(player))parts.push('Flexible / anywhere');
    if(isWilling(player))parts.push('Willing to play elsewhere');
    if(!parts.length)return submitted(player)?'No position preference stated':'No field preference on file';
    const prefix=source(player)==='captain'?'Captain-entered: ':'';
    return prefix+parts.join(' • ');
  }
  function decorate(){
    if(typeof state==='undefined'||!state)return;
    const box=document.getElementById('players');
    if(!box)return;
    [...box.children].forEach(card=>{
      if(card.dataset.surveyEnhanced==='1')return;
      const nameInput=card.querySelector('input.n');
      if(!nameInput)return;
      const player=(state.players||[]).find(p=>p.name===nameInput.value);
      if(!player)return;
      card.dataset.surveyEnhanced='1';
      const list=prefs(player);
      const status=document.createElement('div');
      function refreshStatus(){
        const hasSurvey=submitted(player),fieldReady=ready(player);
        status.className='survey-status '+(hasSurvey?'complete':'missing');
        status.innerHTML='<div><strong>'+(hasSurvey?'✅ Survey submitted':'❌ Survey not submitted')+'</strong><div class="muted">'+esc(player.name)+'</div></div><div><strong>'+(fieldReady?'✅ Field guidance ready':'⚠️ Field guidance missing')+'</strong><div class="muted">'+esc(preferenceText(player))+'</div></div>';
      }
      refreshStatus();
      card.prepend(status);
      const details=document.createElement('details');
      details.className='survey-editor';
      details.innerHTML='<summary>Edit survey & fielding preferences</summary><div class="survey-position-grid">'+POS.map(pos=>'<label class="survey-position"><input type="checkbox" value="'+esc(pos)+'" '+(list.includes(pos)?'checked':'')+'>'+esc(pos)+'</label>').join('')+'</div><div class="survey-mode-grid"><label class="survey-mode"><input class="flexibleAnywhere" type="checkbox" '+(isFlexible(player)?'checked':'')+'><div><strong>Flexible / anywhere</strong><span>Player is comfortable being placed at any field position.</span></div></label><label class="survey-mode"><input class="willingElsewhere" type="checkbox" '+(isWilling(player)?'checked':'')+'><div><strong>Willing to play elsewhere</strong><span>Keep listed positions as preferences, but allow another position if the team needs it.</span></div></label></div><div class="survey-note">Survey submission and fielding guidance are separate. Captain-entered preferences do not count as a survey response. Preferences guide the builder, but the captain can always override a field assignment.</div><div class="survey-actions"><button type="button" class="surveyCompleteBtn primary">Mark survey submitted</button><button type="button" class="surveyMissingBtn">Mark survey not submitted</button></div>';
      function persist(){queueSave();refreshStatus();}
      details.querySelectorAll('.survey-position input').forEach(cb=>cb.onchange=()=>{
        const checked=new Set([...details.querySelectorAll('.survey-position input:checked')].map(x=>x.value));
        const next=prefs(player).filter(pos=>checked.has(pos));
        POS.forEach(pos=>{if(checked.has(pos)&&!next.includes(pos))next.push(pos);});
        player.preferences=next;
        sync(player,submitted(player)?'survey':'captain');
        persist();
      });
      details.querySelector('.flexibleAnywhere').onchange=e=>{player.flexible=e.target.checked;player.flexibleAnywhere=e.target.checked;sync(player,submitted(player)?'survey':'captain');persist();};
      details.querySelector('.willingElsewhere').onchange=e=>{player.willingElsewhere=e.target.checked;player.flexibleElsewhere=e.target.checked;sync(player,submitted(player)?'survey':'captain');persist();};
      details.querySelector('.surveyCompleteBtn').onclick=()=>{player.surveySubmitted=true;sync(player,'survey');persist();};
      details.querySelector('.surveyMissingBtn').onclick=()=>{player.surveySubmitted=false;sync(player,'captain');persist();};
      card.appendChild(details);
    });
  }
  const wait=setInterval(()=>{
    if(typeof state!=='undefined'&&state&&document.getElementById('players')){
      clearInterval(wait);
      decorate();
      new MutationObserver(()=>requestAnimationFrame(decorate)).observe(document.getElementById('players'),{childList:true});
    }
  },250);
})();
