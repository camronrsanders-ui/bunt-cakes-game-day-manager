(function(){
  const COORDS={
    'Catcher':[50,91],'Pitcher':[50,70],'First Base':[77,62],'Second Base':[62,50],
    'Third Base':[23,62],'Shortstop':[38,50],'Left Field':[14,29],'Left Center Field':[32,20],
    'Center Field':[50,14],'Right Center Field':[68,20],'Right Field':[86,29]
  };
  const POSITION_ABBR={'Catcher':'C','Pitcher':'P','First Base':'1B','Second Base':'2B','Third Base':'3B','Shortstop':'SS','Left Field':'LF','Left Center Field':'LCF','Center Field':'CF','Right Center Field':'RCF','Right Field':'RF'};
  let selectedPosition='Pitcher';
  let editInning=1;
  let mounted=false;

  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function clampInning(value){return Math.max(1,Math.min(7,Number(value)||1));}
  function players(){return Array.isArray(state?.players)?state.players:[];}
  function presentPlayers(){return players().filter(p=>p.present!==false);}
  function prefs(p){return Array.isArray(p?.preferences)?p.preferences:[];}
  function isFlexible(p){return p?.flexible===true||p?.preferenceMode==='flexible'||p?.flexibleAnywhere===true;}
  function isComplete(p){return p?.surveyComplete===true&&(isFlexible(p)||prefs(p).length>0);}
  function isWillingElsewhere(p){return p?.willingElsewhere===true||p?.flexibleElsewhere===true;}
  function playerByName(name){return players().find(p=>p.name===name);}
  function inningData(n){state.innings=state.innings||{};return state.innings[n]||(state.innings[n]={});}
  function liveInning(){return clampInning(state?.gameInning||state?.fieldInning||1);}
  function currentInning(){return clampInning(editInning);}

  function statusFor(p,pos){
    if(!p||!isComplete(p))return{key:'missing',label:'Survey missing'};
    const list=prefs(p),idx=list.indexOf(pos);
    if(idx>=0)return{key:'preferred',label:idx===0?'Top preference':`Preference #${idx+1}`};
    if(isFlexible(p))return{key:'flexible',label:'Flexible / anywhere'};
    if(isWillingElsewhere(p))return{key:'alternate',label:'Willing elsewhere'};
    return{key:'outside',label:'Outside preferences'};
  }
  function fitScore(p,pos){
    if(!p||!isComplete(p))return-10000;
    const list=prefs(p),idx=list.indexOf(pos);
    if(idx>=0)return1000-(idx*45);
    if(isFlexible(p))return500;
    if(isWillingElsewhere(p))return150;
    return-5000;
  }
  function profileLabel(p){
    if(!p||!isComplete(p))return'Survey missing';
    if(isFlexible(p)&&!prefs(p).length)return'Flexible / anywhere';
    const base=prefs(p).join(' → ');
    return base+(isWillingElsewhere(p)?' • willing elsewhere':'');
  }

  function ensureStyles(){
    if(document.getElementById('fieldRotationStyles'))return;
    const style=document.createElement('style');style.id='fieldRotationStyles';style.textContent=`
      #pods{gap:12px}.rotation-hero{border:2px solid #86efac;background:#f7fff8}.rotation-title{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.rotation-title h2{margin:.15rem 0}.rotation-progress{font-weight:900;font-size:1.1rem;color:#166534}.rotation-warning{margin-top:10px;padding:10px 12px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}.rotation-good{background:#f0fdf4;border-color:#86efac;color:#166534}.inning-toolbar{display:grid;gap:9px}.inning-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.inning-live{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.inning-strip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.inning-strip button{padding:8px 4px;min-height:40px;font-weight:800}.inning-strip button.on{background:#15803d;color:#fff;border-color:#15803d}.inning-strip button.live:not(.on){box-shadow:inset 0 0 0 2px #86efac}.make-live{width:auto!important}.rotation-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(270px,.8fr);gap:12px;align-items:start}.rotation-field{position:relative;width:100%;aspect-ratio:1/1;min-height:420px;border:1px solid var(--l);border-radius:24px;overflow:hidden;background:linear-gradient(#dff4df 0 44%,#95cb75 44% 100%)}.rotation-field:before{content:'';position:absolute;left:50%;top:64%;width:43%;height:43%;transform:translate(-50%,-50%) rotate(45deg);background:#e8c997;border:3px solid #fff9;border-radius:4px}.rotation-field:after{content:'';position:absolute;left:50%;top:65%;width:14%;height:14%;transform:translate(-50%,-50%) rotate(45deg);border:2px solid #fff9}.rotation-slot{position:absolute;transform:translate(-50%,-50%);z-index:2;width:25%;min-width:88px;max-width:145px;border:2px solid #15803d;background:#fff;border-radius:13px;padding:6px;box-shadow:0 3px 10px #0002;text-align:center;cursor:pointer}.rotation-slot.selected{outline:4px solid #16653433}.rotation-slot.missing{border-color:#d97706}.rotation-slot.outside{border-color:#b91c1c}.rotation-slot.flexible{border-color:#2563eb}.rotation-slot .abbr{display:block;font-size:.67rem;color:#6b7280;font-weight:900}.rotation-slot .person{display:block;font-size:.82rem;font-weight:900;line-height:1.15;overflow-wrap:anywhere}.rotation-slot .fit{display:block;font-size:.62rem;line-height:1.1;margin-top:2px;color:#6b7280}.rotation-side{display:grid;gap:10px}.rotation-editor select{margin-top:8px}.fit-chip{display:inline-block;border-radius:999px;padding:4px 8px;font-size:.75rem;font-weight:900;margin-top:7px}.fit-chip.preferred{background:#dcfce7;color:#166534}.fit-chip.flexible{background:#dbeafe;color:#1d4ed8}.fit-chip.alternate{background:#fef3c7;color:#92400e}.fit-chip.missing,.fit-chip.outside{background:#fee2e2;color:#991b1b}.rotation-list{display:grid;gap:6px}.rotation-person{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-top:1px solid #eef2f7}.rotation-person:first-child{border-top:0}.rotation-change{padding:7px 0;border-top:1px solid #eef2f7}.rotation-change:first-child{border-top:0}.rotation-actions{display:grid;gap:8px}.rotation-actions button{width:100%}.rotation-note{font-size:.86rem;color:#6b7280}.survey-missing-list{font-weight:800}.rotation-profile-list details{border-top:1px solid #eef2f7;padding:7px 0}.rotation-profile-list details:first-child{border-top:0}.rotation-profile-list summary{cursor:pointer;font-weight:800}.rotation-profile-list .muted{margin-top:4px}.rotation-unassigned{border-style:dashed;border-color:#9ca3af;background:#ffffffdf}.rotation-unassigned .person{color:#6b7280}
      @media(max-width:760px){.rotation-grid{grid-template-columns:1fr}.rotation-field{min-height:360px}.rotation-slot{width:29%;min-width:76px;padding:5px 4px}.rotation-slot .person{font-size:.72rem}.rotation-slot .fit{display:none}}
      @media(max-width:480px){.inning-strip{grid-template-columns:repeat(4,minmax(0,1fr))}.rotation-field{min-height:330px}.rotation-slot{width:31%;min-width:70px}.rotation-slot .abbr{font-size:.6rem}.rotation-slot .person{font-size:.68rem}}
    `;document.head.appendChild(style);
  }

  function mount(){
    const section=document.getElementById('pods');if(!section||typeof state==='undefined'||!state)return false;
    ensureStyles();editInning=liveInning();
    const tab=document.querySelector('[data-tab="pods"]');if(tab)tab.textContent='Field Rotation';
    section.innerHTML=`
      <div class="card rotation-hero"><div class="rotation-title"><div><div class="muted">CAPTAIN TOOL</div><h2>Field Rotation</h2><div class="muted">Plan future innings without changing the live inning players currently see.</div></div><div id="rotationProfileProgress" class="rotation-progress"></div></div><div id="rotationSurveyWarning" class="rotation-warning"></div></div>
      <div class="card inning-toolbar"><div class="inning-head"><div><strong id="rotationEditLabel">Editing inning 1</strong><div class="muted">Tap an inning to plan it. This does not make it live.</div></div><div id="rotationLiveControls" class="inning-live"></div></div><div id="rotationInnings" class="inning-strip"></div></div>
      <div class="rotation-grid"><div id="rotationField" class="rotation-field" aria-label="Field rotation layout"></div><div class="rotation-side"><div id="rotationEditor" class="card rotation-editor"></div><div id="rotationRest" class="card"></div><div id="rotationNext" class="card"></div></div></div>
      <div class="card rotation-actions"><button id="buildPreferenceRotation" class="primary">Build Rotation From Preferences</button><div class="rotation-note">This builds a seven-inning draft only after every present player has a completed fielding profile. You will be asked before existing inning assignments are replaced.</div></div>
      <div id="rotationProfiles" class="card rotation-profile-list"></div>`;
    document.getElementById('buildPreferenceRotation').onclick=buildPreferenceRotation;mounted=true;renderFieldRotation();return true;
  }

  function makeEditedInningLive(){
    const n=currentInning();if(n===liveInning())return;if(!confirm(`Make inning ${n} live for all players now?`))return;
    state.gameInning=n;state.fieldInning=n;
    const dashboardInning=document.getElementById('inning'),lineupInning=document.getElementById('lineupInning');if(dashboardInning)dashboardInning.value=String(n);if(lineupInning)lineupInning.value=String(n);
    if(typeof renderDash==='function')renderDash();if(typeof renderLineup==='function')renderLineup();queueSave();renderFieldRotation();
  }

  function renderInningStrip(){
    const box=document.getElementById('rotationInnings'),label=document.getElementById('rotationEditLabel'),controls=document.getElementById('rotationLiveControls');if(!box)return;
    const n=currentInning(),live=liveInning();if(label)label.textContent=`Editing inning ${n}`;
    box.innerHTML=Array.from({length:7},(_,i)=>{const inning=i+1;return `<button type="button" data-inning="${inning}" class="${n===inning?'on ':''}${live===inning?'live':''}">${inning}</button>`;}).join('');
    box.querySelectorAll('button').forEach(b=>b.onclick=()=>{editInning=Number(b.dataset.inning);renderFieldRotation();});
    if(controls){controls.innerHTML=`<span class="pill">Live: Inning ${live}</span>${n!==live?`<button id="makeEditedLive" type="button" class="primary make-live">Make Inning ${n} Live</button>`:''}`;const btn=document.getElementById('makeEditedLive');if(btn)btn.onclick=makeEditedInningLive;}
  }

  function renderField(){
    const field=document.getElementById('rotationField');if(!field)return;const inn=inningData(currentInning());field.innerHTML='';
    Object.entries(COORDS).forEach(([pos,[left,top]])=>{const name=inn[pos]||'',p=playerByName(name),fit=name?statusFor(p,pos):{key:'unassigned',label:'Unassigned'};const node=document.createElement('button');node.type='button';node.className=`rotation-slot ${fit.key}${selectedPosition===pos?' selected':''}${name?'':' rotation-unassigned'}`;node.style.left=left+'%';node.style.top=top+'%';node.innerHTML=`<span class="abbr">${POSITION_ABBR[pos]} • ${esc(pos)}</span><span class="person">${esc(name||'Unassigned')}</span><span class="fit">${esc(fit.label)}</span>`;node.onclick=()=>{selectedPosition=pos;renderFieldRotation();};field.appendChild(node);});
  }

  function renderEditor(){
    const box=document.getElementById('rotationEditor');if(!box)return;const inn=inningData(currentInning()),current=inn[selectedPosition]||'',used=new Set(Object.values(inn).filter(Boolean));
    const sorted=presentPlayers().slice().sort((a,b)=>fitScore(b,selectedPosition)-fitScore(a,selectedPosition)||a.name.localeCompare(b.name));
    const options=['<option value="">Unassigned</option>',...sorted.filter(p=>!used.has(p.name)||p.name===current).map(p=>{const st=statusFor(p,selectedPosition);return `<option value="${esc(p.name)}" ${p.name===current?'selected':''}>${esc(p.name)} — ${esc(st.label)}</option>`;})].join('');const p=playerByName(current),st=current?statusFor(p,selectedPosition):null;
    box.innerHTML=`<div class="muted">EDIT POSITION • INNING ${currentInning()}</div><h3 style="margin:.25rem 0">${esc(selectedPosition)}</h3><label>Player<select id="rotationPlayerSelect">${options}</select></label>${st?`<span class="fit-chip ${st.key}">${esc(st.label)}</span><div class="rotation-note" style="margin-top:7px">${esc(profileLabel(p))}</div>`:'<div class="rotation-note" style="margin-top:7px">Choose an available player. The list is sorted by survey fit.</div>'}`;
    document.getElementById('rotationPlayerSelect').onchange=e=>{inn[selectedPosition]=e.target.value;queueSave();renderFieldRotation();if(currentInning()===liveInning()&&typeof renderLineup==='function')renderLineup();};
  }

  function renderRest(){
    const box=document.getElementById('rotationRest');if(!box)return;const inn=inningData(currentInning()),used=new Set(Object.values(inn).filter(Boolean)),resting=presentPlayers().filter(p=>!used.has(p.name));
    box.innerHTML=`<div class="muted">RESTING • INNING ${currentInning()}</div><h3 style="margin:.25rem 0">${resting.length} player${resting.length===1?'':'s'}</h3><div class="rotation-list">${resting.length?resting.map(p=>`<div class="rotation-person"><strong>${esc(p.name)}</strong><span class="muted">${esc(isComplete(p)?(isFlexible(p)?'Flexible':(prefs(p)[0]||'Survey complete')):'Survey missing')}</span></div>`).join(''):'<div class="muted">Everyone is assigned.</div>'}</div>`;
  }

  function renderNext(){
    const box=document.getElementById('rotationNext');if(!box)return;const n=currentInning();if(n>=7){box.innerHTML='<div class="muted">NEXT INNING</div><strong>Final inning — no next-inning changes.</strong>';return;}
    const now=inningData(n),next=inningData(n+1),changes=[];presentPlayers().forEach(p=>{const a=Object.keys(now).find(pos=>now[pos]===p.name)||'Rest',b=Object.keys(next).find(pos=>next[pos]===p.name)||'Rest';if(a!==b)changes.push({name:p.name,a,b});});
    box.innerHTML=`<div class="muted">NEXT INNING • ${n+1}</div><h3 style="margin:.25rem 0">Changes</h3>${changes.length?changes.map(x=>`<div class="rotation-change"><strong>${esc(x.name)}</strong><div class="muted">${esc(x.a)} → ${esc(x.b)}</div></div>`).join(''):'<div class="muted">No changes scheduled yet.</div>'}`;
  }

  function renderSurveySummary(){
    const list=presentPlayers(),complete=list.filter(isComplete),missing=list.filter(p=>!isComplete(p)),progress=document.getElementById('rotationProfileProgress'),warning=document.getElementById('rotationSurveyWarning');
    if(progress)progress.textContent=`${complete.length} of ${list.length} profiles ready`;
    if(warning){warning.className='rotation-warning '+(missing.length?'':'rotation-good');warning.innerHTML=missing.length?`<strong>${missing.length} fielding profile${missing.length===1?' is':'s are'} still missing.</strong><div class="survey-missing-list">${missing.map(p=>esc(p.name)).join(', ')}</div>`:'<strong>All present players have fielding preferences on file.</strong>';}
    const profiles=document.getElementById('rotationProfiles');if(profiles)profiles.innerHTML=`<div class="row wrap"><div><strong>Fielding Preference Check</strong><div class="muted">Use this to confirm what the rotation builder will read.</div></div><span class="pill">${complete.length}/${list.length} ready</span></div><div style="margin-top:8px">${list.map(p=>`<details><summary>${esc(p.name)} ${isComplete(p)?'✓':'⚠'}</summary><div class="muted">${esc(profileLabel(p))}</div></details>`).join('')}</div>`;
  }

  function renderFieldRotation(){if(!mounted||!document.getElementById('rotationField'))return;if(!COORDS[selectedPosition])selectedPosition='Pitcher';renderSurveySummary();renderInningStrip();renderField();renderEditor();renderRest();renderNext();}

  function buildPreferenceRotation(){
    const available=presentPlayers(),missing=available.filter(p=>!isComplete(p));
    if(missing.length){alert('Rotation not built. Fielding preferences are still missing for: '+missing.map(p=>p.name).join(', '));return;}
    if(!available.length){alert('Rotation not built. No players are marked present.');return;}
    if(!confirm('Build a new preference-based seven-inning draft? This will replace the current field assignments for innings 1–7.'))return;

    const newInnings={},stats=new Map(available.map(p=>[p.name,{played:0,last:0,byPos:{}}]));let gaps=0;
    for(let inning=1;inning<=7;inning++){
      const matchPlayerToPosition=new Map();
      const positions=Object.keys(COORDS).slice().sort((a,b)=>available.filter(p=>fitScore(p,a)>-5000).length-available.filter(p=>fitScore(p,b)>-5000).length);
      const dynamicScore=(p,pos)=>{const s=stats.get(p.name);return fitScore(p,pos)-(s.played*160)-((s.byPos[pos]||0)*45)+(s.last===inning-1?-25:70);};
      const tryAssign=(pos,seenPlayers,seenPositions)=>{
        if(seenPositions.has(pos))return false;seenPositions.add(pos);
        const candidates=available.filter(p=>fitScore(p,pos)>-5000).slice().sort((a,b)=>dynamicScore(b,pos)-dynamicScore(a,pos)||a.name.localeCompare(b.name));
        for(const p of candidates){
          if(seenPlayers.has(p.name))continue;seenPlayers.add(p.name);
          const oldPos=matchPlayerToPosition.get(p.name);
          if(!oldPos||tryAssign(oldPos,seenPlayers,seenPositions)){matchPlayerToPosition.set(p.name,pos);return true;}
        }
        return false;
      };
      positions.forEach(pos=>{if(!tryAssign(pos,new Set(),new Set()))gaps++;});
      const out={};Object.keys(COORDS).forEach(pos=>out[pos]='');matchPlayerToPosition.forEach((pos,name)=>{out[pos]=name;});
      Object.entries(out).forEach(([pos,name])=>{if(!name)return;const s=stats.get(name);s.played++;s.last=inning;s.byPos[pos]=(s.byPos[pos]||0)+1;});newInnings[inning]=out;
    }

    state.innings=newInnings;queueSave();renderFieldRotation();if(currentInning()===liveInning()&&typeof renderLineup==='function')renderLineup();
    alert(gaps?`Draft built with ${gaps} truly unfillable field slot${gaps===1?'':'s'} based on the completed preferences. Review the dashed openings before game day.`:'Preference-based seven-inning draft built with full field coverage. Review each inning before game day.');
  }

  function install(){
    if(typeof state==='undefined'||!state||!document.getElementById('pods')){setTimeout(install,150);return;}mount();
    const oldRender=window.render;if(typeof oldRender==='function'&&!oldRender.__fieldRotationWrapped){const wrapped=function(...args){const r=oldRender.apply(this,args);setTimeout(()=>{if(!document.getElementById('rotationField'))mount();else renderFieldRotation();},0);return r;};wrapped.__fieldRotationWrapped=true;window.render=wrapped;}
  }
  install();
})();
