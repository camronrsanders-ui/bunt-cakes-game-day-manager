(()=>{
  const POSITIONS=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
  const HOME_DEFAULTS={Pitcher:['cam'],Catcher:['cj'],Shortstop:['raff','rafael']};
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

  function blankPair(){return{primary:'',switch:'',primaryManual:false,switchManual:false};}
  function config(create=true){
    const d=gameDate();if(!d||!state)return null;
    if(create){
      state.fieldSwitches=state.fieldSwitches||{};
      state.fieldSwitches[d]=state.fieldSwitches[d]||{version:2,positions:{},homeDefaultsSeeded:false,updatedAt:null};
    }
    const cfg=state.fieldSwitches?.[d]||null;if(!cfg)return null;
    cfg.version=2;cfg.positions=cfg.positions||{};
    POSITIONS.forEach(pos=>{
      cfg.positions[pos]=cfg.positions[pos]||blankPair();
      if(typeof cfg.positions[pos].primaryManual!=='boolean')cfg.positions[pos].primaryManual=false;
      if(typeof cfg.positions[pos].switchManual!=='boolean')cfg.positions[pos].switchManual=false;
    });
    if(!cfg.homeDefaultsSeeded){
      Object.keys(HOME_DEFAULTS).forEach(pos=>{
        const p=homePlayer(pos);
        if(p&&!cfg.positions[pos].primary){
          cfg.positions[pos].primary=p.name;
          cfg.positions[pos].primaryManual=false;
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
  function autoAssign(){
    const cfg=config(true);if(!cfg)return;
    POSITIONS.forEach(pos=>{cfg.positions[pos]=blankPair();});
    Object.keys(HOME_DEFAULTS).forEach(pos=>{
      const p=homePlayer(pos);
      if(p&&active(p))cfg.positions[pos].primary=p.name;
    });
    cfg.homeDefaultsSeeded=true;
    const reserved=homeNames();
    let pool=activePlayers().filter(p=>!reserved.has(p.name)).sort(byRsvp);
    let open=POSITIONS.filter(pos=>!cfg.positions[pos].primary);
    while(pool.length&&open.length){
      const best=bestPair(pool,open);if(!best)break;
      cfg.positions[best.pos].primary=best.player.name;
      pool=pool.filter(p=>p.name!==best.player.name);open=open.filter(p=>p!==best.pos);
    }
    let extras=pool.slice(),switchable=POSITIONS.filter(pos=>cfg.positions[pos].primary&&!cfg.positions[pos].switch);
    while(extras.length&&switchable.length){
      const best=bestPair(extras,switchable);if(!best)break;
      cfg.positions[best.pos].switch=best.player.name;
      extras=extras.filter(p=>p.name!==best.player.name);switchable=switchable.filter(p=>p!==best.pos);
    }
    cfg.updatedAt=new Date().toISOString();dirty=true;render();
    setStatus(extras.length
      ?`Auto Assign placed everyone it could from RSVPs. ${extras.length} active player${extras.length===1?' is':'s are'} still unassigned; type names where you want them, then tap Update live.`
      :'Draft rebuilt from current RSVPs and field preferences. Edit or type any names you need, then tap Update live.');
  }
  function clearPlayerFromConfig(name,exceptPos='',exceptSlot=''){
    const cfg=config(true);if(!cfg||!clean(name))return;
    POSITIONS.forEach(pos=>['primary','switch'].forEach(slot=>{
      if(pos===exceptPos&&slot===exceptSlot)return;
      if(sameName(cfg.positions[pos][slot],name)){
        cfg.positions[pos][slot]='';
        cfg.positions[pos][slot+'Manual']=false;
      }
    }));
  }
  function setSlot(pos,slot,value){
    const cfg=config(true);if(!cfg||!POSITIONS.includes(pos)||!['primary','switch'].includes(slot))return;
    const name=canonical(value);
    if(name){
      clearPlayerFromConfig(name,pos,slot);
      cfg.positions[pos][slot]=name;
      cfg.positions[pos][slot+'Manual']=true;
    }else{
      cfg.positions[pos][slot]='';
      cfg.positions[pos][slot+'Manual']=false;
    }
    dirty=true;render();
  }
  function slotEligible(name,manual){
    const value=clean(name);if(!value)return false;
    if(manual)return true;
    const p=rosterPlayer(value);
    return p?active(p):true;
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
        const pair=cfg?.positions?.[pos]||blankPair();
        const a=slotEligible(pair.primary,pair.primaryManual)?canonical(pair.primary):'';
        const b=slotEligible(pair.switch,pair.switchManual)?canonical(pair.switch):'';
        let candidate='';
        if(a&&b)candidate=inning%2===1?a:b;
        else candidate=a||b;
        const key=identityKey(candidate);
        if(candidate&&key&&!used.has(key)){line[pos]=candidate;used.add(key);}else line[pos]='';
      });
      if(ov?.[inning]||ov?.[String(inning)])result[inning]=sanitizeLineup(ov[inning]||ov[String(inning)]);
      else result[inning]=line;
    }
    return result;
  }
  function assignedKeys(){
    const cfg=config(false);if(!cfg)return new Set();
    return new Set(POSITIONS.flatMap(pos=>[cfg.positions?.[pos]?.primary,cfg.positions?.[pos]?.switch]).map(identityKey).filter(Boolean));
  }
  function ruleState(){
    const activeList=activePlayers(),assigned=assignedKeys();
    const unassigned=activeList.filter(p=>!assigned.has(identityKey(p.name)));
    const unavailableHomes=Object.keys(HOME_DEFAULTS).filter(pos=>{const p=homePlayer(pos);return p&&!active(p);});
    return{n:activeList.length,placed:assigned.size,unassigned,unavailableHomes};
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
    await saveLive('Field switches and all 7 innings are live. Manual Captain names are included, and player devices refresh automatically.');
  }
  async function quickMove(){
    const psel=document.getElementById('switchQuickPlayer'),posSel=document.getElementById('switchQuickPosition');
    const name=canonical(psel?.value||''),target=posSel?.value||'';if(!name)return;
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
    const ov=overrides(false),inning=liveInning();if(!ov||!ov[inning]&&!ov[String(inning)])return;
    delete ov[inning];delete ov[String(inning)];state.innings=buildInnings();render();if(typeof renderLineup==='function')renderLineup();await saveLive(`Inning ${inning} returned to the normal switch plan.`);
  }
  function suggestionOptions(){
    return roster().slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name)).map(p=>`<option value="${esc(p.name)}">${esc(p.fullName||p.name)}</option>`).join('');
  }
  function statusLineFor(pos){
    const pair=config(false)?.positions?.[pos]||blankPair(),a=pair.primary,b=pair.switch,home=homePlayer(pos);
    const homeText=HOME_DEFAULTS[pos]?`Home default: ${display(home?.name||HOME_DEFAULTS[pos][0])}. `:'';
    if(a&&b)return `${homeText}Innings 1/3/5/7: ${display(a)} • Innings 2/4/6: ${display(b)}`;
    if(a)return `${homeText}${display(a)} fields every inning until a switch name is added.`;
    if(b)return `${homeText}${display(b)} fields every inning until a primary name is added.`;
    return `${homeText}Open position — Captain can type a name.`;
  }
  function renderRules(){
    const box=document.getElementById('switchRules');if(!box)return;const r=ruleState();
    const warn=r.n<6||r.unassigned.length>0;
    let text=`${r.n} active RSVP${r.n===1?'':'s'} • ${r.placed} unique name${r.placed===1?'':'s'} placed in the rotation`;
    if(r.n<6)text+=' • league minimum is 6, but Captain manual names can still be published';
    if(r.unavailableHomes.length)text+=` • home-default player unavailable at: ${r.unavailableHomes.join(', ')}`;
    if(r.unassigned.length)text+=` • active but unassigned: ${r.unassigned.map(p=>p.name).join(', ')}`;
    box.className=warn?'switch-warn':'switch-ok';box.textContent=text;
  }
  function renderPositions(){
    const box=document.getElementById('switchPositions');if(!box)return;const cfg=config(true);
    box.innerHTML=POSITIONS.map(pos=>{
      const pair=cfg.positions[pos],home=!!HOME_DEFAULTS[pos];
      return `<div class="card switch-position ${home?'switch-fixed':''}"><div class="switch-position-head"><strong>${esc(pos)}</strong>${home?'<span class="pill">Home default • editable</span>':'<span class="pill">Primary + switch</span>'}</div><div class="switch-selects"><label>Primary<input data-pos="${esc(pos)}" data-slot="primary" list="switchPlayerNames" value="${esc(pair.primary)}" placeholder="Type a name"></label><label>Switch<input data-pos="${esc(pos)}" data-slot="switch" list="switchPlayerNames" value="${esc(pair.switch)}" placeholder="Type a name"></label></div><div class="muted switch-pattern">${esc(statusLineFor(pos))}</div></div>`;
    }).join('');
    box.querySelectorAll('input[data-slot]').forEach(input=>input.onchange=()=>setSlot(input.dataset.pos,input.dataset.slot,input.value));
  }
  function renderQuick(){
    const box=document.getElementById('switchQuick');if(!box)return;const inning=liveInning(),line=state?.innings?.[inning]||buildInnings()[inning]||{};
    const posOptions='<option value="Rest">Rest</option>'+POSITIONS.map(pos=>`<option value="${esc(pos)}">${esc(pos)}${line[pos]?' — '+esc(display(line[pos])):''}</option>`).join('');
    box.innerHTML=`<div><div class="muted">QUICK CAPTAIN OVERRIDE</div><h3 style="margin:.2rem 0">Change inning ${inning} now</h3><div class="muted">Type any player name, then move them to any position or Rest. Manual Captain changes override the normal home defaults and RSVP auto-assignment.</div></div><div class="switch-quick-grid"><label>Player<input id="switchQuickPlayer" list="switchPlayerNames" placeholder="Type a name"></label><label>Position<select id="switchQuickPosition">${posOptions}</select></label><button id="switchQuickApply" class="primary">Apply & Update live</button></div><button id="switchClearOverride" class="switch-clear">Clear inning ${inning} override</button>`;
    document.getElementById('switchQuickApply').onclick=quickMove;document.getElementById('switchClearOverride').onclick=clearLiveOverride;
  }
  function renderButtons(){
    const pub=document.getElementById('switchPublish'),auto=document.getElementById('switchAuto');if(pub){pub.disabled=saving;pub.textContent=saving?'Saving…':'Update live';}if(auto)auto.disabled=saving;
  }
  function setStatus(message,warn=false){const el=document.getElementById('switchStatus');if(!el)return;el.className=warn?'switch-status warn':'switch-status';el.textContent=message;}
  function ensureStyles(){
    if(document.getElementById('positionSwitchStyles'))return;const style=document.createElement('style');style.id='positionSwitchStyles';style.textContent=`
      #pods{gap:12px}.switch-hero{border:2px solid #86efac;background:#f7fff8}.switch-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.switch-actions button{flex:1 1 180px;font-weight:900}.switch-ok,.switch-warn{margin-top:10px;padding:10px;border-radius:12px;font-weight:800}.switch-ok{background:#ecfdf3;color:#166534;border:1px solid #86efac}.switch-warn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.switch-status{margin-top:9px;color:#166534;font-weight:800}.switch-status.warn{color:#991b1b}.switch-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.switch-position{padding:12px}.switch-position-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.switch-fixed{border:2px solid #bbf7d0;background:#f7fff8}.switch-selects{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.switch-selects input,.switch-quick-grid input,.switch-quick-grid select{width:100%;margin-top:5px;min-height:44px;border:1px solid var(--l);border-radius:12px;padding:10px;font:inherit}.switch-pattern{margin-top:8px}.switch-quick{border:2px solid #93c5fd;background:#eff6ff}.switch-quick-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-top:10px}.switch-clear{margin-top:8px}.switch-explain{display:grid;gap:5px;margin-top:8px}.switch-explain strong{color:#166534}@media(max-width:700px){.switch-grid{grid-template-columns:1fr}.switch-quick-grid{grid-template-columns:1fr}.switch-quick-grid button{width:100%}}@media(max-width:430px){.switch-selects{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }
  function mount(){
    const section=document.getElementById('pods');if(!section||!state)return false;ensureStyles();const tab=document.querySelector('[data-tab="pods"]');if(tab)tab.textContent='Field Rotation';
    config(true);
    section.innerHTML=`<datalist id="switchPlayerNames">${suggestionOptions()}</datalist><div class="card switch-hero"><div class="muted">POSITION SWITCH SYSTEM</div><h2 style="margin:.2rem 0">Field Rotation</h2><div class="muted">No pods. Every field position is editable. Use roster suggestions or type any name. Primary and switch alternate by inning; a single name stays in that position every inning.</div><div id="switchRules"></div><div class="switch-explain"><div><strong>Home defaults:</strong> Cam → Pitcher • Raff → Shortstop • CJ → Catcher. Auto Assign keeps them there and will not place them elsewhere.</div><div><strong>Captain control:</strong> You can edit those defaults, add a switch, move those players anywhere, or type a manual name. Manual Captain changes win.</div><div><strong>Roster handling:</strong> RSVP drives Auto Assign only. Field Rotation does not enforce a substitute count or player maximum.</div></div><div class="switch-actions"><button id="switchAuto">Auto assign from RSVPs</button><button id="switchPublish" class="primary">Update live</button></div><div id="switchStatus" class="switch-status">${dirty?'Unsaved switch changes.':'Ready.'}</div></div><div id="switchQuick" class="card switch-quick"></div><div id="switchPositions" class="switch-grid"></div>`;
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