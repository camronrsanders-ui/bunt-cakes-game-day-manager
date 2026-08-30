(()=>{
  const POSITIONS=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
  const FIXED={Pitcher:['cam'],Catcher:['cj'],Shortstop:['raff','rafael']};
  const ROTATING=POSITIONS.filter(p=>!FIXED[p]);
  let installed=false,saving=false,dirty=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
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
  const player=name=>roster().find(p=>p?.name===name)||null;
  const display=name=>player(name)?.fullName||name||'Open';
  const fixedPlayer=pos=>{
    const aliases=FIXED[pos]||[];
    return roster().find(p=>{
      const n=String(p?.name||'').trim().toLowerCase(),f=String(p?.fullName||'').trim().toLowerCase();
      return aliases.some(a=>n===a||f===a||(a==='rafael'&&(n.startsWith('raf')||f.startsWith('raf'))));
    })||null;
  };
  const fixedNames=()=>new Set(Object.keys(FIXED).map(pos=>fixedPlayer(pos)?.name).filter(Boolean));
  const liveInning=()=>Math.max(1,Math.min(7,Number(state?.gameInning||state?.fieldInning||1)));
  const prettyDate=d=>d?new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}):'Next game';

  function config(create=true){
    const d=gameDate();if(!d||!state)return null;
    if(create){state.fieldSwitches=state.fieldSwitches||{};state.fieldSwitches[d]=state.fieldSwitches[d]||{version:1,positions:{},updatedAt:null};}
    const cfg=state.fieldSwitches?.[d]||null;if(!cfg)return null;
    cfg.positions=cfg.positions||{};
    POSITIONS.forEach(pos=>{cfg.positions[pos]=cfg.positions[pos]||{primary:'',switch:''};});
    Object.keys(FIXED).forEach(pos=>{const p=fixedPlayer(pos);if(p){cfg.positions[pos].primary=p.name;cfg.positions[pos].switch='';}});
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
    ROTATING.forEach(pos=>{cfg.positions[pos]={primary:'',switch:''};});
    Object.keys(FIXED).forEach(pos=>{const p=fixedPlayer(pos);cfg.positions[pos]={primary:p?.name||'',switch:''};});
    const reserved=fixedNames();let pool=activePlayers().filter(p=>!reserved.has(p.name)).sort(byRsvp);
    let open=[...ROTATING];
    while(pool.length&&open.length){
      const best=bestPair(pool,open);if(!best)break;
      cfg.positions[best.pos].primary=best.player.name;
      pool=pool.filter(p=>p.name!==best.player.name);open=open.filter(p=>p!==best.pos);
    }
    const primaryCount=POSITIONS.filter(pos=>{const n=cfg.positions[pos].primary;return n&&active(player(n));}).length;
    const allowedSubs=Math.min(4,Math.max(0,activePlayers().length-primaryCount));
    let extras=pool.slice(0,allowedSubs),switchable=ROTATING.filter(pos=>cfg.positions[pos].primary&&!cfg.positions[pos].switch);
    while(extras.length&&switchable.length){
      const best=bestPair(extras,switchable);if(!best)break;
      cfg.positions[best.pos].switch=best.player.name;
      extras=extras.filter(p=>p.name!==best.player.name);switchable=switchable.filter(p=>p!==best.pos);
    }
    cfg.updatedAt=new Date().toISOString();dirty=true;render();
    setStatus('Draft rebuilt from current RSVPs and field preferences. Tap Update live when it looks right.');
  }
  function clearPlayerFromConfig(name,exceptPos='',exceptSlot=''){
    const cfg=config(true);if(!cfg||!name)return;
    POSITIONS.forEach(pos=>['primary','switch'].forEach(slot=>{
      if(pos===exceptPos&&slot===exceptSlot)return;
      if(cfg.positions[pos][slot]===name&&!FIXED[pos])cfg.positions[pos][slot]='';
    }));
  }
  function setSlot(pos,slot,name){
    if(FIXED[pos])return;
    const cfg=config(true);if(!cfg)return;
    if(name){clearPlayerFromConfig(name,pos,slot);cfg.positions[pos][slot]=name;if(slot==='switch'&&cfg.positions[pos].primary===name)cfg.positions[pos].primary='';}
    else cfg.positions[pos][slot]='';
    dirty=true;render();
  }
  function sanitizeLineup(line){
    const out={},used=new Set(),activeSet=new Set(activePlayers().map(p=>p.name));
    POSITIONS.forEach(pos=>{const n=String(line?.[pos]||'');if(n&&activeSet.has(n)&&!used.has(n)){out[pos]=n;used.add(n);}else out[pos]='';});
    return out;
  }
  function buildInnings(){
    const cfg=config(true),ov=overrides(false),activeSet=new Set(activePlayers().map(p=>p.name)),result={};
    for(let inning=1;inning<=7;inning++){
      const line={},used=new Set();
      POSITIONS.forEach(pos=>{
        const pair=cfg?.positions?.[pos]||{},a=pair.primary||'',b=pair.switch||'';
        let candidate='';
        if(FIXED[pos])candidate=activeSet.has(a)?a:'';
        else if(b&&activeSet.has(b))candidate=inning%2===1?a:b;
        else candidate=a;
        if(candidate&&!activeSet.has(candidate))candidate=b&&activeSet.has(b)?b:'';
        if(candidate&&!used.has(candidate)){line[pos]=candidate;used.add(candidate);}else line[pos]='';
      });
      if(ov?.[inning]||ov?.[String(inning)])result[inning]=sanitizeLineup(ov[inning]||ov[String(inning)]);
      else result[inning]=line;
    }
    return result;
  }
  function assignedNames(){const cfg=config(false);if(!cfg)return new Set();return new Set(POSITIONS.flatMap(pos=>[cfg.positions?.[pos]?.primary,cfg.positions?.[pos]?.switch]).filter(Boolean));}
  function ruleState(){
    const n=activePlayers().length,fielders=Math.min(11,n),subs=Math.max(0,n-fielders),assigned=assignedNames();
    const unassigned=activePlayers().filter(p=>!assigned.has(p.name));
    const missingFixed=Object.keys(FIXED).filter(pos=>{const p=fixedPlayer(pos);return !p||!active(p);});
    return{n,fielders,subs,unassigned,missingFixed,valid:n>=6&&n<=15&&subs<=4&&subs<=fielders};
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
    const rules=ruleState();
    if(rules.n<6){setStatus(`Only ${rules.n} active players. A minimum of 6 is required to play.`,true);return;}
    if(rules.n>15){setStatus(`${rules.n} players are active. The game-day maximum is 15 (11 fielders + 4 subs). Mark ${rules.n-15} player${rules.n-15===1?'':'s'} out before publishing.`,true);return;}
    if(rules.subs>4||rules.subs>rules.fielders){setStatus('Substitution limits are not valid for this game-day roster.',true);return;}
    const cfg=config(true);cfg.updatedAt=new Date().toISOString();
    state.innings=buildInnings();
    state.pods=[];
    if(typeof renderLineup==='function')renderLineup();
    render();
    await saveLive('Field switches and all 7 innings are live. Player devices refresh automatically.');
  }
  async function quickMove(){
    const psel=document.getElementById('switchQuickPlayer'),posSel=document.getElementById('switchQuickPosition');
    const name=psel?.value||'',target=posSel?.value||'';if(!name)return;
    const inning=liveInning(),all=buildInnings(),line=sanitizeLineup(state?.innings?.[inning]||all[inning]||{});
    const oldPos=POSITIONS.find(pos=>line[pos]===name)||'';
    if(oldPos)line[oldPos]='';
    if(target&&target!=='Rest'){
      const occupied=line[target]||'';
      if(occupied&&occupied!==name){if(oldPos)line[oldPos]=occupied;}
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
  function optionList(selected='',includeFixed=false){
    const fixed=fixedNames();return '<option value="">—</option>'+activePlayers().slice().sort(byRsvp).filter(p=>includeFixed||!fixed.has(p.name)).map(p=>`<option value="${esc(p.name)}" ${p.name===selected?'selected':''}>${esc(p.fullName||p.name)}</option>`).join('');
  }
  function statusLineFor(pos){
    const pair=config(false)?.positions?.[pos]||{},a=pair.primary,b=pair.switch;
    if(FIXED[pos])return a?`${display(a)} stays at ${pos} every inning.`:`Permanent ${pos} player is not available.`;
    if(a&&b)return `Innings 1/3/5/7: ${display(a)} • Innings 2/4/6: ${display(b)}`;
    if(a)return `${display(a)} fields every inning until a switch player is added.`;
    return 'Open position';
  }
  function renderRules(){
    const box=document.getElementById('switchRules');if(!box)return;const r=ruleState();
    const cls=r.valid?'switch-ok':'switch-warn';let text=`${r.n} active • ${r.fielders} fielding • ${r.subs} sub${r.subs===1?'':'s'}`;
    if(r.n<6)text+=` • NEED ${6-r.n} MORE TO PLAY`;
    if(r.n>15)text+=` • ${r.n-15} TOO MANY FOR THE 4-SUB LIMIT`;
    if(r.missingFixed.length)text+=` • unavailable fixed role${r.missingFixed.length===1?'':'s'}: ${r.missingFixed.join(', ')}`;
    if(r.unassigned.length)text+=` • unassigned: ${r.unassigned.map(p=>p.name).join(', ')}`;
    box.className=cls;box.textContent=text;
  }
  function renderPositions(){
    const box=document.getElementById('switchPositions');if(!box)return;const cfg=config(true);
    box.innerHTML=POSITIONS.map(pos=>{
      const pair=cfg.positions[pos],fixed=!!FIXED[pos];
      return `<div class="card switch-position ${fixed?'switch-fixed':''}"><div class="switch-position-head"><strong>${esc(pos)}</strong>${fixed?'<span class="pill">Permanent</span>':'<span class="pill">Primary + switch</span>'}</div>${fixed?`<div class="switch-fixed-name">${esc(display(pair.primary))}</div>`:`<div class="switch-selects"><label>Primary<select data-pos="${esc(pos)}" data-slot="primary">${optionList(pair.primary)}</select></label><label>Switch<select data-pos="${esc(pos)}" data-slot="switch">${optionList(pair.switch)}</select></label></div>`}<div class="muted switch-pattern">${esc(statusLineFor(pos))}</div></div>`;
    }).join('');
    box.querySelectorAll('select[data-slot]').forEach(sel=>sel.onchange=()=>setSlot(sel.dataset.pos,sel.dataset.slot,sel.value));
  }
  function renderQuick(){
    const box=document.getElementById('switchQuick');if(!box)return;const inning=liveInning(),line=state?.innings?.[inning]||buildInnings()[inning]||{};
    const posOptions='<option value="Rest">Rest</option>'+POSITIONS.map(pos=>`<option value="${esc(pos)}">${esc(pos)}${line[pos]?' — '+esc(display(line[pos])):''}</option>`).join('');
    box.innerHTML=`<div><div class="muted">QUICK CAPTAIN OVERRIDE</div><h3 style="margin:.2rem 0">Change inning ${inning} now</h3><div class="muted">Move any active player. If you move onto an occupied spot, the current player swaps into the moved player's old position when possible.</div></div><div class="switch-quick-grid"><label>Player<select id="switchQuickPlayer">${optionList('',true)}</select></label><label>Position<select id="switchQuickPosition">${posOptions}</select></label><button id="switchQuickApply" class="primary">Apply & Update live</button></div><button id="switchClearOverride" class="switch-clear">Clear inning ${inning} override</button>`;
    document.getElementById('switchQuickApply').onclick=quickMove;document.getElementById('switchClearOverride').onclick=clearLiveOverride;
  }
  function renderButtons(){
    const pub=document.getElementById('switchPublish'),auto=document.getElementById('switchAuto');if(pub){pub.disabled=saving;pub.textContent=saving?'Saving…':'Update live';}if(auto)auto.disabled=saving;
  }
  function setStatus(message,warn=false){const el=document.getElementById('switchStatus');if(!el)return;el.className=warn?'switch-status warn':'switch-status';el.textContent=message;}
  function ensureStyles(){
    if(document.getElementById('positionSwitchStyles'))return;const style=document.createElement('style');style.id='positionSwitchStyles';style.textContent=`
      #pods{gap:12px}.switch-hero{border:2px solid #86efac;background:#f7fff8}.switch-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.switch-actions button{flex:1 1 180px;font-weight:900}.switch-ok,.switch-warn{margin-top:10px;padding:10px;border-radius:12px;font-weight:800}.switch-ok{background:#ecfdf3;color:#166534;border:1px solid #86efac}.switch-warn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.switch-status{margin-top:9px;color:#166534;font-weight:800}.switch-status.warn{color:#991b1b}.switch-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.switch-position{padding:12px}.switch-position-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.switch-fixed{border:2px solid #bbf7d0;background:#f7fff8}.switch-fixed-name{font-size:1.2rem;font-weight:900;margin-top:10px}.switch-selects{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.switch-selects select,.switch-quick-grid select{width:100%;margin-top:5px;min-height:44px}.switch-pattern{margin-top:8px}.switch-quick{border:2px solid #93c5fd;background:#eff6ff}.switch-quick-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-top:10px}.switch-clear{margin-top:8px}.switch-explain{display:grid;gap:5px;margin-top:8px}.switch-explain strong{color:#166534}@media(max-width:700px){.switch-grid{grid-template-columns:1fr}.switch-quick-grid{grid-template-columns:1fr}.switch-quick-grid button{width:100%}}@media(max-width:430px){.switch-selects{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }
  function mount(){
    const section=document.getElementById('pods');if(!section||!state)return false;ensureStyles();const tab=document.querySelector('[data-tab="pods"]');if(tab)tab.textContent='Field Rotation';
    config(true);
    section.innerHTML=`<div class="card switch-hero"><div class="muted">POSITION SWITCH SYSTEM</div><h2 style="margin:.2rem 0">Field Rotation</h2><div class="muted">No pods. Set one primary and, when roster size allows, one switch for a field position. The pair alternates each inning your team returns to the field.</div><div id="switchRules"></div><div class="switch-explain"><div><strong>Permanent:</strong> Cam → Pitcher • Raff → Shortstop • CJ → Catcher</div><div><strong>League roster rule:</strong> minimum 6 players; up to 11 fielders; no more than 4 subs; subs can never outnumber fielders.</div></div><div class="switch-actions"><button id="switchAuto">Auto assign from RSVPs</button><button id="switchPublish" class="primary">Update live</button></div><div id="switchStatus" class="switch-status">${dirty?'Unsaved switch changes.':'Ready.'}</div></div><div id="switchQuick" class="card switch-quick"></div><div id="switchPositions" class="switch-grid"></div>`;
    document.getElementById('switchAuto').onclick=autoAssign;document.getElementById('switchPublish').onclick=publish;renderRules();renderQuick();renderPositions();renderButtons();return true;
  }
  function render(){if(!document.getElementById('pods'))return;mount();}
  function install(){
    if(installed)return;if(typeof state==='undefined'||!state||!document.getElementById('pods')){setTimeout(install,150);return;}installed=true;mount();
    window.addEventListener('buntpreferrednamesrefresh',()=>{if(!document.querySelector('#pods select:focus'))render();});
    window.addEventListener('buntgamedayeligibilitychange',()=>{dirty=true;render();setStatus('Attendance changed. Review the switch setup, then tap Update live.');});
    window.addEventListener('pageshow',render);
  }
  window.BuntPositionSwitches={autoAssign,publish,buildInnings,render};install();
})();
