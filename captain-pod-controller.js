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
  let podDraft=null,wrapped=false,refreshing=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clone=v=>JSON.parse(JSON.stringify(v));
  const roster=()=>Array.isArray(state?.players)?state.players:[];
  const profile=()=>window.BuntFieldProfile||{};
  const prefs=p=>typeof profile().prefs==='function'?profile().prefs(p):(Array.isArray(p?.preferences)?p.preferences:[]);
  const firstPref=p=>String(prefs(p)[0]||'').trim();
  const podForPreference=position=>POSITION_TO_POD.get(String(position||'').trim().toLowerCase())||'';
  const fixedPods=()=>Array.isArray(state?.pods)?POD_DEFS.map(def=>state.pods.find(p=>p&&p.id===def.id)).filter(Boolean):[];
  const configured=()=>fixedPods().length===POD_DEFS.length;
  const playerByName=name=>roster().find(p=>p&&p.name===name);

  function blankPods(){return POD_DEFS.map(def=>({id:def.id,name:def.name,positions:[...def.positions],members:[],podType:'game-day-v1'}));}

  function normalizePods(){
    if(!configured())return;
    const valid=new Set(roster().map(p=>p&&p.name).filter(Boolean)),seen=new Set();
    POD_DEFS.forEach(def=>{
      const pod=state.pods.find(p=>p&&p.id===def.id);if(!pod)return;
      pod.name=def.name;pod.positions=[...def.positions];pod.podType='game-day-v1';
      pod.members=(Array.isArray(pod.members)?pod.members:[]).filter(name=>valid.has(name)&&!seen.has(name));
      pod.members.forEach(name=>seen.add(name));
    });
  }

  function assignmentFor(name){
    for(const pod of fixedPods())if(Array.isArray(pod.members)&&pod.members.includes(name))return pod.id;
    return'';
  }

  function setPodsFromPreferences(){
    const pods=blankPods(),unassigned=[];let assigned=0;
    roster().forEach(player=>{
      if(!player||!player.name)return;
      const id=podForPreference(firstPref(player)),pod=pods.find(p=>p.id===id);
      if(pod){pod.members.push(player.name);assigned++;}else unassigned.push(player.fullName||player.name);
    });
    state.pods=pods;podDraft=null;queueSave();renderAll();
    status(`${assigned} player${assigned===1?'':'s'} assigned from first preferences.${unassigned.length?` ${unassigned.length} left blank: ${unassigned.join(', ')}.`:' Everyone matched.'}`);
  }

  function resetFromPreferences(){
    const text=configured()
      ?'Reset all pod memberships from each player’s first saved field preference? This replaces current pod memberships. Players without a matching first preference will stay blank.'
      :'Create the six Game-Day pods from each player’s first saved field preference? Players without a matching first preference will stay blank.';
    if(!confirm(text))return;
    setPodsFromPreferences();
  }

  function autoFillUnassigned(){
    if(!configured()){alert('Set up the six Game-Day pods from preferences first.');return;}
    normalizePods();
    const pods=fixedPods(),assigned=new Set(pods.flatMap(p=>p.members||[]));
    const blanks=roster().filter(p=>p&&p.name&&!assigned.has(p.name)).slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));
    blanks.forEach(player=>{
      const target=pods.slice().sort((a,b)=>{
        const loadA=(a.members||[]).length/Math.max(1,a.positions.length),loadB=(b.members||[]).length/Math.max(1,b.positions.length);
        return loadA-loadB||(a.members||[]).length-(b.members||[]).length||POD_DEFS.findIndex(x=>x.id===a.id)-POD_DEFS.findIndex(x=>x.id===b.id);
      })[0];
      target.members.push(player.name);
    });
    podDraft=null;
    if(blanks.length)queueSave();
    renderAll();
    status(blanks.length?`${blanks.length} unassigned player${blanks.length===1?'':'s'} filled into the least-loaded pods. Existing assignments were preserved.`:'No unassigned players to auto-fill.');
  }

  function setAssignment(name,podId){
    if(!configured())return;
    normalizePods();
    fixedPods().forEach(p=>{p.members=(p.members||[]).filter(n=>n!==name);});
    const target=fixedPods().find(p=>p.id===podId);if(target)target.members.push(name);
    podDraft=null;queueSave();renderAll();
  }

  function setPresence(name,present){
    const player=playerByName(name);if(!player)return;
    player.present=!!present;podDraft=null;queueSave();
    if(typeof renderRoster==='function')renderRoster();
    renderAll();
  }

  function homeNames(members,capacity,inning){
    if(!members.length||capacity<=0)return[];
    const start=(inning-1)%members.length,out=[];
    for(let i=0;i<members.length&&out.length<Math.min(capacity,members.length);i++)out.push(members[(start+i)%members.length].name);
    return out;
  }

  function chooseBorrower(target,podRosters,remainingSurplus,borrowedOut,borrowStats,inning){
    const candidates=[];
    POD_DEFS.forEach(def=>{
      if(def.id===target.id)return;
      const members=podRosters.get(def.id)||[],surplus=remainingSurplus.get(def.id)||0;if(surplus<=0)return;
      const home=new Set(homeNames(members,def.positions.length,inning));
      members.forEach((player,index)=>{
        if(borrowedOut.has(player.name))return;
        candidates.push({player,donor:def,wouldRest:!home.has(player.name),surplus,borrowed:borrowStats.get(player.name)||0,index});
      });
    });
    candidates.sort((a,b)=>Number(b.wouldRest)-Number(a.wouldRest)||b.surplus-a.surplus||a.borrowed-b.borrowed||a.index-b.index||a.player.name.localeCompare(b.player.name));
    return candidates[0]||null;
  }

  function buildDraft(){
    if(!configured()){alert('Set up the six Game-Day pods first.');return;}
    normalizePods();
    const present=roster().filter(p=>p&&p.name&&p.present!==false),pods=fixedPods();
    const unassigned=present.filter(p=>!assignmentFor(p.name));
    if(unassigned.length){alert('Assign every present player to a pod first: '+unassigned.map(p=>p.fullName||p.name).join(', '));return;}
    if(!present.length){alert('No players are marked present.');return;}

    const byName=new Map(roster().map(p=>[p.name,p])),borrowStats=new Map(),innings={},borrows=[];let gaps=0;
    for(let inning=1;inning<=7;inning++){
      const podRosters=new Map();
      POD_DEFS.forEach(def=>{
        const pod=pods.find(p=>p.id===def.id);podRosters.set(def.id,(pod.members||[]).map(n=>byName.get(n)).filter(p=>p&&p.present!==false));
      });
      const remainingSurplus=new Map(POD_DEFS.map(def=>[def.id,Math.max(0,(podRosters.get(def.id)||[]).length-def.positions.length)]));
      const borrowedOut=new Set(),borrowedIn=new Map(POD_DEFS.map(def=>[def.id,[]]));

      POD_DEFS.forEach(target=>{
        const own=podRosters.get(target.id)||[];
        if(target.positions.length!==2||own.length!==1)return;
        const pick=chooseBorrower(target,podRosters,remainingSurplus,borrowedOut,borrowStats,inning);if(!pick)return;
        borrowedOut.add(pick.player.name);borrowedIn.get(target.id).push(pick.player);
        remainingSurplus.set(pick.donor.id,Math.max(0,(remainingSurplus.get(pick.donor.id)||0)-1));
        borrowStats.set(pick.player.name,(borrowStats.get(pick.player.name)||0)+1);
        borrows.push({inning,player:pick.player.name,from:pick.donor.name,to:target.name});
      });

      const out={};POSITIONS.forEach(pos=>out[pos]='');const used=new Set();
      POD_DEFS.forEach(def=>{
        const own=(podRosters.get(def.id)||[]).filter(p=>!borrowedOut.has(p.name));
        const effective=[...own,...(borrowedIn.get(def.id)||[])];if(!effective.length)return;
        if(effective.length===1&&def.positions.length===2){
          const player=effective[0],pos=def.positions[(inning-1)%2];
          if(!used.has(player.name)){out[pos]=player.name;used.add(player.name);}return;
        }
        const start=(inning-1)%effective.length;
        def.positions.forEach((pos,slot)=>{
          for(let step=0;step<effective.length;step++){
            const player=effective[(start+slot+step)%effective.length];
            if(!used.has(player.name)){out[pos]=player.name;used.add(player.name);break;}
          }
        });
      });
      gaps+=POSITIONS.filter(pos=>!out[pos]).length;innings[inning]=out;
    }
    podDraft={innings,borrows,gaps,createdAt:new Date().toISOString()};renderAll();
    status('New seven-inning draft created. Nothing is published until you tap Publish rotation.');
  }

  function publishDraft(){
    if(!podDraft)return;
    if(!confirm(`Publish this seven-inning pod rotation? Players will immediately see it.${podDraft.gaps?` It has ${podDraft.gaps} unfilled slot${podDraft.gaps===1?'':'s'} for a Captain to adjust manually.`:''}`))return;
    state.innings=clone(podDraft.innings);podDraft=null;queueSave();
    if(typeof render==='function')render();
    setTimeout(renderAll,0);
  }

  function discardDraft(){podDraft=null;renderAll();status('Draft deleted. No rotation changes were published.');}

  function status(message){
    const root=document.getElementById('gameDayPodManager');if(!root)return;
    let el=document.getElementById('podControllerStatus');
    if(!el){el=document.createElement('div');el.id='podControllerStatus';el.className='pod-status';el.style.marginTop='10px';root.prepend(el);}
    el.textContent=message;clearTimeout(el._timer);el._timer=setTimeout(()=>{if(el.isConnected)el.remove();},5000);
  }

  function ensureStyles(){
    if(document.getElementById('captainPodControllerStyles'))return;
    const style=document.createElement('style');style.id='captainPodControllerStyles';style.textContent=`
      .pod-manager{border:2px solid #86efac;background:#fbfffc}.pod-manager-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.pod-manager-actions{display:flex;gap:7px;flex-wrap:wrap}.pod-manager-actions button{width:auto}.pod-status{margin-top:9px;padding:9px 10px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0}.pod-status.warn{background:#fff7ed;border-color:#fed7aa;color:#9a3412}.pod-day-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}.pod-day-stat{background:#fff;border:1px solid var(--l);border-radius:12px;padding:8px}.pod-day-stat strong{display:block;font-size:1.15rem;color:#166534}.pod-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.pod-group{background:#fff;border:1px solid var(--l);border-radius:12px;padding:9px}.pod-member-line{font-size:.85rem;color:#4b5563;margin-top:4px}.pod-assignment-list{display:grid;gap:8px;margin-top:10px}.pod-player-row{display:grid;grid-template-columns:minmax(150px,.8fr) minmax(190px,1fr) minmax(220px,1.1fr);gap:8px;align-items:center;padding:9px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}.pod-player-row.absent{opacity:.65}.pod-player-name{font-weight:900}.pod-player-pref{font-size:.8rem;color:#6b7280;margin-top:2px}.pod-present-toggle{display:flex;align-items:center;gap:7px;font-size:.82rem;font-weight:800}.pod-present-toggle input{width:auto;margin:0}.pod-draft{margin-top:10px;border:1px solid #93c5fd;background:#eff6ff;border-radius:13px;padding:10px}.pod-draft-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.pod-draft details{background:#fff;border:1px solid #dbeafe;border-radius:10px;margin-top:6px;padding:7px 9px}.pod-draft summary{cursor:pointer;font-weight:800}.pod-inning-preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 9px;margin-top:6px;font-size:.82rem}.pod-gap{color:#b45309;font-weight:800}.pod-borrow{padding:6px 0;border-top:1px solid #bfdbfe}.pod-borrow:first-child{border-top:0}.rotation-actions,#rotationProfileProgress,#rotationSurveyWarning,#rotationProfiles,#rotationField .fit,#rotationEditor .fit-chip{display:none!important}@media(max-width:720px){.pod-player-row{grid-template-columns:1fr}.pod-groups{grid-template-columns:1fr}.pod-day-summary{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:420px){.pod-day-summary{grid-template-columns:1fr}.pod-inning-preview{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }

  function draftHtml(){
    if(!podDraft)return'';
    const created=new Date(podDraft.createdAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    const borrow=podDraft.borrows.length?podDraft.borrows.map(x=>`<div class="pod-borrow"><strong>Inning ${x.inning}: ${esc(x.player)}</strong> — ${esc(x.from)} → ${esc(x.to)}</div>`).join(''):'<div class="muted">No borrowing is needed with the current attendance.</div>';
    const innings=Array.from({length:7},(_,i)=>{const n=i+1,inn=podDraft.innings[n]||{};return `<details><summary>Inning ${n}</summary><div class="pod-inning-preview">${POSITIONS.map(pos=>`<div><strong>${esc(pos)}:</strong> <span class="${inn[pos]?'':'pod-gap'}">${esc(inn[pos]||'Unassigned')}</span></div>`).join('')}</div></details>`;}).join('');
    return `<div class="pod-draft"><strong>Private balanced rotation draft</strong><div class="muted">Created ${esc(created)} • field preferences are not used for inning rotation • ${podDraft.borrows.length} borrow${podDraft.borrows.length===1?'':'s'} • ${podDraft.gaps} unfilled slot${podDraft.gaps===1?'':'s'}.</div><div style="margin-top:7px">${borrow}</div>${innings}<div class="pod-draft-actions"><button id="publishPodControllerDraft" class="primary" type="button">Publish rotation</button><button id="discardPodControllerDraft" type="button">Delete draft</button></div></div>`;
  }

  function renderManager(){
    if(typeof state==='undefined'||!state)return;
    const section=document.getElementById('pods'),field=document.getElementById('rotationField');if(!section||!field)return;
    ensureStyles();let card=document.getElementById('gameDayPodManager');
    if(!card){card=document.createElement('div');card.id='gameDayPodManager';card.className='card pod-manager';const hero=section.querySelector('.rotation-hero');if(hero&&hero.nextSibling)section.insertBefore(card,hero.nextSibling);else section.prepend(card);}

    if(!configured()){
      card.innerHTML=`<div class="pod-manager-head"><div><div class="muted">PERSISTENT TEAM SETUP</div><h3 style="margin:.2rem 0">Game-Day Pods</h3><div class="muted">Set up each player from their first saved field preference. Players without a usable first preference stay blank until a Captain assigns them or uses Auto-fill.</div></div><button id="resetPodsFromPreferences" class="primary" type="button">Set up pods from preferences</button></div>`;
      card.querySelector('#resetPodsFromPreferences').onclick=resetFromPreferences;return;
    }

    normalizePods();
    const players=roster().slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));
    const assigned=players.filter(p=>assignmentFor(p.name)).length,present=players.filter(p=>p.present!==false),unassignedPresent=present.filter(p=>!assignmentFor(p.name));
    const groups=fixedPods().map((pod,index)=>{const def=POD_DEFS[index],members=(pod.members||[]).map(playerByName).filter(Boolean),here=members.filter(p=>p.present!==false);return `<div class="pod-group"><strong>${esc(def.name)}</strong><div class="muted">${esc(def.positions.join(' + '))} • ${here.length} present / ${members.length} assigned</div><div class="pod-member-line">${members.length?members.map(p=>esc(p.fullName||p.name)).join(', '):'No players assigned'}</div></div>`;}).join('');
    const rows=players.map(player=>`<div class="pod-player-row ${player.present===false?'absent':''}" data-player="${esc(player.name)}"><div><div class="pod-player-name">${esc(player.fullName||player.name)}</div><div class="pod-player-pref">${firstPref(player)?`Initial setup preference: ${esc(firstPref(player))}`:'No first field preference'}</div></div><label class="pod-present-toggle"><input class="pod-presence" type="checkbox" ${player.present!==false?'checked':''}> Present today</label><label>Pod<select class="pod-select"><option value="">Unassigned</option>${POD_DEFS.map(def=>`<option value="${def.id}" ${assignmentFor(player.name)===def.id?'selected':''}>${esc(def.name)}</option>`).join('')}</select></label></div>`).join('');

    card.innerHTML=`<div class="pod-manager-head"><div><div class="muted">PERSISTENT TEAM SETUP</div><h3 style="margin:.2rem 0">Game-Day Pods</h3><div class="muted">Preferences are used only to place players into their initial pods. Actual inning rotation uses pod membership, attendance, even turn-taking, and Captain changes.</div></div><div class="pod-manager-actions"><button id="resetPodsFromPreferences" type="button">Reset pods from preferences</button><button id="autoFillPods" type="button">Auto-fill unassigned</button><button id="buildPodControllerDraft" class="primary" type="button">Build pod rotation draft</button></div></div><div class="pod-day-summary"><div class="pod-day-stat"><strong>${assigned}/${players.length}</strong><span class="muted">Players assigned</span></div><div class="pod-day-stat"><strong>${present.length}</strong><span class="muted">Present today</span></div><div class="pod-day-stat"><strong>${unassignedPresent.length}</strong><span class="muted">Present need a pod</span></div></div><div class="pod-status ${unassignedPresent.length?'warn':''}">${unassignedPresent.length?`<strong>Captain assignment needed:</strong> ${unassignedPresent.map(p=>esc(p.fullName||p.name)).join(', ')}`:'Every present player has exactly one pod assignment.'}</div><div class="pod-groups">${groups}</div><details style="margin-top:10px" ${unassignedPresent.length?'open':''}><summary><strong>Edit player pod assignments & attendance</strong></summary><div class="pod-assignment-list">${rows}</div></details>${draftHtml()}`;
    card.querySelector('#resetPodsFromPreferences').onclick=resetFromPreferences;
    card.querySelector('#autoFillPods').onclick=autoFillUnassigned;
    card.querySelector('#buildPodControllerDraft').onclick=buildDraft;
    card.querySelectorAll('.pod-player-row').forEach(row=>{
      const name=row.dataset.player;row.querySelector('.pod-presence').onchange=e=>setPresence(name,e.target.checked);row.querySelector('.pod-select').onchange=e=>setAssignment(name,e.target.value);
    });
    card.querySelector('#publishPodControllerDraft')?.addEventListener('click',publishDraft);
    card.querySelector('#discardPodControllerDraft')?.addEventListener('click',discardDraft);
  }

  function cleanFieldUi(){
    const hero=document.querySelector('#pods .rotation-hero .rotation-title');
    if(hero){const notes=hero.querySelectorAll('.muted');if(notes[1])notes[1].textContent='Use Game-Day Pods, attendance, even turn-taking, and Captain decisions. Field preferences do not drive inning rotation.';}
    const editorNote=document.querySelector('#rotationEditor .rotation-note');if(editorNote)editorNote.textContent='Choose any present player. Field preferences do not drive this rotation.';
    const box=document.getElementById('rotationRest');if(!box)return;
    const label=box.querySelector('.muted'),match=label&&label.textContent.match(/INNING\s+(\d+)/i),inning=match?Number(match[1]):Number(state?.gameInning||1);
    box.querySelectorAll('.rotation-person').forEach(row=>{
      const name=row.querySelector('strong')?.textContent?.trim(),detail=row.querySelector('span.muted');if(!name||!detail)return;
      if(inning>=7){detail.textContent='Final inning';return;}
      const next=state?.innings?.[inning+1]||state?.innings?.[String(inning+1)]||{},position=POSITIONS.find(pos=>next[pos]===name)||'Rest';
      detail.textContent=`Inning ${inning+1}: ${position==='Rest'?'Rest again':position}`;
    });
  }

  function renderAll(){
    if(refreshing)return;refreshing=true;
    try{renderManager();cleanFieldUi();}finally{refreshing=false;}
  }

  function install(){
    if(typeof state==='undefined'||!state||!document.getElementById('rotationField')){setTimeout(install,150);return;}
    renderAll();
    if(!wrapped&&typeof window.render==='function'){
      const old=window.render;const next=function(...args){const result=old.apply(this,args);setTimeout(renderAll,0);return result;};next.__singlePodController=true;window.render=next;wrapped=true;
    }
    window.addEventListener('buntpreferrednamesrefresh',()=>setTimeout(renderAll,0));
    document.addEventListener('click',event=>{if(event.target?.closest?.('#pods'))setTimeout(cleanFieldUi,0);});
    document.addEventListener('change',event=>{if(event.target?.closest?.('#pods'))setTimeout(cleanFieldUi,0);});
    window.addEventListener('focus',()=>setTimeout(renderAll,0));
  }
  install();
})();
