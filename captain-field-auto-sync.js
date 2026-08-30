(()=>{
  const POSITIONS=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
  const PODS=[
    {id:'field-pod-pitcher',name:'Pitcher',positions:['Pitcher'],cap:3},
    {id:'field-pod-catcher-shortstop',name:'Catcher / Shortstop',positions:['Catcher','Shortstop'],cap:4},
    {id:'field-pod-first-right-center',name:'First Base / Right Center Field',positions:['First Base','Right Center Field'],cap:4},
    {id:'field-pod-right-left',name:'Right Field / Left Field',positions:['Right Field','Left Field'],cap:4},
    {id:'field-pod-third-left-center',name:'Third Base / Left Center Field',positions:['Third Base','Left Center Field'],cap:4},
    {id:'field-pod-second-center',name:'Second Base / Center Field',positions:['Second Base','Center Field'],cap:4}
  ];
  const POS_TO_POD=new Map(PODS.flatMap(p=>p.positions.map(pos=>[pos.toLowerCase(),p.id])));
  let installed=false,syncing=false,timer=null,lastRelevant='',manualCapture=null,wrappedRender=false;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const roster=()=>Array.isArray(window.state?.players)?window.state.players:[];
  const profile=()=>window.BuntFieldProfile||{};
  const prefs=p=>typeof profile().prefs==='function'?profile().prefs(p):(Array.isArray(p?.preferences)?p.preferences:[]);
  const gameDay=()=>window.BuntGameDayEligibility||{};
  const gameDate=()=>{try{return typeof gameDay().targetDate==='function'?String(gameDay().targetDate()||''):'';}catch(_){return'';}};
  const active=p=>{if(!p?.name)return false;try{if(typeof gameDay().isActive==='function')return !!gameDay().isActive(p.name);}catch(_){}return p.present!==false;};
  const player=name=>roster().find(p=>p&&p.name===name);
  const fixedPods=()=>Array.isArray(window.state?.pods)?PODS.map(def=>window.state.pods.find(p=>p&&p.id===def.id)).filter(Boolean):[];
  const configured=()=>fixedPods().length===PODS.length;
  const responseFor=p=>{const d=gameDate();return d&&window.state?.availability?.[d]?.[p?.name]||null;};
  const rsvpTime=p=>{const a=responseFor(p),n=a&&a.status==='yes'?Date.parse(a.respondedAt||''):NaN;return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER;};
  const byRsvp=(a,b)=>rsvpTime(a)-rsvpTime(b)||(a.fullName||a.name).localeCompare(b.fullName||b.name);
  const prefPods=p=>[...new Set(prefs(p).map(x=>POS_TO_POD.get(String(x||'').toLowerCase())).filter(Boolean))];
  const assignment=name=>{for(const pod of fixedPods())if((pod.members||[]).includes(name))return pod.id;return'';};
  const activeCount=pod=>(pod.members||[]).map(player).filter(active).length;
  const room=pod=>{const def=PODS.find(x=>x.id===pod.id);return !!def&&activeCount(pod)<def.cap;};

  function metaRoot(create=false){
    const d=gameDate();if(!d||!window.state)return{};
    if(create){window.state.gameDayPodMeta=window.state.gameDayPodMeta||{};window.state.gameDayPodMeta[d]=window.state.gameDayPodMeta[d]||{};}
    return window.state.gameDayPodMeta?.[d]||{};
  }
  function markPod(name,podId,source='auto-fill'){
    const d=gameDate(),m=metaRoot(true),a=responseFor(player(name));
    if(!d||!name||!podId)return;
    m[name]={source,podId,assignedAt:new Date().toISOString(),rsvpAt:a?.respondedAt||null};
  }
  function overrides(create=false){
    const d=gameDate();if(!d||!window.state)return{positions:{},rests:{}};
    if(create){window.state.gameDayRotationOverrides=window.state.gameDayRotationOverrides||{};window.state.gameDayRotationOverrides[d]=window.state.gameDayRotationOverrides[d]||{positions:{},rests:{}};}
    const root=window.state.gameDayRotationOverrides?.[d]||{};root.positions=root.positions||{};root.rests=root.rests||{};return root;
  }
  function relevantSignature(){
    const d=gameDate();if(!d||!configured())return'';
    const activeNames=roster().filter(active).sort(byRsvp).map(p=>[p.name,rsvpTime(p),prefs(p)]);
    const pods=fixedPods().map(p=>[p.id,(p.members||[]).filter(n=>active(player(n)))]);
    return JSON.stringify([d,activeNames,pods,overrides(false)]);
  }

  function choosePod(p,pods){
    for(const id of prefPods(p)){const pod=pods.find(x=>x.id===id);if(pod&&room(pod))return pod;}
    return pods.filter(room).sort((a,b)=>activeCount(a)-activeCount(b)||PODS.findIndex(x=>x.id===a.id)-PODS.findIndex(x=>x.id===b.id))[0]||null;
  }
  function fillActiveUnassigned(){
    if(!configured())return 0;
    const pods=fixedPods(),assigned=new Set(pods.flatMap(p=>p.members||[]));let count=0;
    for(const p of roster().filter(p=>p&&p.name&&active(p)&&!assigned.has(p.name)).sort(byRsvp)){
      const pod=choosePod(p,pods);if(!pod)continue;pod.members=Array.isArray(pod.members)?pod.members:[];pod.members.push(p.name);assigned.add(p.name);markPod(p.name,pod.id,prefPods(p).includes(pod.id)?'auto-preference':'auto-fill');count++;
    }
    return count;
  }

  function preferenceRank(p,pos){
    const list=prefs(p),i=list.indexOf(pos);if(i>=0)return i;
    if(p?.flexible===true||p?.flexibleAnywhere===true||p?.preferenceMode==='flexible')return 20;
    if(p?.willingElsewhere===true||p?.flexibleElsewhere===true)return 30;
    return 50;
  }

  function generate(){
    const activePlayers=roster().filter(p=>p&&p.name&&active(p)).sort(byRsvp),podMap=new Map(),ov=overrides(false);
    PODS.forEach(def=>{const pod=fixedPods().find(x=>x.id===def.id);podMap.set(def.id,(pod?.members||[]).map(player).filter(active));});
    const stats=new Map(activePlayers.map(p=>[p.name,{played:0,last:0,byPos:{}}])),innings={},resting={},fills=[];
    for(let inning=1;inning<=7;inning++){
      const out={};POSITIONS.forEach(pos=>out[pos]='');const used=new Set(),restMap=ov.rests?.[inning]||ov.rests?.[String(inning)]||{},forcedRest=new Set(Object.keys(restMap).filter(n=>restMap[n]));
      const forced=ov.positions?.[inning]||ov.positions?.[String(inning)]||{};
      for(const pos of POSITIONS){const name=String(forced[pos]||'');const p=player(name);if(name&&p&&active(p)&&!forcedRest.has(name)&&!used.has(name)){out[pos]=name;used.add(name);}}
      for(const def of PODS){
        const members=podMap.get(def.id)||[];
        for(const pos of def.positions){
          if(out[pos])continue;
          const candidates=members.filter(p=>!used.has(p.name)&&!forcedRest.has(p.name)).sort((a,b)=>{
            const sa=stats.get(a.name),sb=stats.get(b.name);
            return sa.played-sb.played||Number(sa.last===inning-1)-Number(sb.last===inning-1)||(sa.byPos[pos]||0)-(sb.byPos[pos]||0)||preferenceRank(a,pos)-preferenceRank(b,pos)||rsvpTime(a)-rsvpTime(b)||a.name.localeCompare(b.name);
          });
          if(candidates[0]){out[pos]=candidates[0].name;used.add(candidates[0].name);}
        }
      }
      for(const pos of POSITIONS){
        if(out[pos])continue;
        const candidates=activePlayers.filter(p=>!used.has(p.name)&&!forcedRest.has(p.name)).sort((a,b)=>{
          const sa=stats.get(a.name),sb=stats.get(b.name),ap=assignment(a.name)===POS_TO_POD.get(pos.toLowerCase()),bp=assignment(b.name)===POS_TO_POD.get(pos.toLowerCase());
          return Number(bp)-Number(ap)||sa.played-sb.played||preferenceRank(a,pos)-preferenceRank(b,pos)||Number(sa.last===inning-1)-Number(sb.last===inning-1)||(sa.byPos[pos]||0)-(sb.byPos[pos]||0)||rsvpTime(a)-rsvpTime(b)||a.name.localeCompare(b.name);
        });
        if(candidates[0]){out[pos]=candidates[0].name;used.add(candidates[0].name);fills.push({inning,pos,player:candidates[0].name});}
      }
      for(const name of used){const s=stats.get(name);if(!s)continue;s.played++;s.last=inning;const pos=POSITIONS.find(x=>out[x]===name);if(pos)s.byPos[pos]=(s.byPos[pos]||0)+1;}
      innings[inning]=out;resting[inning]=activePlayers.filter(p=>!used.has(p.name)).map(p=>p.name);
    }
    const gaps=Object.values(innings).reduce((n,inn)=>n+POSITIONS.filter(pos=>!inn[pos]).length,0);
    return{innings,resting,fills,gaps,activeCount:activePlayers.length};
  }

  async function saveStatus(message){
    if(typeof queueSave==='function')queueSave();
    try{if(typeof window.buntCakesSaveNow==='function')await window.buntCakesSaveNow();}
    catch(e){showStatus('Rotation is still syncing: '+(e?.message||'save pending'),true);return false;}
    showStatus(message||'Rotation synced and saved live.');return true;
  }
  function showStatus(message,warn=false){
    const root=document.getElementById('gameDayPodManager');if(!root)return;let el=document.getElementById('fieldAutoSyncStatus');if(!el){el=document.createElement('div');el.id='fieldAutoSyncStatus';root.prepend(el);}el.style.cssText='margin-top:9px;padding:9px 10px;border-radius:12px;border:1px solid '+(warn?'#fed7aa':'#86efac')+';background:'+(warn?'#fff7ed':'#f0fdf4')+';color:'+(warn?'#9a3412':'#166534');el.textContent=message;clearTimeout(el._t);el._t=setTimeout(()=>el?.remove(),6500);
  }
  function storeSummary(result){
    const d=gameDate();if(!d)return;window.state.gameDayRotationSummary=window.state.gameDayRotationSummary||{};window.state.gameDayRotationSummary[d]={updatedAt:new Date().toISOString(),rests:result.resting,gaps:result.gaps,fillIns:result.fills};
  }
  function hasCurrentGaps(){
    for(let i=1;i<=7;i++){const inn=window.state?.innings?.[i]||window.state?.innings?.[String(i)]||{};if(POSITIONS.some(pos=>!inn[pos]))return true;}return false;
  }

  async function syncRotation(reason='Game-day rotation updated',force=false){
    if(syncing||!window.state||!configured())return false;
    const sigBefore=relevantSignature();if(!force&&sigBefore&&sigBefore===lastRelevant)return false;
    syncing=true;
    try{
      if(typeof window.BuntPodController?.reconcile==='function')await window.BuntPodController.reconcile();
      const filled=fillActiveUnassigned(),sig=relevantSignature();
      const result=generate(),next=JSON.stringify(result.innings),current=JSON.stringify(window.state.innings||{});
      lastRelevant=sig;
      if(next===current&&!filled){renderSummary(result);return false;}
      window.state.innings=clone(result.innings);storeSummary(result);
      if(typeof window.render==='function')window.render();
      if(typeof window.renderLineup==='function')window.renderLineup();
      renderSummary(result);
      const fillText=filled?` ${filled} active unassigned player${filled===1?' was':'s were'} placed into open pod space.`:'';
      const gapText=result.gaps?` ${result.gaps} field slot${result.gaps===1?' is':'s are'} still open because there are not enough eligible active players.`:' Every field position is covered whenever enough active players are available.';
      await saveStatus(`${reason}.${fillText}${gapText}`);
      return true;
    }finally{syncing=false;}
  }
  function schedule(reason,force=false,delay=220){clearTimeout(timer);timer=setTimeout(()=>syncRotation(reason,force),delay);}

  function currentEditInning(){const text=document.getElementById('rotationEditLabel')?.textContent||'';const m=text.match(/inning\s+(\d+)/i);return Math.max(1,Math.min(7,Number(m?.[1]||window.state?.gameInning||1)));}
  function recordManualMove(capture){
    if(!capture||!window.state||!gameDate())return;const inn=window.state.innings?.[capture.inning]||window.state.innings?.[String(capture.inning)]||{};const actual=POSITIONS.find(pos=>inn[pos]===capture.player)||'';if(capture.position?actual!==capture.position:!!actual)return;const ov=overrides(true),key=String(capture.inning);ov.positions[key]=ov.positions[key]||{};ov.rests[key]=ov.rests[key]||{};
    if(capture.position){
      Object.keys(ov.positions[key]).forEach(pos=>{if(ov.positions[key][pos]===capture.player&&pos!==capture.position)delete ov.positions[key][pos];});
      delete ov.rests[key][capture.player];ov.positions[key][capture.position]=capture.player;
    }else{
      Object.keys(ov.positions[key]).forEach(pos=>{if(ov.positions[key][pos]===capture.player)delete ov.positions[key][pos];});ov.rests[key][capture.player]=true;
    }
    lastRelevant=relevantSignature();
    if(typeof queueSave==='function')queueSave();
    renderSummary(generate());
  }
  function recordPositionEdit(capture){
    if(!capture||!window.state||!gameDate())return;const inn=window.state.innings?.[capture.inning]||window.state.innings?.[String(capture.inning)]||{};if(capture.player&&inn[capture.position]!==capture.player)return;if(!capture.player&&inn[capture.position])return;const ov=overrides(true),key=String(capture.inning);ov.positions[key]=ov.positions[key]||{};ov.rests[key]=ov.rests[key]||{};
    if(capture.player){
      Object.keys(ov.positions[key]).forEach(pos=>{if(ov.positions[key][pos]===capture.player&&pos!==capture.position)delete ov.positions[key][pos];});delete ov.rests[key][capture.player];ov.positions[key][capture.position]=capture.player;
    }else delete ov.positions[key][capture.position];
    lastRelevant=relevantSignature();if(typeof queueSave==='function')queueSave();renderSummary(generate());
  }

  function renderSummary(result=generate()){
    const section=document.getElementById('pods'),manager=document.getElementById('gameDayPodManager');if(!section||!manager||!configured())return;
    let card=document.getElementById('fieldAutoSyncSummary');if(!card){card=document.createElement('div');card.id='fieldAutoSyncSummary';card.className='card';manager.insertAdjacentElement('afterend',card);}
    const activePlayers=roster().filter(active),assigned=activePlayers.filter(p=>assignment(p.name)),unassigned=activePlayers.filter(p=>!assignment(p.name));
    const innings=Array.from({length:7},(_,i)=>{const n=i+1,inn=result.innings[n]||{},fielding=POSITIONS.map(pos=>inn[pos]?`${pos}: ${player(inn[pos])?.fullName||inn[pos]}`:`${pos}: OPEN`),rests=(result.resting[n]||[]).map(name=>player(name)?.fullName||name);return `<details ${n===Number(window.state?.gameInning||1)?'open':''}><summary><strong>Inning ${n}</strong> • ${POSITIONS.filter(pos=>inn[pos]).length}/11 fielding • ${rests.length} resting</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:5px 10px;margin-top:8px;font-size:.84rem">${fielding.map(x=>`<div>${esc(x)}</div>`).join('')}</div><div style="margin-top:7px"><strong>Resting:</strong> ${rests.length?rests.map(esc).join(', '):'Nobody'}</div></details>`;}).join('');
    card.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><div class="muted">AUTOMATIC GAME-DAY ROTATION</div><h3 style="margin:.2rem 0">Pods → 7 innings stay in sync</h3><div class="muted">Active players fill preferred/open pod space automatically. Empty field spots use the best eligible resting player. Captain inning changes remain manual overrides.</div></div><span class="pill">Auto-sync ON</span></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:9px 0"><div class="pod-day-stat"><strong>${activePlayers.length}</strong><span class="muted">Active</span></div><div class="pod-day-stat"><strong>${assigned.length}</strong><span class="muted">In pods</span></div><div class="pod-day-stat"><strong>${unassigned.length}</strong><span class="muted">Need pod</span></div></div>${unassigned.length?`<div class="pod-status warn"><strong>Still unassigned:</strong> ${unassigned.map(p=>esc(p.fullName||p.name)).join(', ')}</div>`:''}<div class="pod-status ${result.gaps?'warn':''}"><strong>${result.gaps?`${result.gaps} open field slot${result.gaps===1?'':'s'} remain`:'All available field spots are covered'}</strong>${result.fills.length?` • ${result.fills.length} smart fill-in assignment${result.fills.length===1?'':'s'} across 7 innings`:''}</div><div style="display:grid;gap:7px;margin-top:9px">${innings}</div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px"><button id="syncFieldRotationNow" class="primary" type="button">Rebalance & sync now</button><button id="clearFieldRotationOverrides" type="button">Clear manual inning overrides</button></div>`;
    card.querySelector('#syncFieldRotationNow').onclick=()=>schedule('Rotation rebalanced and synced',true,0);
    card.querySelector('#clearFieldRotationOverrides').onclick=()=>{if(!confirm('Clear Captain manual inning overrides for this game and return to the automatic balanced rotation?'))return;const d=gameDate();if(window.state.gameDayRotationOverrides?.[d])delete window.state.gameDayRotationOverrides[d];schedule('Manual inning overrides cleared; automatic rotation restored',true,0);};
  }

  function installCapture(){
    document.addEventListener('click',e=>{
      const btn=e.target?.closest?.('#manualMoveBtn');if(btn){manualCapture={type:'move',player:document.getElementById('manualPlayerSelect')?.value||'',position:document.getElementById('manualPositionSelect')?.value||'',inning:currentEditInning()};setTimeout(()=>{recordManualMove(manualCapture);manualCapture=null;},0);return;}
      if(e.target?.closest?.('#autoFillPods,#resetPodsFromPreferences'))schedule('Pods changed; seven-inning rotation synced',false,750);
    },true);
    document.addEventListener('change',e=>{
      if(e.target?.matches?.('#rotationPlayerSelect')){const pos=document.querySelector('#rotationEditor h3')?.textContent?.trim()||'',capture={position:pos,player:e.target.value||'',inning:currentEditInning()};setTimeout(()=>recordPositionEdit(capture),0);return;}
      if(e.target?.matches?.('#gameDayPodManager .pod-select,#gameDayPodManager .pod-presence'))schedule('Game-day player assignment changed; rotation synced',false,650);
    },true);
  }
  function install(){
    if(installed)return;
    if(!window.state||!window.BuntPodController||!document.getElementById('rotationField')){setTimeout(install,150);return;}
    installed=true;window.__buntFieldAutoSyncInstalled=true;installCapture();
    window.addEventListener('buntgamedayeligibilitychange',()=>schedule('RSVP or attendance changed; rotation synced',false,650));
    window.addEventListener('buntpreferrednamesrefresh',()=>schedule('Player availability changed; rotation synced',false,650));
    if(!wrappedRender&&typeof window.render==='function'){const old=window.render;window.render=function(...args){const result=old.apply(this,args);setTimeout(()=>{try{renderSummary();}catch(_){}},0);return result;};wrappedRender=true;}
    setTimeout(()=>{lastRelevant=relevantSignature();const result=generate();renderSummary(result);const activeUnassigned=roster().filter(p=>active(p)&&!assignment(p.name)).length;if(activeUnassigned||hasCurrentGaps())schedule('Open pod/field spots repaired automatically',true,250);},400);
    window.BuntFieldAutoSync={sync:()=>syncRotation('Rotation rebalanced and synced',true),render:renderSummary};
  }
  install();
})();
