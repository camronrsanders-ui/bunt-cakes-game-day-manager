(function(){
  const POSITIONS=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
  const POD_DEFS=[
    {id:'field-pod-pitcher',name:'Pitcher',positions:['Pitcher'],autoCap:3},
    {id:'field-pod-catcher-shortstop',name:'Catcher / Shortstop',positions:['Catcher','Shortstop'],autoCap:4},
    {id:'field-pod-first-right-center',name:'First Base / Right Center Field',positions:['First Base','Right Center Field'],autoCap:4},
    {id:'field-pod-right-left',name:'Right Field / Left Field',positions:['Right Field','Left Field'],autoCap:4},
    {id:'field-pod-third-left-center',name:'Third Base / Left Center Field',positions:['Third Base','Left Center Field'],autoCap:4},
    {id:'field-pod-second-center',name:'Second Base / Center Field',positions:['Second Base','Center Field'],autoCap:4}
  ];
  const POSITION_TO_POD=new Map(POD_DEFS.flatMap(p=>p.positions.map(pos=>[pos.toLowerCase(),p.id])));
  let podDraft=null,wrapped=false,refreshing=false,reconciling=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clone=v=>JSON.parse(JSON.stringify(v));
  const roster=()=>Array.isArray(state?.players)?state.players:[];
  const profile=()=>window.BuntFieldProfile||{};
  const prefs=p=>typeof profile().prefs==='function'?profile().prefs(p):(Array.isArray(p?.preferences)?p.preferences:[]);
  const podForPreference=position=>POSITION_TO_POD.get(String(position||'').trim().toLowerCase())||'';
  const preferencePods=p=>[...new Set(prefs(p).map(podForPreference).filter(Boolean))];
  const fixedPods=()=>Array.isArray(state?.pods)?POD_DEFS.map(def=>state.pods.find(p=>p&&p.id===def.id)).filter(Boolean):[];
  const configured=()=>fixedPods().length===POD_DEFS.length;
  const playerByName=name=>roster().find(p=>p&&p.name===name);
  const gameDay=()=>window.BuntGameDayEligibility||{};
  const gameDate=()=>{try{return typeof gameDay().targetDate==='function'?String(gameDay().targetDate()||''):'';}catch(_){return'';}};
  const isActive=player=>{
    if(!player?.name)return false;
    try{if(typeof gameDay().isActive==='function')return !!gameDay().isActive(player.name);}catch(_){}
    return player.present!==false;
  };
  const responseFor=player=>{const date=gameDate();return date&&state?.availability?.[date]?.[player?.name]||null;};
  const rsvpMillis=player=>{const answer=responseFor(player),stamp=answer&&answer.status==='yes'?Date.parse(answer.respondedAt||''):NaN;return Number.isFinite(stamp)?stamp:Number.MAX_SAFE_INTEGER;};
  const byRsvp=(a,b)=>rsvpMillis(a)-rsvpMillis(b)||(a.fullName||a.name).localeCompare(b.fullName||b.name);

  function blankPods(){return POD_DEFS.map(def=>({id:def.id,name:def.name,positions:[...def.positions],members:[],podType:'game-day-v2'}));}
  function metaRoot(create=false){
    const date=gameDate();if(!date||!state)return{};
    if(create){state.gameDayPodMeta=state.gameDayPodMeta||{};state.gameDayPodMeta[date]=state.gameDayPodMeta[date]||{};}
    return state.gameDayPodMeta?.[date]||{};
  }
  function setMeta(name,source,podId){
    const root=metaRoot(true);if(!name)return;if(!podId){delete root[name];return;}
    const player=playerByName(name),answer=responseFor(player);root[name]={source,podId,assignedAt:new Date().toISOString(),rsvpAt:answer&&answer.respondedAt||null};
  }
  function metaFor(name){return metaRoot(false)[name]||null;}
  function podDef(id){return POD_DEFS.find(p=>p.id===id)||null;}

  function normalizePods(){
    if(!configured())return;const valid=new Set(roster().map(p=>p&&p.name).filter(Boolean)),seen=new Set();
    POD_DEFS.forEach(def=>{const pod=state.pods.find(p=>p&&p.id===def.id);if(!pod)return;pod.name=def.name;pod.positions=[...def.positions];pod.podType='game-day-v2';pod.members=(Array.isArray(pod.members)?pod.members:[]).filter(name=>valid.has(name)&&!seen.has(name));pod.members.forEach(name=>seen.add(name));});
  }
  function assignmentFor(name){for(const pod of fixedPods())if((pod.members||[]).includes(name))return pod.id;return'';}
  function removeAssignment(name){fixedPods().forEach(p=>{p.members=(p.members||[]).filter(n=>n!==name);});}
  function activeCount(pod){return (pod.members||[]).map(playerByName).filter(isActive).length;}
  function autoRoom(pod){const def=podDef(pod.id);return !!def&&activeCount(pod)<def.autoCap;}
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  async function persistNow(successMessage){
    if(typeof queueSave!=='function')return false;queueSave();
    try{
      if(typeof window.buntCakesSaveNow==='function')await window.buntCakesSaveNow();
      const deadline=Date.now()+6500;while(typeof window.__buntCaptainLiveSyncBusy==='function'&&window.__buntCaptainLiveSyncBusy()&&Date.now()<deadline)await sleep(80);
      if(typeof window.__buntCaptainLiveSyncBusy==='function'&&window.__buntCaptainLiveSyncBusy())throw new Error('The live save is still retrying.');
      status(successMessage||'Saved live.');return true;
    }catch(error){status('Still syncing — keep this page open. '+(error&&error.message?error.message:'The change has not been confirmed yet.'),true);return false;}
  }

  function choosePreferredPod(player,pods){for(const id of preferencePods(player)){const pod=pods.find(p=>p.id===id);if(pod&&autoRoom(pod))return pod;}return null;}

  async function rebuildFromRsvps(){
    const date=gameDate();if(!date){alert('No upcoming game date is available.');return;}
    if(!confirm('Rebuild Game-Day Pods for this game from RSVP Yes players and their saved field preferences? Automatic assignments are capped at 3 pitchers and 4 players in every other pod. Existing manual pod placements for this game will be replaced.'))return;
    const pods=blankPods();state.pods=pods;state.gameDayPodMeta=state.gameDayPodMeta||{};state.gameDayPodMeta[date]={};
    const active=roster().filter(p=>p&&p.name&&isActive(p)).sort(byRsvp),unassigned=[];
    for(const player of active){const pod=choosePreferredPod(player,pods);if(pod){pod.members.push(player.name);setMeta(player.name,'auto-preference',pod.id);}else unassigned.push(player.fullName||player.name);}
    podDraft=null;renderAll();
    await persistNow(`${active.length-unassigned.length} active player${active.length-unassigned.length===1?'':'s'} placed by preference and RSVP order.${unassigned.length?` ${unassigned.length} still need a pod.`:''}`);
  }

  async function reconcileActivePreferences(save=true){
    if(reconciling||!configured())return 0;reconciling=true;
    try{
      normalizePods();const pods=fixedPods(),meta=metaRoot(true);let changed=0;
      for(const pod of pods){for(const name of [...(pod.members||[])]){const player=playerByName(name),m=meta[name];if(m&&String(m.source||'').startsWith('auto-')&&!isActive(player)){removeAssignment(name);delete meta[name];changed++;}}}
      for(const pod of pods){
        const def=podDef(pod.id);if(!def)continue;
        const manualActive=(pod.members||[]).map(playerByName).filter(p=>p&&isActive(p)&&!(meta[p.name]&&String(meta[p.name].source||'').startsWith('auto-')));
        const room=Math.max(0,def.autoCap-manualActive.length);
        const autos=(pod.members||[]).map(playerByName).filter(p=>p&&isActive(p)&&meta[p.name]&&String(meta[p.name].source||'').startsWith('auto-')).sort(byRsvp);
        autos.slice(room).forEach(player=>{removeAssignment(player.name);delete meta[player.name];changed++;});
      }
      const assigned=new Set(pods.flatMap(p=>p.members||[]));
      const blanks=roster().filter(p=>p&&p.name&&isActive(p)&&!assigned.has(p.name)).sort(byRsvp);
      for(const player of blanks){const pod=choosePreferredPod(player,pods);if(!pod)continue;pod.members.push(player.name);setMeta(player.name,'auto-preference',pod.id);changed++;}
      if(changed){podDraft=null;renderAll();if(save)await persistNow('RSVP pod assignments updated and saved live.');}
      return changed;
    }finally{reconciling=false;}
  }

  async function autoFillUnassigned(){
    if(!configured()){alert('Set up the Game-Day Pods first.');return;}normalizePods();await reconcileActivePreferences(false);
    const pods=fixedPods(),assigned=new Set(pods.flatMap(p=>p.members||[]));const blanks=roster().filter(p=>p&&p.name&&isActive(p)&&!assigned.has(p.name)).sort(byRsvp);let filled=0;
    for(const player of blanks){let target=choosePreferredPod(player,pods);if(!target)target=pods.filter(autoRoom).sort((a,b)=>activeCount(a)-activeCount(b)||POD_DEFS.findIndex(x=>x.id===a.id)-POD_DEFS.findIndex(x=>x.id===b.id))[0]||null;if(!target)continue;target.members.push(player.name);setMeta(player.name,'auto-fill',target.id);filled++;}
    podDraft=null;renderAll();
    if(filled)await persistNow(`${filled} active unassigned player${filled===1?'':'s'} filled without exceeding automatic pod caps.`);else status(blanks.length?'All automatic pod slots are full. A Captain can manually place the remaining active players.':'No active unassigned players to auto-fill.');
  }

  async function setAssignment(name,podId){
    if(!configured())return;normalizePods();removeAssignment(name);const target=fixedPods().find(p=>p.id===podId);if(target){target.members.push(name);setMeta(name,'manual',podId);}else setMeta(name,'','');podDraft=null;renderAll();
    await persistNow(target?`${playerByName(name)?.fullName||name} manually assigned to ${podDef(podId)?.name||'pod'} and saved live.`:`${playerByName(name)?.fullName||name} left unassigned and saved live.`);
  }

  function setPresence(name,present){
    const player=playerByName(name);if(!player)return;podDraft=null;
    if(typeof gameDay().setManualOverride==='function'){gameDay().setManualOverride(name,!!present);setTimeout(async()=>{if(present)await reconcileActivePreferences(true);renderAll();},120);return;}
    player.present=!!present;if(present)setTimeout(()=>reconcileActivePreferences(true),0);else persistNow('Attendance override saved live.');if(typeof renderRoster==='function')renderRoster();renderAll();
  }

  function homeNames(members,capacity,inning){if(!members.length||capacity<=0)return[];const start=(inning-1)%members.length,out=[];for(let i=0;i<members.length&&out.length<Math.min(capacity,members.length);i++)out.push(members[(start+i)%members.length].name);return out;}
  function chooseBorrower(target,podRosters,remainingSurplus,borrowedOut,borrowStats,inning){
    const candidates=[];POD_DEFS.forEach(def=>{if(def.id===target.id)return;const members=podRosters.get(def.id)||[],surplus=remainingSurplus.get(def.id)||0;if(surplus<=0)return;const home=new Set(homeNames(members,def.positions.length,inning));members.forEach((player,index)=>{if(!borrowedOut.has(player.name))candidates.push({player,donor:def,wouldRest:!home.has(player.name),surplus,borrowed:borrowStats.get(player.name)||0,index});});});
    candidates.sort((a,b)=>Number(b.wouldRest)-Number(a.wouldRest)||b.surplus-a.surplus||a.borrowed-b.borrowed||a.index-b.index||a.player.name.localeCompare(b.player.name));return candidates[0]||null;
  }

  function buildDraft(){
    if(!configured()){alert('Set up the Game-Day Pods first.');return;}normalizePods();const present=roster().filter(p=>p&&p.name&&isActive(p)),pods=fixedPods(),unassigned=present.filter(p=>!assignmentFor(p.name));
    if(unassigned.length){alert('Assign every active player to a pod first: '+unassigned.map(p=>p.fullName||p.name).join(', '));return;}if(!present.length){alert('No players are active for this game.');return;}
    const byName=new Map(roster().map(p=>[p.name,p])),borrowStats=new Map(),innings={},borrows=[];let gaps=0;
    for(let inning=1;inning<=7;inning++){
      const podRosters=new Map();POD_DEFS.forEach(def=>{const pod=pods.find(p=>p.id===def.id);podRosters.set(def.id,(pod.members||[]).map(n=>byName.get(n)).filter(isActive));});
      const remainingSurplus=new Map(POD_DEFS.map(def=>[def.id,Math.max(0,(podRosters.get(def.id)||[]).length-def.positions.length)])),borrowedOut=new Set(),borrowedIn=new Map(POD_DEFS.map(def=>[def.id,[]]));
      POD_DEFS.forEach(target=>{const own=podRosters.get(target.id)||[];if(target.positions.length!==2||own.length!==1)return;const pick=chooseBorrower(target,podRosters,remainingSurplus,borrowedOut,borrowStats,inning);if(!pick)return;borrowedOut.add(pick.player.name);borrowedIn.get(target.id).push(pick.player);remainingSurplus.set(pick.donor.id,Math.max(0,(remainingSurplus.get(pick.donor.id)||0)-1));borrowStats.set(pick.player.name,(borrowStats.get(pick.player.name)||0)+1);borrows.push({inning,player:pick.player.name,from:pick.donor.name,to:target.name});});
      const out={};POSITIONS.forEach(pos=>out[pos]='');const used=new Set();
      POD_DEFS.forEach(def=>{const own=(podRosters.get(def.id)||[]).filter(p=>!borrowedOut.has(p.name)),effective=[...own,...(borrowedIn.get(def.id)||[])];if(!effective.length)return;if(effective.length===1&&def.positions.length===2){const player=effective[0],pos=def.positions[(inning-1)%2];if(!used.has(player.name)){out[pos]=player.name;used.add(player.name);}return;}const start=(inning-1)%effective.length;def.positions.forEach((pos,slot)=>{for(let step=0;step<effective.length;step++){const player=effective[(start+slot+step)%effective.length];if(!used.has(player.name)){out[pos]=player.name;used.add(player.name);break;}}});});
      gaps+=POSITIONS.filter(pos=>!out[pos]).length;innings[inning]=out;
    }
    podDraft={innings,borrows,gaps,createdAt:new Date().toISOString()};renderAll();status('New seven-inning draft created from the active game-day roster. Nothing is published until you tap Publish rotation.');
  }

  async function publishDraft(){if(!podDraft)return;if(!confirm(`Publish this seven-inning pod rotation? Players will immediately see it.${podDraft.gaps?` It has ${podDraft.gaps} unfilled slot${podDraft.gaps===1?'':'s'} for a Captain to adjust manually.`:''}`))return;state.innings=clone(podDraft.innings);podDraft=null;if(typeof render==='function')render();setTimeout(renderAll,0);await persistNow('Rotation published and confirmed saved live.');}
  function discardDraft(){podDraft=null;renderAll();status('Draft deleted. No rotation changes were published.');}

  function status(message,warn=false){const root=document.getElementById('gameDayPodManager');if(!root)return;let el=document.getElementById('podControllerStatus');if(!el){el=document.createElement('div');el.id='podControllerStatus';root.prepend(el);}el.className='pod-status'+(warn?' warn':'');el.textContent=message;clearTimeout(el._timer);el._timer=setTimeout(()=>{if(el.isConnected)el.remove();},6500);}

  function ensureStyles(){
    if(document.getElementById('captainPodControllerStyles'))return;const style=document.createElement('style');style.id='captainPodControllerStyles';style.textContent=`
      .pod-manager{border:2px solid #86efac;background:#fbfffc}.pod-manager-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.pod-manager-actions{display:flex;gap:7px;flex-wrap:wrap}.pod-manager-actions button{width:auto}.pod-status{margin-top:9px;padding:9px 10px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0}.pod-status.warn{background:#fff7ed;border-color:#fed7aa;color:#9a3412}.pod-day-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}.pod-day-stat{background:#fff;border:1px solid var(--l);border-radius:12px;padding:8px}.pod-day-stat strong{display:block;font-size:1.15rem;color:#166534}.pod-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.pod-group{background:#fff;border:1px solid var(--l);border-radius:12px;padding:9px}.pod-member-line{font-size:.85rem;color:#4b5563;margin-top:4px}.pod-over{color:#b45309;font-weight:900}.pod-assignment-list{display:grid;gap:8px;margin-top:10px}.pod-player-row{display:grid;grid-template-columns:minmax(150px,.8fr) minmax(190px,1fr) minmax(220px,1.1fr);gap:8px;align-items:center;padding:9px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}.pod-player-row.absent{opacity:.55}.pod-player-name{font-weight:900}.pod-player-pref{font-size:.8rem;color:#6b7280;margin-top:2px}.pod-present-toggle{display:flex;align-items:center;gap:7px;font-size:.82rem;font-weight:800}.pod-present-toggle input{width:auto;margin:0}.pod-draft{margin-top:10px;border:1px solid #93c5fd;background:#eff6ff;border-radius:13px;padding:10px}.pod-draft-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.pod-draft details{background:#fff;border:1px solid #dbeafe;border-radius:10px;margin-top:6px;padding:7px 9px}.pod-draft summary{cursor:pointer;font-weight:800}.pod-inning-preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 9px;margin-top:6px;font-size:.82rem}.pod-gap{color:#b45309;font-weight:800}.pod-borrow{padding:6px 0;border-top:1px solid #bfdbfe}.pod-borrow:first-child{border-top:0}.rotation-actions,#rotationProfileProgress,#rotationSurveyWarning,#rotationProfiles,#rotationField .fit,#rotationEditor .fit-chip{display:none!important}@media(max-width:720px){.pod-player-row{grid-template-columns:1fr}.pod-groups{grid-template-columns:1fr}.pod-day-summary{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:420px){.pod-day-summary{grid-template-columns:1fr}.pod-inning-preview{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }
  function draftHtml(){if(!podDraft)return'';const created=new Date(podDraft.createdAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),borrow=podDraft.borrows.length?podDraft.borrows.map(x=>`<div class="pod-borrow"><strong>Inning ${x.inning}: ${esc(x.player)}</strong> — ${esc(x.from)} → ${esc(x.to)}</div>`).join(''):'<div class="muted">No borrowing is needed with the current attendance.</div>',innings=Array.from({length:7},(_,i)=>{const n=i+1,inn=podDraft.innings[n]||{};return `<details><summary>Inning ${n}</summary><div class="pod-inning-preview">${POSITIONS.map(pos=>`<div><strong>${esc(pos)}:</strong> <span class="${inn[pos]?'':'pod-gap'}">${esc(inn[pos]||'Unassigned')}</span></div>`).join('')}</div></details>`;}).join('');return `<div class="pod-draft"><strong>Private balanced rotation draft</strong><div class="muted">Created ${esc(created)} • active game-day players only • ${podDraft.borrows.length} borrow${podDraft.borrows.length===1?'':'s'} • ${podDraft.gaps} unfilled slot${podDraft.gaps===1?'':'s'}.</div><div style="margin-top:7px">${borrow}</div>${innings}<div class="pod-draft-actions"><button id="publishPodControllerDraft" class="primary" type="button">Publish rotation</button><button id="discardPodControllerDraft" type="button">Delete draft</button></div></div>`;}

  function renderManager(){
    if(typeof state==='undefined'||!state)return;const section=document.getElementById('pods'),field=document.getElementById('rotationField');if(!section||!field)return;ensureStyles();let card=document.getElementById('gameDayPodManager');if(!card){card=document.createElement('div');card.id='gameDayPodManager';card.className='card pod-manager';const hero=section.querySelector('.rotation-hero');if(hero&&hero.nextSibling)section.insertBefore(card,hero.nextSibling);else section.prepend(card);}
    if(!configured()){card.innerHTML=`<div class="pod-manager-head"><div><div class="muted">GAME-DAY POD SETUP</div><h3 style="margin:.2rem 0">Game-Day Pods</h3><div class="muted">RSVP Yes players are assigned by their saved field preferences in RSVP order. Automatic cap: 3 in Pitcher, 4 in every two-position pod.</div></div><button id="resetPodsFromPreferences" class="primary" type="button">Build pods from RSVPs + preferences</button></div>`;card.querySelector('#resetPodsFromPreferences').onclick=rebuildFromRsvps;return;}
    normalizePods();const players=roster().slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name)),present=players.filter(isActive),unassignedPresent=present.filter(p=>!assignmentFor(p.name));
    const groups=fixedPods().map((pod,index)=>{const def=POD_DEFS[index],members=(pod.members||[]).map(playerByName).filter(Boolean),here=members.filter(isActive),over=here.length>def.autoCap;return `<div class="pod-group"><strong>${esc(def.name)}</strong><div class="muted">${esc(def.positions.join(' + '))} • ${here.length}/${def.autoCap} active automatic cap${over?' • <span class="pod-over">Captain over cap</span>':''}</div><div class="pod-member-line">${members.length?members.map(p=>esc(p.fullName||p.name)).join(', '):'No players assigned'}</div></div>`;}).join('');
    const rows=players.map(player=>{const active=isActive(player),m=metaFor(player.name),source=m?.source==='manual'?' • Captain placed':'';return `<div class="pod-player-row ${active?'':'absent'}" data-player="${esc(player.name)}"><div><div class="pod-player-name">${esc(player.fullName||player.name)}</div><div class="pod-player-pref">${prefs(player).length?`Preferences: ${prefs(player).map(esc).join(' → ')}`:'No field preference'}${source}</div></div><label class="pod-present-toggle"><input class="pod-presence" type="checkbox" ${active?'checked':''}> Active this game</label><label>Pod<select class="pod-select"><option value="">Unassigned</option>${POD_DEFS.map(def=>`<option value="${def.id}" ${assignmentFor(player.name)===def.id?'selected':''}>${esc(def.name)}</option>`).join('')}</select></label></div>`;}).join('');
    card.innerHTML=`<div class="pod-manager-head"><div><div class="muted">GAME-DAY POD SETUP</div><h3 style="margin:.2rem 0">Game-Day Pods</h3><div class="muted">Preference matching is priority. Earlier Yes RSVPs keep automatic spots when a preferred pod reaches its cap. Captain manual placements are preserved and may exceed the cap.</div></div><div class="pod-manager-actions"><button id="resetPodsFromPreferences" type="button">Rebuild from RSVPs + preferences</button><button id="autoFillPods" type="button">Auto-fill active unassigned</button><button id="buildPodControllerDraft" class="primary" type="button">Build pod rotation draft</button></div></div><div class="pod-day-summary"><div class="pod-day-stat"><strong>${present.length}</strong><span class="muted">Active this game</span></div><div class="pod-day-stat"><strong>${present.length-unassignedPresent.length}</strong><span class="muted">Active assigned</span></div><div class="pod-day-stat"><strong>${unassignedPresent.length}</strong><span class="muted">Active need a pod</span></div></div><div class="pod-status ${unassignedPresent.length?'warn':''}">${unassignedPresent.length?`<strong>Captain assignment needed:</strong> ${unassignedPresent.map(p=>esc(p.fullName||p.name)).join(', ')}`:'Every active player has exactly one pod assignment.'}</div><div class="pod-groups">${groups}</div><details style="margin-top:10px" ${unassignedPresent.length?'open':''}><summary><strong>Edit player pod assignments & attendance</strong></summary><div class="pod-assignment-list">${rows}</div></details>${draftHtml()}`;
    card.querySelector('#resetPodsFromPreferences').onclick=rebuildFromRsvps;card.querySelector('#autoFillPods').onclick=autoFillUnassigned;card.querySelector('#buildPodControllerDraft').onclick=buildDraft;card.querySelectorAll('.pod-player-row').forEach(row=>{const name=row.dataset.player;row.querySelector('.pod-presence').onchange=e=>setPresence(name,e.target.checked);row.querySelector('.pod-select').onchange=e=>setAssignment(name,e.target.value);});card.querySelector('#publishPodControllerDraft')?.addEventListener('click',publishDraft);card.querySelector('#discardPodControllerDraft')?.addEventListener('click',discardDraft);
  }

  function cleanFieldUi(){const hero=document.querySelector('#pods .rotation-hero .rotation-title');if(hero){const notes=hero.querySelectorAll('.muted');if(notes[1])notes[1].textContent='Pods are chosen from RSVP attendance and field preferences; inning rotation then uses pod membership, attendance, even turn-taking, and Captain decisions.';}const editorNote=document.querySelector('#rotationEditor .rotation-note');if(editorNote)editorNote.textContent='Choose any active player. Captain edits save live immediately.';const box=document.getElementById('rotationRest');if(!box)return;const label=box.querySelector('.muted'),match=label&&label.textContent.match(/INNING\s+(\d+)/i),inning=match?Number(match[1]):Number(state?.gameInning||1);box.querySelectorAll('.rotation-person').forEach(row=>{const name=row.querySelector('strong')?.textContent?.trim(),detail=row.querySelector('span.muted');if(!name||!detail)return;if(inning>=7){detail.textContent='Final inning';return;}const next=state?.innings?.[inning+1]||state?.innings?.[String(inning+1)]||{},position=POSITIONS.find(pos=>next[pos]===name)||'Rest';detail.textContent=`Inning ${inning+1}: ${position==='Rest'?'Rest again':position}`;});}
  function renderAll(){if(refreshing)return;refreshing=true;try{renderManager();cleanFieldUi();}finally{refreshing=false;}}
  function confirmBaseFieldSave(){setTimeout(async()=>{try{if(typeof window.buntCakesSaveNow==='function')await window.buntCakesSaveNow();}catch(_){}},0);}
  function install(){
    if(typeof state==='undefined'||!state||!document.getElementById('rotationField')){setTimeout(install,150);return;}renderAll();
    if(!wrapped&&typeof window.render==='function'){const old=window.render;const next=function(...args){const result=old.apply(this,args);setTimeout(renderAll,0);return result;};next.__singlePodController=true;window.render=next;wrapped=true;}
    window.BuntPodController={reconcile:()=>reconcileActivePreferences(true),rebuild:rebuildFromRsvps,render:renderAll};
    window.addEventListener('buntpreferrednamesrefresh',()=>setTimeout(()=>{reconcileActivePreferences(true);renderAll();},80));
    document.addEventListener('click',event=>{if(event.target?.closest?.('#pods'))setTimeout(cleanFieldUi,0);const id=event.target?.closest?.('button')?.id;if(['manualMoveBtn','makeEditedLive','publishRotationDraft'].includes(id))confirmBaseFieldSave();});
    document.addEventListener('change',event=>{if(event.target?.closest?.('#pods'))setTimeout(cleanFieldUi,0);if(event.target?.id==='rotationPlayerSelect')confirmBaseFieldSave();});
    window.addEventListener('focus',()=>setTimeout(()=>{reconcileActivePreferences(true);renderAll();},80));setTimeout(()=>reconcileActivePreferences(true),250);
  }
  install();
})();