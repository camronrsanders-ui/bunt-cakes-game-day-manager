(function(){
  const POSITIONS=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
  const POD_DEFS=[
    {id:'field-pod-pitcher',name:'Pitcher',positions:['Pitcher']},
    {id:'field-pod-catcher-shortstop',name:'Catcher / Shortstop',positions:['Catcher','Shortstop']},
    {id:'field-pod-first-right-center',name:'First Base / Right Center Field',positions:['First Base','Right Center Field']},
    {id:'field-pod-right-left',name:'Right Field / Left Field',positions:['Right Field','Left Field']},
    {id:'field-pod-third-left-center',name:'Third Base / Left Center Field',positions:['Third Base','Left Center Field']},
    {id:'field-pod-second-center',name:'Second Base / Center Field',positions:['Second Base','Center Field']}
  ];
  const POSITION_TO_POD=new Map(POD_DEFS.flatMap(p=>p.positions.map(pos=>[pos.toLowerCase(),p.id])));
  let mounted=false,podDraft=null,wrapped=false,podSaveNotice='',podSaveWarning=false,podSaveBusy=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clone=v=>JSON.parse(JSON.stringify(v));
  const roster=()=>Array.isArray(state?.players)?state.players:[];
  const profile=()=>window.BuntFieldProfile||{};
  const prefs=p=>typeof profile().prefs==='function'?profile().prefs(p):(Array.isArray(p?.preferences)?p.preferences:[]);
  const flexible=p=>typeof profile().flexible==='function'?profile().flexible(p):!!(p?.flexible||p?.flexibleAnywhere||p?.preferenceMode==='flexible');
  const willing=p=>typeof profile().willing==='function'?profile().willing(p):!!(p?.willingElsewhere||p?.flexibleElsewhere);
  const source=p=>typeof profile().source==='function'?profile().source(p):(p?.fieldPreferenceSource||'none');
  const firstPref=p=>String(prefs(p)[0]||'').trim();
  const podForPreference=position=>POSITION_TO_POD.get(String(position||'').trim().toLowerCase())||'';
  const livePods=()=>Array.isArray(state?.pods)?state.pods:[];
  const configured=()=>POD_DEFS.every(d=>livePods().some(p=>p&&p.id===d.id));
  const preferredPods=()=>configured()?POD_DEFS.map(d=>livePods().find(p=>p.id===d.id)):[];
  const playerByName=name=>roster().find(p=>p.name===name);

  function ensureStyles(){
    if(document.getElementById('captainPodRotationStyles'))return;
    const style=document.createElement('style');style.id='captainPodRotationStyles';style.textContent=`
      .pod-manager{border:2px solid #86efac;background:#fbfffc}.pod-manager-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.pod-manager-actions{display:flex;gap:7px;flex-wrap:wrap}.pod-manager-actions button{width:auto}.pod-status{margin-top:9px;padding:9px 10px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0}.pod-status.warn{background:#fff7ed;border-color:#fed7aa;color:#9a3412}.pod-day-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}.pod-day-stat{background:#fff;border:1px solid var(--l);border-radius:12px;padding:8px}.pod-day-stat strong{display:block;font-size:1.15rem;color:#166534}.pod-assignment-list{display:grid;gap:8px;margin-top:10px}.pod-player-row{display:grid;grid-template-columns:minmax(150px,.8fr) minmax(190px,1fr) minmax(220px,1.1fr);gap:8px;align-items:center;padding:9px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}.pod-player-row.absent{opacity:.65}.pod-player-name{font-weight:900}.pod-player-pref{font-size:.8rem;color:#6b7280;margin-top:2px}.pod-present-toggle{display:flex;align-items:center;gap:7px;font-size:.82rem;font-weight:800}.pod-present-toggle input{width:auto;margin:0}.pod-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.pod-group{background:#fff;border:1px solid var(--l);border-radius:12px;padding:9px}.pod-group strong{display:block}.pod-member-line{font-size:.85rem;color:#4b5563;margin-top:4px}.pod-draft{margin-top:10px;border:1px solid #93c5fd;background:#eff6ff;border-radius:13px;padding:10px}.pod-draft-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.pod-borrow{padding:6px 0;border-top:1px solid #bfdbfe}.pod-borrow:first-child{border-top:0}.pod-draft details{background:#fff;border:1px solid #dbeafe;border-radius:10px;margin-top:6px;padding:7px 9px}.pod-draft summary{cursor:pointer;font-weight:800}.pod-inning-preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 9px;margin-top:6px;font-size:.82rem}.pod-gap{color:#b45309;font-weight:800}@media(max-width:720px){.pod-player-row{grid-template-columns:1fr}.pod-groups{grid-template-columns:1fr}.pod-day-summary{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:420px){.pod-day-summary{grid-template-columns:1fr}.pod-inning-preview{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }

  function assignmentFor(name){
    for(const pod of preferredPods())if((pod.members||[]).includes(name))return pod.id;
    return'';
  }

  function sanitizePreferredPods(){
    if(!configured())return;
    const validNames=new Set(roster().map(p=>p.name)),seen=new Set();
    preferredPods().forEach((pod,index)=>{
      const def=POD_DEFS[index];
      pod.name=def.name;pod.positions=[...def.positions];
      pod.members=(Array.isArray(pod.members)?pod.members:[]).filter(name=>validNames.has(name)&&!seen.has(name));
      pod.members.forEach(name=>seen.add(name));
    });
  }

  function showPodNotice(message,warning=false){
    podSaveNotice=message||'';podSaveWarning=!!warning;
    renderPodManager();
  }

  async function persistPodsNow(successMessage){
    if(podSaveBusy)return false;
    const desired=clone(livePods());
    podSaveBusy=true;podSaveNotice='Saving pod assignments…';podSaveWarning=false;renderPodManager();
    let lastError=null;
    try{
      for(let attempt=0;attempt<8;attempt++){
        const latest=await api('/api/team-state?fresh='+Date.now());
        const merged=clone(latest.state||{});merged.pods=desired;
        const response=await fetch('/api/team-state',{
          method:'PUT',credentials:'include',cache:'no-store',
          headers:{'Content-Type':'application/json','Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'},
          body:JSON.stringify({state:merged,expectedUpdatedAt:String(latest.updatedAt||'')})
        });
        const result=await response.json().catch(()=>({}));
        if(response.status===409){lastError=new Error(result.error||'Team state changed while saving pods');continue;}
        if(!response.ok)throw new Error(result.error||`Pod save failed (${response.status})`);
        podSaveBusy=false;podSaveNotice=successMessage||'Pod assignments saved live.';podSaveWarning=false;
        const status=document.getElementById('saveStatus');
        if(status)status.innerHTML='<span class="ok">Saved live</span> • pod assignments updated';
        renderPodManager();
        return true;
      }
      throw lastError||new Error('Could not save pod assignments after several retries');
    }catch(error){
      podSaveBusy=false;podSaveNotice='Pod changes are still on this screen but could not be saved yet: '+(error.message||'save failed');podSaveWarning=true;renderPodManager();
      return false;
    }
  }

  async function applyDefaultPods(){
    const existing=clone(livePods());
    const message=existing.length&&!configured()
      ?'Replace the current pod setup with the six fixed Game-Day pods? Players will keep their field preferences; first preferences will be used for the initial assignments. Players without a matching first preference will stay unassigned for a Captain to place manually.'
      :'Set up the six fixed Game-Day pods and auto-assign players from their first field preference?';
    if(!confirm(message))return;
    const pods=POD_DEFS.map(d=>({id:d.id,name:d.name,positions:[...d.positions],members:[],podType:'game-day-v1'}));
    let assigned=0;
    roster().forEach(player=>{
      const id=podForPreference(firstPref(player));
      const pod=pods.find(x=>x.id===id);if(pod){pod.members.push(player.name);assigned++;}
    });
    state.pods=pods;podDraft=null;renderPodManager();
    const saved=await persistPodsNow(`6-pod setup saved. ${assigned} player${assigned===1?'':'s'} auto-assigned from first preferences.`);
    if(!saved){state.pods=existing;renderPodManager();}
  }

  async function autoAssignUnassigned(){
    if(!configured())return applyDefaultPods();
    sanitizePreferredPods();let changed=0;
    roster().forEach(player=>{
      if(assignmentFor(player.name))return;
      const id=podForPreference(firstPref(player)),pod=preferredPods().find(x=>x.id===id);
      if(pod){pod.members.push(player.name);changed++;}
    });
    podDraft=null;
    if(!changed){
      const manual=roster().filter(p=>!assignmentFor(p.name)&&!podForPreference(firstPref(p))).map(p=>p.fullName||p.name);
      showPodNotice(manual.length?`No additional players can be auto-assigned. ${manual.length} player${manual.length===1?'':'s'} have no matching first preference and need a Captain assignment.`:'Everyone with a matching first preference is already assigned.');
      return;
    }
    renderPodManager();
    await persistPodsNow(`${changed} player${changed===1?'':'s'} auto-assigned and saved live.`);
  }

  async function setAssignment(name,id){
    if(!configured())return;
    preferredPods().forEach(p=>{p.members=(p.members||[]).filter(x=>x!==name)});
    const target=preferredPods().find(p=>p.id===id);if(target)target.members.push(name);
    podDraft=null;renderPodManager();
    await persistPodsNow(id?`${name} pod assignment saved live.`:`${name} left for manual assignment.`);
  }

  function setPresence(name,present){
    const player=playerByName(name);if(!player)return;player.present=!!present;podDraft=null;queueSave();
    if(typeof renderRoster==='function')renderRoster();
    renderPodManager();
  }

  function donorScore(player,targetDef,borrowStats,donorSurplus){
    const list=prefs(player),targetIndex=Math.min(...targetDef.positions.map(pos=>{const i=list.indexOf(pos);return i<0?99:i;}));
    return (flexible(player)?10000:0)+(willing(player)?3000:0)+(targetIndex<99?(1800-targetIndex*120):0)+(donorSurplus*250)-((borrowStats.get(player.name)||0)*500);
  }

  function chooseBorrower(targetDef,podRosters,remainingSurplus,borrowedOut,borrowStats){
    const candidates=[];
    preferredPods().forEach(donor=>{
      const surplus=remainingSurplus.get(donor.id)||0;if(surplus<=0||donor.id===targetDef.id)return;
      (podRosters.get(donor.id)||[]).forEach(player=>{
        if(borrowedOut.has(player.name))return;
        candidates.push({player,donor,score:donorScore(player,targetDef,borrowStats,surplus)});
      });
    });
    candidates.sort((a,b)=>b.score-a.score||a.player.name.localeCompare(b.player.name));
    return candidates[0]||null;
  }

  function buildPodDraft(){
    if(!configured()){
      alert('Set up the six Game-Day pods first.');return;
    }
    sanitizePreferredPods();
    const present=roster().filter(p=>p.present!==false),unassigned=present.filter(p=>!assignmentFor(p.name));
    if(unassigned.length){
      alert(`Assign every present player to one pod before building. Still unassigned: ${unassigned.map(p=>p.name).join(', ')}`);return;
    }
    if(!present.length){alert('No players are marked present.');return;}
    const borrowStats=new Map(),innings={},borrows=[];let gaps=0;
    for(let inning=1;inning<=7;inning++){
      const podRosters=new Map();
      preferredPods().forEach(pod=>podRosters.set(pod.id,(pod.members||[]).map(playerByName).filter(p=>p&&p.present!==false)));
      const remainingSurplus=new Map();
      preferredPods().forEach(pod=>remainingSurplus.set(pod.id,Math.max(0,(podRosters.get(pod.id)||[]).length-pod.positions.length)));
      const borrowedOut=new Set(),borrowedIn=new Map();
      preferredPods().forEach(pod=>borrowedIn.set(pod.id,[]));

      preferredPods().forEach(target=>{
        const own=podRosters.get(target.id)||[];
        if(target.positions.length!==2||own.length!==1)return;
        const pick=chooseBorrower(target,podRosters,remainingSurplus,borrowedOut,borrowStats);
        if(!pick)return;
        borrowedOut.add(pick.player.name);
        borrowedIn.get(target.id).push(pick.player);
        remainingSurplus.set(pick.donor.id,(remainingSurplus.get(pick.donor.id)||0)-1);
        borrowStats.set(pick.player.name,(borrowStats.get(pick.player.name)||0)+1);
        borrows.push({inning,player:pick.player.name,from:pick.donor.name,to:target.name,flexible:flexible(pick.player)});
      });

      const out={};POSITIONS.forEach(pos=>out[pos]='');const used=new Set();
      preferredPods().forEach(pod=>{
        const own=(podRosters.get(pod.id)||[]).filter(p=>!borrowedOut.has(p.name));
        const effective=[...own,...(borrowedIn.get(pod.id)||[])];
        if(!effective.length)return;
        if(effective.length===1&&pod.positions.length===2){
          const only=effective[0],preferred=pod.positions.find(pos=>prefs(only).includes(pos))||pod.positions[(inning-1)%pod.positions.length];
          if(!used.has(only.name)){out[preferred]=only.name;used.add(only.name);}
          return;
        }
        const start=(inning-1)%effective.length;
        pod.positions.forEach((pos,slot)=>{
          for(let step=0;step<effective.length;step++){
            const player=effective[(start+slot+step)%effective.length];
            if(!used.has(player.name)){out[pos]=player.name;used.add(player.name);break;}
          }
        });
      });
      gaps+=POSITIONS.filter(pos=>!out[pos]).length;innings[inning]=out;
    }
    podDraft={innings,borrows,gaps,createdAt:new Date().toISOString()};renderPodManager();
  }

  function publishPodDraft(){
    if(!podDraft)return;
    if(!confirm(`Publish this seven-inning pod rotation now? Players will immediately see the new assignments.${podDraft.gaps?` It has ${podDraft.gaps} unfilled position slot${podDraft.gaps===1?'':'s'} that you can edit manually.`:''}`))return;
    state.innings=clone(podDraft.innings);podDraft=null;queueSave();
    if(typeof render==='function')render();else renderPodManager();
  }

  function draftHtml(){
    if(!podDraft)return'';
    const borrowRows=podDraft.borrows.length?podDraft.borrows.map(x=>`<div class="pod-borrow"><strong>Inning ${x.inning}: ${esc(x.player)}</strong> — ${esc(x.from)} → ${esc(x.to)}${x.flexible?' • flexible':''}</div>`).join(''):'<div class="muted">No borrowing is needed with the current attendance.</div>';
    const inningRows=Array.from({length:7},(_,i)=>{const n=i+1,inn=podDraft.innings[n]||{};return `<details><summary>Inning ${n}</summary><div class="pod-inning-preview">${POSITIONS.map(pos=>`<div><strong>${esc(pos)}:</strong> <span class="${inn[pos]?'':'pod-gap'}">${esc(inn[pos]||'Unassigned')}</span></div>`).join('')}</div></details>`;}).join('');
    return `<div class="pod-draft"><strong>Private pod rotation draft</strong><div class="muted">${podDraft.borrows.length} borrow suggestion${podDraft.borrows.length===1?'':'s'} • ${podDraft.gaps} unfilled slot${podDraft.gaps===1?'':'s'}. Players cannot see this until you publish.</div><div style="margin-top:7px">${borrowRows}</div>${inningRows}<div class="pod-draft-actions"><button id="publishPodRotation" class="primary" type="button">Publish pod rotation</button><button id="discardPodRotation" type="button">Discard draft</button></div></div>`;
  }

  function renderConfigured(card){
    sanitizePreferredPods();
    const players=roster().slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));
    const assigned=players.filter(p=>assignmentFor(p.name)).length,present=players.filter(p=>p.present!==false),unassignedPresent=present.filter(p=>!assignmentFor(p.name));
    const optionsFor=player=>`<option value="">Captain assigns manually</option>${POD_DEFS.map(d=>`<option value="${d.id}" ${assignmentFor(player.name)===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}`;
    const rows=players.map(player=>{const pref=firstPref(player),src=source(player);return `<div class="pod-player-row ${player.present===false?'absent':''}" data-player="${esc(player.name)}"><div><div class="pod-player-name">${esc(player.fullName||player.name)}</div><div class="pod-player-pref">${pref?`First preference: ${esc(pref)}${src&&src!=='none'?` • ${esc(src)}`:''}`:'No first field preference — manual assignment required'}</div></div><label class="pod-present-toggle"><input class="pod-presence" type="checkbox" ${player.present!==false?'checked':''}> Present today</label><label>Pod<select class="pod-select" ${podSaveBusy?'disabled':''}>${optionsFor(player)}</select></label></div>`;}).join('');
    const groups=preferredPods().map((pod,index)=>{const def=POD_DEFS[index],members=(pod.members||[]).map(name=>playerByName(name)).filter(Boolean),here=members.filter(p=>p.present!==false);return `<div class="pod-group"><strong>${esc(def.name)}</strong><div class="muted">${esc(def.positions.join(' + '))} • ${here.length} present / ${members.length} assigned</div><div class="pod-member-line">${members.length?members.map(p=>esc(p.fullName||p.name)).join(', '):'No players assigned'}</div></div>`;}).join('');
    const notice=podSaveNotice?`<div class="pod-status ${podSaveWarning?'warn':''}">${esc(podSaveNotice)}</div>`:'';
    card.innerHTML=`<div class="pod-manager-head"><div><div class="muted">PERSISTENT TEAM SETUP</div><h3 style="margin:.2rem 0">Game-Day Pods</h3><div class="muted">Assign each player once. On game day, mostly update attendance; the pod builder rotates present players and suggests a borrower when a two-position pod has only one player.</div></div><div class="pod-manager-actions"><button id="autoAssignPods" type="button" ${podSaveBusy?'disabled':''}>${podSaveBusy?'Saving…':'Auto-assign unassigned'}</button><button id="buildPodRotation" class="primary" type="button" ${podSaveBusy?'disabled':''}>Build pod rotation draft</button></div></div>${notice}<div class="pod-day-summary"><div class="pod-day-stat"><strong>${assigned}/${players.length}</strong><span class="muted">Players assigned</span></div><div class="pod-day-stat"><strong>${present.length}</strong><span class="muted">Present today</span></div><div class="pod-day-stat"><strong>${unassignedPresent.length}</strong><span class="muted">Present need a pod</span></div></div><div class="pod-status ${unassignedPresent.length?'warn':''}">${unassignedPresent.length?`<strong>Captain assignment needed:</strong> ${unassignedPresent.map(p=>esc(p.fullName||p.name)).join(', ')}`:'Every present player has exactly one pod assignment.'}</div><div class="pod-groups">${groups}</div><details style="margin-top:10px" ${unassignedPresent.length?'open':''}><summary><strong>Edit player pod assignments & attendance</strong></summary><div class="pod-assignment-list">${rows}</div></details>${draftHtml()}`;
    card.querySelector('#autoAssignPods').onclick=autoAssignUnassigned;
    card.querySelector('#buildPodRotation').onclick=buildPodDraft;
    card.querySelectorAll('.pod-player-row').forEach(row=>{
      const name=row.dataset.player;
      row.querySelector('.pod-presence').onchange=e=>setPresence(name,e.target.checked);
      row.querySelector('.pod-select').onchange=e=>setAssignment(name,e.target.value);
    });
    const publish=card.querySelector('#publishPodRotation'),discard=card.querySelector('#discardPodRotation');
    if(publish)publish.onclick=publishPodDraft;if(discard)discard.onclick=()=>{podDraft=null;renderPodManager();};
  }

  function renderLegacy(card){
    const count=livePods().length,notice=podSaveNotice?`<div class="pod-status ${podSaveWarning?'warn':''}">${esc(podSaveNotice)}</div>`:'';
    card.innerHTML=`<div class="pod-manager-head"><div><div class="muted">PERSISTENT TEAM SETUP</div><h3 style="margin:.2rem 0">Game-Day Pods</h3><div class="muted">The new rotation uses six fixed position pods and assigns players from their first field preference. Existing player preferences are preserved.</div></div><button id="setupGameDayPods" class="primary" type="button" ${podSaveBusy?'disabled':''}>${podSaveBusy?'Saving…':'Apply 6-pod setup'}</button></div>${notice}<div class="pod-status warn"><strong>${count?'Existing legacy pod setup detected.':'Pod setup not initialized yet.'}</strong> ${count?`${count} current pod${count===1?'':'s'} will remain untouched until a Captain applies the new setup.`:'No team state changes happen until you apply the setup.'}</div>`;
    card.querySelector('#setupGameDayPods').onclick=applyDefaultPods;
  }

  function renderPodManager(){
    if(typeof state==='undefined'||!state)return;
    const section=document.getElementById('pods'),field=document.getElementById('rotationField');if(!section||!field)return;
    ensureStyles();let card=document.getElementById('gameDayPodManager');
    if(!card){card=document.createElement('div');card.id='gameDayPodManager';card.className='card pod-manager';const hero=section.querySelector('.rotation-hero');if(hero&&hero.nextSibling)section.insertBefore(card,hero.nextSibling);else section.prepend(card);}
    if(configured())renderConfigured(card);else renderLegacy(card);mounted=true;
  }

  function install(){
    if(typeof state==='undefined'||!state||!document.getElementById('rotationField')){setTimeout(install,160);return;}
    renderPodManager();
    if(!wrapped&&typeof window.render==='function'){
      const old=window.render;const next=function(...args){const result=old.apply(this,args);setTimeout(renderPodManager,0);return result;};next.__gameDayPodsWrapped=true;window.render=next;wrapped=true;
    }
    window.addEventListener('buntpreferrednamesrefresh',()=>setTimeout(renderPodManager,0));
  }
  install();
})();
