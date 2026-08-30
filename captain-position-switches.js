(()=>{
  const POSITIONS=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
  const HOME_DEFAULTS={Pitcher:['cam'],Catcher:['cj'],Shortstop:['raff','rafael']};
  const MAX_SLOTS=4;
  const CUSTOM_VALUE='__custom__';
  let installed=false,saving=false,dirty=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clean=v=>String(v??'').trim();
  const roster=()=>Array.isArray(state?.players)?state.players:[];
  const profile=()=>window.BuntFieldProfile||{};
  const prefs=p=>typeof profile().prefs==='function'?profile().prefs(p):(Array.isArray(p?.preferences)?p.preferences:[]);
  const zone=()=>state?.team?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:zone()});
  const gameDate=()=>{
    try{const d=window.BuntGameDayEligibility?.targetDate?.();if(d)return String(d);}catch(_){}
    return [...new Set((state?.events||[]).filter(e=>e?.type==='Game'&&e.date>=today()).map(e=>e.date))].sort()[0]||'';
  };
  const active=p=>{
    if(!p?.name)return false;
    try{if(typeof window.BuntGameDayEligibility?.isActive==='function')return !!window.BuntGameDayEligibility.isActive(p.name,gameDate());}catch(_){}
    return p.present!==false;
  };
  const activePlayers=()=>roster().filter(active);
  const responseFor=p=>state?.availability?.[gameDate()]?.[p?.name]||null;
  const rsvpTime=p=>{const a=responseFor(p),t=a?.status==='yes'?Date.parse(a.respondedAt||''):NaN;return Number.isFinite(t)?t:Number.MAX_SAFE_INTEGER;};
  const byRsvp=(a,b)=>rsvpTime(a)-rsvpTime(b)||(a.fullName||a.name).localeCompare(b.fullName||b.name);
  const rosterPlayer=value=>{
    const wanted=clean(value).toLowerCase();if(!wanted)return null;
    return roster().find(p=>[p?.name,p?.fullName].some(v=>clean(v).toLowerCase()===wanted))||null;
  };
  const canonical=value=>rosterPlayer(value)?.name||clean(value);
  const identityKey=value=>clean(rosterPlayer(value)?.name||value).toLowerCase();
  const sameName=(a,b)=>!!identityKey(a)&&identityKey(a)===identityKey(b);
  const display=value=>rosterPlayer(value)?.fullName||clean(value)||'Open';
  const homePlayer=pos=>{
    const aliases=HOME_DEFAULTS[pos]||[];
    return roster().find(p=>{
      const n=clean(p?.name).toLowerCase(),f=clean(p?.fullName).toLowerCase();
      return aliases.some(a=>n===a||f===a||(a==='rafael'&&(n.startsWith('raf')||f.startsWith('raf'))));
    })||null;
  };
  const homeNames=()=>new Set(Object.keys(HOME_DEFAULTS).map(pos=>homePlayer(pos)?.name).filter(Boolean));
  const liveInning=()=>Math.max(1,Math.min(7,Number(state?.gameInning||state?.fieldInning||1)));

  function blankSlot(){return{name:'',manual:false,custom:false};}
  function blankPosition(){return{primary:'',switch:'',primaryManual:false,switchManual:false,slots:[blankSlot(),blankSlot()]};}
  function normalizeSlot(slot){
    const name=clean(slot?.name||'');
    return{name,manual:!!slot?.manual,custom:typeof slot?.custom==='boolean'?slot.custom:!!(name&&!rosterPlayer(name))};
  }
  function syncLegacy(pair){
    pair.slots=Array.isArray(pair.slots)?pair.slots:[];
    while(pair.slots.length<2)pair.slots.push(blankSlot());
    pair.slots=pair.slots.slice(0,MAX_SLOTS).map(normalizeSlot);
    pair.primary=pair.slots[0]?.name||'';
    pair.primaryManual=!!pair.slots[0]?.manual;
    pair.switch=pair.slots[1]?.name||'';
    pair.switchManual=!!pair.slots[1]?.manual;
    return pair;
  }
  function normalizePosition(pair){
    pair=pair&&typeof pair==='object'?pair:blankPosition();
    if(!Array.isArray(pair.slots)){
      pair.slots=[
        {name:pair.primary||'',manual:!!pair.primaryManual,custom:!!(pair.primary&&!rosterPlayer(pair.primary))},
        {name:pair.switch||'',manual:!!pair.switchManual,custom:!!(pair.switch&&!rosterPlayer(pair.switch))}
      ];
    }
    return syncLegacy(pair);
  }
  function config(create=true){
    const d=gameDate();if(!d||!state)return null;
    if(create){
      state.fieldSwitches=state.fieldSwitches||{};
      state.fieldSwitches[d]=state.fieldSwitches[d]||{version:3,positions:{},homeDefaultsSeeded:false,updatedAt:null};
    }
    const cfg=state.fieldSwitches?.[d]||null;if(!cfg)return null;
    cfg.version=3;cfg.positions=cfg.positions||{};
    POSITIONS.forEach(pos=>{cfg.positions[pos]=normalizePosition(cfg.positions[pos]);});
    if(!cfg.homeDefaultsSeeded){
      Object.keys(HOME_DEFAULTS).forEach(pos=>{
        const p=homePlayer(pos),pair=cfg.positions[pos];
        if(p&&!pair.slots.some(s=>clean(s.name))){
          pair.slots[0]={name:p.name,manual:false,custom:false};
          syncLegacy(pair);
        }
      });
      cfg.homeDefaultsSeeded=true;
    }
    return cfg;
  }
  function overrides(create=true){
    const d=gameDate();if(!d||!state)return{};
    if(create){state.fieldSwitchInningOverrides=state.fieldSwitchInningOverrides||{};state.fieldSwitchInningOverrides[d]=state.fieldSwitchInningOverrides[d]||{};}
    return state.fieldSwitchInningOverrides?.[d]||{};
  }
  function fitScore(p,pos){
    if(!p)return-9999;const list=prefs(p),i=list.indexOf(pos);
    if(i>=0)return 1000-(i*55);
    if(p.flexible===true||p.flexibleAnywhere===true||p.preferenceMode==='flexible')return 400;
    if(p.willingElsewhere===true||p.flexibleElsewhere===true)return 180;
    return 0;
  }
  function bestPair(pool,positions){
    let best=null;
    pool.forEach(p=>positions.forEach(pos=>{
      const score=fitScore(p,pos);
      if(!best||score>best.score||(score===best.score&&byRsvp(p,best.player)<0))best={player:p,pos,score};
    }));
    return best;
  }
  function filledCount(pair){return normalizePosition(pair).slots.filter(s=>clean(s.name)).length;}
  function firstOpenSlot(pair){
    pair=normalizePosition(pair);
    let idx=pair.slots.findIndex(s=>!clean(s.name));
    if(idx<0&&pair.slots.length<MAX_SLOTS){pair.slots.push(blankSlot());idx=pair.slots.length-1;}
    return idx;
  }
  function assignAuto(pair,name){
    const idx=firstOpenSlot(pair);if(idx<0)return false;
    pair.slots[idx]={name:canonical(name),manual:false,custom:false};syncLegacy(pair);return true;
  }
  function autoAssign(){
    const cfg=config(true);if(!cfg)return;
    POSITIONS.forEach(pos=>{cfg.positions[pos]=blankPosition();});
    Object.keys(HOME_DEFAULTS).forEach(pos=>{
      const p=homePlayer(pos);
      if(p&&active(p)){cfg.positions[pos].slots[0]={name:p.name,manual:false,custom:false};syncLegacy(cfg.positions[pos]);}
    });
    cfg.homeDefaultsSeeded=true;
    const reserved=homeNames();
    let pool=activePlayers().filter(p=>!reserved.has(p.name)).sort(byRsvp);
    const normalPositions=POSITIONS.filter(pos=>!HOME_DEFAULTS[pos]);

    let open=normalPositions.filter(pos=>filledCount(cfg.positions[pos])===0);
    while(pool.length&&open.length){
      const best=bestPair(pool,open);if(!best)break;
      assignAuto(cfg.positions[best.pos],best.player.name);
      pool=pool.filter(p=>p.name!==best.player.name);
      open=open.filter(pos=>pos!==best.pos);
    }
    while(pool.length){
      const available=normalPositions.filter(pos=>filledCount(cfg.positions[pos])<MAX_SLOTS);
      if(!available.length)break;
      const minDepth=Math.min(...available.map(pos=>filledCount(cfg.positions[pos])));
      const balanced=available.filter(pos=>filledCount(cfg.positions[pos])===minDepth);
      const best=bestPair(pool,balanced);if(!best)break;
      assignAuto(cfg.positions[best.pos],best.player.name);
      pool=pool.filter(p=>p.name!==best.player.name);
    }
    cfg.updatedAt=new Date().toISOString();dirty=true;render();
    setStatus(pool.length
      ?`Auto Assign placed everyone it could. ${pool.length} active player${pool.length===1?' is':'s are'} still unassigned; use + Add player or a custom game player, then tap Update live.`
      :'Draft rebuilt from current RSVPs and field preferences. Review the position rotations, then tap Update live.');
  }
  function allSlotRefs(){
    const cfg=config(true);if(!cfg)return[];
    return POSITIONS.flatMap(pos=>cfg.positions[pos].slots.map((slot,index)=>({pos,index,slot})));
  }
  function clearPlayerFromConfig(name,exceptPos='',exceptIndex=-1){
    const cfg=config(true);if(!cfg||!clean(name))return;
    allSlotRefs().forEach(({pos,index,slot})=>{
      if(pos===exceptPos&&index===exceptIndex)return;
      if(sameName(slot.name,name)){slot.name='';slot.manual=false;slot.custom=false;syncLegacy(cfg.positions[pos]);}
    });
  }
  function setSlot(pos,index,value,{custom=false,manual=true}={}){
    const cfg=config(true);if(!cfg||!POSITIONS.includes(pos))return;
    const pair=cfg.positions[pos];while(pair.slots.length<=index&&pair.slots.length<MAX_SLOTS)pair.slots.push(blankSlot());
    if(index<0||index>=pair.slots.length||index>=MAX_SLOTS)return;
    const name=canonical(value);
    if(name)clearPlayerFromConfig(name,pos,index);
    pair.slots[index]={name,manual:!!manual,custom:!!custom};
    syncLegacy(pair);dirty=true;render();
  }
  function chooseSlot(pos,index,value){
    const cfg=config(true);if(!cfg)return;const pair=cfg.positions[pos];if(!pair)return;
    if(value===CUSTOM_VALUE){
      while(pair.slots.length<=index&&pair.slots.length<MAX_SLOTS)pair.slots.push(blankSlot());
      const existing=pair.slots[index]||blankSlot();
      pair.slots[index]={name:existing.custom?existing.name:'',manual:true,custom:true};
      syncLegacy(pair);dirty=true;render();return;
    }
    setSlot(pos,index,value,{custom:false,manual:true});
  }
  function addSlot(pos){
    const cfg=config(true),pair=cfg?.positions?.[pos];if(!pair||pair.slots.length>=MAX_SLOTS)return;
    pair.slots.push(blankSlot());syncLegacy(pair);dirty=true;render();setStatus(`Added Player ${pair.slots.length} to ${pos}.`);
  }
  function removeSlot(pos,index){
    const cfg=config(true),pair=cfg?.positions?.[pos];if(!pair||index<2||index>=pair.slots.length)return;
    pair.slots.splice(index,1);syncLegacy(pair);dirty=true;render();setStatus(`Removed the extra rotation slot from ${pos}.`);
  }
  function slotEligible(slot){
    const value=clean(slot?.name);if(!value)return false;
    if(slot?.manual)return true;
    const p=rosterPlayer(value);return p?active(p):true;
  }
  function sanitizeLineup(line){
    const out={},used=new Set();
    POSITIONS.forEach(pos=>{
      const value=canonical(line?.[pos]||''),key=identityKey(value);
      if(value&&key&&!used.has(key)){out[pos]=value;used.add(key);}else out[pos]='';
    });
    return out;
  }
  function buildInnings(){
    const cfg=config(true),ov=overrides(false),result={};
    for(let inning=1;inning<=7;inning++){
      const line={},used=new Set();
      POSITIONS.forEach(pos=>{
        const pair=cfg?.positions?.[pos]||blankPosition();
        const eligible=normalizePosition(pair).slots.filter(slotEligible).map(s=>canonical(s.name)).filter(Boolean);
        let candidate=eligible.length?eligible[(inning-1)%eligible.length]:'';
        let key=identityKey(candidate);
        if(candidate&&key&&used.has(key)){
          candidate=eligible.find(name=>{const k=identityKey(name);return k&&!used.has(k);})||'';
          key=identityKey(candidate);
        }
        if(candidate&&key&&!used.has(key)){line[pos]=candidate;used.add(key);}else line[pos]='';
      });
      if(ov?.[inning]||ov?.[String(inning)])result[inning]=sanitizeLineup(ov[inning]||ov[String(inning)]);
      else result[inning]=line;
    }
    return result;
  }
  function assignedKeys(){
    const cfg=config(false);if(!cfg)return new Set();
    return new Set(POSITIONS.flatMap(pos=>normalizePosition(cfg.positions?.[pos]).slots.map(s=>s.name)).map(identityKey).filter(Boolean));
  }
  function ruleState(){
    const activeList=activePlayers(),assigned=assignedKeys();
    const unassigned=activeList.filter(p=>!assigned.has(identityKey(p.name)));
    return{n:activeList.length,placed:assigned.size,unassigned};
  }
  async function saveLive(message){
    if(saving)return false;saving=true;renderButtons();
    try{
      if(typeof queueSave==='function')queueSave();
      if(typeof window.buntCakesSaveNow==='function')await window.buntCakesSaveNow();
      else await new Promise(resolve=>setTimeout(resolve,500));
      dirty=false;setStatus(message||'Saved live. Players will receive the update automatically.');return true;
    }catch(e){setStatus('Save failed: '+(e?.message||'try again'),true);return false;}
    finally{saving=false;renderButtons();}
  }
  async function publish(){
    const cfg=config(true);if(!cfg){setStatus('No upcoming game is available yet.',true);return;}
    cfg.updatedAt=new Date().toISOString();
    state.innings=buildInnings();
    state.pods=[];
    if(typeof renderLineup==='function')renderLineup();
    render();
    await saveLive('Fielding rotation is live. Roster and custom game players are included, and player devices refresh automatically.');
  }
  function quickSelectedName(){
    const select=document.getElementById('switchQuickPlayer');
    if(!select)return'';
    if(select.value===CUSTOM_VALUE)return canonical(document.getElementById('switchQuickCustom')?.value||'');
    return canonical(select.value||'');
  }
  async function quickMove(){
    const posSel=document.getElementById('switchQuickPosition'),name=quickSelectedName(),target=posSel?.value||'';if(!name){setStatus('Choose a roster player or enter a custom game player first.',true);return;}
    const inning=liveInning(),all=buildInnings(),line=sanitizeLineup(state?.innings?.[inning]||all[inning]||{});
    const oldPos=POSITIONS.find(pos=>sameName(line[pos],name))||'';
    if(oldPos)line[oldPos]='';
    if(target&&target!=='Rest'){
      const occupied=line[target]||'';
      if(occupied&&!sameName(occupied,name)&&oldPos)line[oldPos]=occupied;
      line[target]=name;
    }
    const ov=overrides(true);ov[inning]=sanitizeLineup(line);state.innings=state.innings||{};state.innings[inning]=sanitizeLineup(line);
    if(typeof renderLineup==='function')renderLineup();render();
    await saveLive(`${display(name)} is updated live for inning ${inning}${target&&target!=='Rest'?' at '+target:' as resting'}.`);
  }
  async function clearLiveOverride(){
    const ov=overrides(false),inning=liveInning();if(!ov||(!ov[inning]&&!ov[String(inning)]))return;
    delete ov[inning];delete ov[String(inning)];state.innings=buildInnings();render();if(typeof renderLineup==='function')renderLineup();await saveLive(`Inning ${inning} returned to the normal rotation plan.`);
  }
  function sortedRoster(){return roster().slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));}
  function playerOptions(value='',includePrompt=false){
    const current=rosterPlayer(value);
    return `${includePrompt?'<option value="">Choose a player</option>':'<option value="">Open</option>'}`
      +sortedRoster().map(p=>`<option value="${esc(p.name)}" ${current?.name===p.name?'selected':''}>${esc(p.fullName||p.name)}</option>`).join('')
      +`<option value="${CUSTOM_VALUE}" ${clean(value)&&!current?'selected':''}>+ Custom player for this game…</option>`;
  }
  function statusLineFor(pos){
    const pair=normalizePosition(config(false)?.positions?.[pos]||blankPosition()),names=pair.slots.map(s=>clean(s.name)).filter(Boolean),home=homePlayer(pos);
    const homeText=HOME_DEFAULTS[pos]?`Home default: ${display(home?.name||HOME_DEFAULTS[pos][0])}. `:'';
    if(!names.length)return `${homeText}Open position.`;
    if(names.length===1)return `${homeText}${display(names[0])} fields every inning.`;
    return `${homeText}Rotation: ${names.map(display).join(' → ')} → repeat.`;
  }
  function renderRules(){
    const box=document.getElementById('switchRules');if(!box)return;const r=ruleState();
    const warn=r.n<6||r.unassigned.length>0;
    let text=`${r.n} active RSVP${r.n===1?'':'s'} • ${r.placed} unique name${r.placed===1?'':'s'} placed`;
    if(r.n<6)text+=' • league minimum is 6, but Captain manual names can still be published';
    if(r.unassigned.length)text+=` • active but unassigned: ${r.unassigned.map(p=>p.name).join(', ')}`;
    box.className=warn?'switch-warn':'switch-ok';box.textContent=text;
  }
  function renderPositions(){
    const box=document.getElementById('switchPositions');if(!box)return;const cfg=config(true);
    box.innerHTML=POSITIONS.map(pos=>{
      const pair=normalizePosition(cfg.positions[pos]),home=!!HOME_DEFAULTS[pos];
      const slots=pair.slots.map((slot,index)=>{
        const current=clean(slot.name),custom=!!slot.custom||(current&&!rosterPlayer(current));
        return `<div class="switch-slot-row"><label class="switch-slot-label">Player ${index+1}<select data-pos="${esc(pos)}" data-index="${index}">${playerOptions(current,false)}</select></label>${custom?`<label class="switch-custom-label">Game-only name<input type="search" data-custom-pos="${esc(pos)}" data-custom-index="${index}" value="${esc(current)}" placeholder="Type player name" autocomplete="off" autocapitalize="words" spellcheck="true"></label>`:''}${index>=2?`<button type="button" class="switch-remove-slot" data-remove-pos="${esc(pos)}" data-remove-index="${index}" aria-label="Remove Player ${index+1}">Remove</button>`:''}</div>`;
      }).join('');
      return `<div class="card switch-position ${home?'switch-fixed':''}"><div class="switch-position-head"><strong>${esc(pos)}</strong>${home?'<span class="pill">Home default • editable</span>':'<span class="pill">Rotation</span>'}</div><div class="switch-slot-list">${slots}</div><div class="switch-position-actions">${pair.slots.length<MAX_SLOTS?`<button type="button" class="switch-add-slot" data-add-pos="${esc(pos)}">+ Add player</button>`:''}</div><div class="muted switch-pattern">${esc(statusLineFor(pos))}</div></div>`;
    }).join('');
    box.querySelectorAll('select[data-index]').forEach(select=>select.onchange=()=>chooseSlot(select.dataset.pos,Number(select.dataset.index),select.value));
    box.querySelectorAll('input[data-custom-index]').forEach(input=>{
      input.onchange=()=>setSlot(input.dataset.customPos,Number(input.dataset.customIndex),input.value,{custom:true,manual:true});
      input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}};
    });
    box.querySelectorAll('[data-add-pos]').forEach(btn=>btn.onclick=()=>addSlot(btn.dataset.addPos));
    box.querySelectorAll('[data-remove-pos]').forEach(btn=>btn.onclick=()=>removeSlot(btn.dataset.removePos,Number(btn.dataset.removeIndex)));
  }
  function renderQuick(){
    const box=document.getElementById('switchQuick');if(!box)return;const inning=liveInning(),line=state?.innings?.[inning]||buildInnings()[inning]||{};
    const posOptions='<option value="Rest">Rest</option>'+POSITIONS.map(pos=>`<option value="${esc(pos)}">${esc(pos)}${line[pos]?' — '+esc(display(line[pos])):''}</option>`).join('');
    box.innerHTML=`<div><div class="muted">QUICK CAPTAIN OVERRIDE</div><h3 style="margin:.2rem 0">Change inning ${inning} now</h3></div><div class="switch-quick-grid"><label>Player<select id="switchQuickPlayer">${playerOptions('',true)}</select></label><label id="switchQuickCustomWrap" class="switch-quick-custom hidden">Custom game player<input id="switchQuickCustom" type="search" placeholder="Type player name" autocomplete="off" autocapitalize="words" spellcheck="true"></label><label>Position<select id="switchQuickPosition">${posOptions}</select></label><button id="switchQuickApply" class="primary">Apply & Update live</button></div><button id="switchClearOverride" class="switch-clear">Clear inning ${inning} override</button>`;
    const psel=document.getElementById('switchQuickPlayer'),wrap=document.getElementById('switchQuickCustomWrap');
    psel.onchange=()=>{wrap.classList.toggle('hidden',psel.value!==CUSTOM_VALUE);if(psel.value===CUSTOM_VALUE)document.getElementById('switchQuickCustom')?.focus();};
    document.getElementById('switchQuickApply').onclick=quickMove;document.getElementById('switchClearOverride').onclick=clearLiveOverride;
  }
  function renderButtons(){
    const pub=document.getElementById('switchPublish'),auto=document.getElementById('switchAuto');
    if(pub){pub.disabled=saving;pub.textContent=saving?'Saving…':'Update live';}
    if(auto)auto.disabled=saving;
  }
  function setStatus(message,warn=false){const el=document.getElementById('switchStatus');if(!el)return;el.className=warn?'switch-status warn':'switch-status';el.textContent=message;}
  function ensureStyles(){
    if(document.getElementById('positionSwitchStyles'))return;const style=document.createElement('style');style.id='positionSwitchStyles';style.textContent=`
      #pods{gap:12px}.switch-hero{border:2px solid #86efac;background:#f7fff8}.switch-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.switch-actions button{flex:1 1 180px;font-weight:900}.switch-ok,.switch-warn{margin-top:10px;padding:10px;border-radius:12px;font-weight:800}.switch-ok{background:#ecfdf3;color:#166534;border:1px solid #86efac}.switch-warn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.switch-status{margin-top:9px;color:#166534;font-weight:800}.switch-status.warn{color:#991b1b}.switch-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.switch-position{padding:12px}.switch-position-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.switch-fixed{border:2px solid #bbf7d0;background:#f7fff8}.switch-slot-list{display:grid;gap:8px;margin-top:9px}.switch-slot-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:8px;align-items:end}.switch-slot-row select,.switch-slot-row input,.switch-quick-grid input,.switch-quick-grid select{width:100%;margin-top:5px;min-height:44px;border:1px solid var(--l);border-radius:12px;padding:10px;font:inherit;background:#fff}.switch-custom-label{min-width:0}.switch-remove-slot{min-height:44px}.switch-position-actions{margin-top:8px}.switch-add-slot{font-weight:800}.switch-pattern{margin-top:8px}.switch-quick{border:2px solid #93c5fd;background:#eff6ff}.switch-quick-grid{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;align-items:end;margin-top:10px}.switch-clear{margin-top:8px}.switch-explain{display:grid;gap:5px;margin-top:8px}.switch-explain strong{color:#166534}@media(max-width:850px){.switch-quick-grid{grid-template-columns:1fr 1fr}.switch-quick-grid button{width:100%}}@media(max-width:700px){.switch-grid{grid-template-columns:1fr}.switch-slot-row{grid-template-columns:1fr}.switch-remove-slot{width:100%}.switch-quick-grid{grid-template-columns:1fr}.switch-quick-grid button{width:100%}}
    `;document.head.appendChild(style);
  }
  function mount(){
    const section=document.getElementById('pods');if(!section||!state)return false;ensureStyles();const tab=document.querySelector('[data-tab="pods"]');if(tab)tab.textContent='Fielding';
    config(true);
    section.innerHTML=`<div class="card switch-hero"><h2 style="margin:.2rem 0">Fielding</h2><div id="switchRules"></div><div class="switch-actions"><button id="switchAuto">Auto assign from RSVPs</button><button id="switchPublish" class="primary">Update live</button></div><div id="switchStatus" class="switch-status">${dirty?'Unsaved fielding changes.':'Ready.'}</div></div><div id="switchQuick" class="card switch-quick"></div><div id="switchPositions" class="switch-grid"></div>`;
    document.getElementById('switchAuto').onclick=autoAssign;document.getElementById('switchPublish').onclick=publish;renderRules();renderQuick();renderPositions();renderButtons();return true;
  }
  function render(){if(!document.getElementById('pods'))return;mount();}
  function install(){
    if(installed)return;if(typeof state==='undefined'||!state||!document.getElementById('pods')){setTimeout(install,150);return;}installed=true;mount();
    window.addEventListener('buntpreferrednamesrefresh',()=>{if(!document.querySelector('#pods input:focus,#pods select:focus'))render();});
    window.addEventListener('buntgamedayeligibilitychange',()=>{dirty=true;render();setStatus('Attendance changed. Auto Assign can rebuild from RSVPs, or keep your manual Captain setup and tap Update live.');});
    window.addEventListener('pageshow',render);
  }
  window.BuntPositionSwitches={autoAssign,publish,buildInnings,render};install();
})();