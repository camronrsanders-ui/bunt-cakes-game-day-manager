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
  let neutralDraft=null,saving=false,scheduled=false,applying=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clone=v=>JSON.parse(JSON.stringify(v));
  const roster=()=>Array.isArray(state?.players)?state.players:[];
  const fixedPods=()=>Array.isArray(state?.pods)?POD_DEFS.map(def=>state.pods.find(p=>p&&p.id===def.id)).filter(Boolean):[];
  const configured=()=>fixedPods().length===POD_DEFS.length;
  const posFor=(name,inning,innings=state?.innings)=>{
    const inn=innings?.[inning]||{};
    return POSITIONS.find(pos=>inn[pos]===name)||'Rest';
  };
  const assignedPod=(pods,name)=>pods.find(p=>p&&Array.isArray(p.members)&&p.members.includes(name))||null;
  const teamStateUrl=()=>{
    const match=location.pathname.match(/^\/captain\/([^/?#]+)/i);
    if(match&&match[1])return'/api/team-state?team='+encodeURIComponent(decodeURIComponent(match[1]));
    const q=new URLSearchParams(location.search).get('team');
    return q?'/api/team-state?team='+encodeURIComponent(q):'/api/team-state';
  };

  async function freshState(){
    const url=teamStateUrl(),r=await fetch(url+(url.includes('?')?'&':'?')+'fresh='+Date.now(),{
      credentials:'include',cache:'no-store',headers:{'Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'}
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Could not load the latest team state');
    if(!j.state||!Array.isArray(j.state.players))throw new Error('Latest team state is incomplete');
    return{url,state:j.state};
  }

  async function saveFreshField(field,value,statusText){
    const latest=await freshState(),next=clone(latest.state);next[field]=clone(value);
    const r=await fetch(latest.url,{method:'PUT',credentials:'include',cache:'no-store',headers:{
      'Content-Type':'application/json','Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'
    },body:JSON.stringify({state:next})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Rotation could not be saved');
    if(typeof state!=='undefined'&&state)state[field]=clone(value);
    const status=document.getElementById('saveStatus');if(status)status.innerHTML='<span class="ok">Saved live</span> • '+statusText;
    return j;
  }

  function balancedPods(players,existing,isSetup){
    const valid=new Set(players.map(p=>p&&p.name).filter(Boolean)),seen=new Set();
    const pods=POD_DEFS.map(def=>{
      const old=!isSetup?existing.find(p=>p&&p.id===def.id):null,members=[];
      if(old&&Array.isArray(old.members))old.members.forEach(name=>{if(valid.has(name)&&!seen.has(name)){members.push(name);seen.add(name);}});
      return{id:def.id,name:def.name,positions:[...def.positions],members,podType:'game-day-v1'};
    });
    const unassigned=players.filter(p=>p&&p.name&&!seen.has(p.name)).slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));
    unassigned.forEach(player=>{
      const target=pods.slice().sort((a,b)=>{
        const ar=a.members.length/a.positions.length,br=b.members.length/b.positions.length;
        return ar-br||a.members.length-b.members.length||POD_DEFS.findIndex(x=>x.id===a.id)-POD_DEFS.findIndex(x=>x.id===b.id);
      })[0];
      target.members.push(player.name);seen.add(player.name);
    });
    return{pods,added:unassigned.length};
  }

  async function autoBalancePods(isSetup,button){
    if(saving)return;saving=true;
    const oldText=button.textContent;button.disabled=true;button.textContent='Balancing pods…';
    try{
      if(isSetup&&!confirm('Apply the six fixed Game-Day pods and balance players across them without using field preferences?'))return;
      const latest=await freshState(),existing=Array.isArray(latest.state.pods)?latest.state.pods:[];
      const result=balancedPods(latest.state.players,existing,isSetup),next=clone(latest.state);next.pods=result.pods;
      const r=await fetch(latest.url,{method:'PUT',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'},body:JSON.stringify({state:next})});
      const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Pod assignments could not be saved');
      state.pods=clone(result.pods);
      alert(`${isSetup?'Balanced':'Auto-balanced'} ${result.added} player${result.added===1?'':'s'} across the six pods. Field preferences were not used.`);
      location.reload();
    }catch(error){alert(error.message||'Pod balancing failed');}
    finally{saving=false;if(button){button.disabled=false;button.textContent=oldText;}}
  }

  function rotatingHomeNames(members,capacity,inning){
    if(!members.length||capacity<=0)return[];
    const start=(inning-1)%members.length,out=[];
    for(let i=0;i<members.length&&out.length<Math.min(capacity,members.length);i++)out.push(members[(start+i)%members.length].name);
    return out;
  }

  function chooseBorrower(target,podRosters,remainingSurplus,borrowedOut,borrowStats,inning){
    const candidates=[];
    POD_DEFS.forEach(def=>{
      if(def.id===target.id)return;
      const members=podRosters.get(def.id)||[],surplus=remainingSurplus.get(def.id)||0;
      if(surplus<=0)return;
      const home=new Set(rotatingHomeNames(members,def.positions.length,inning));
      members.forEach((player,index)=>{
        if(borrowedOut.has(player.name))return;
        const wouldRest=!home.has(player.name);
        candidates.push({player,donor:def,surplus,wouldRest,index,borrowed:borrowStats.get(player.name)||0});
      });
    });
    candidates.sort((a,b)=>Number(b.wouldRest)-Number(a.wouldRest)||b.surplus-a.surplus||a.borrowed-b.borrowed||a.index-b.index||a.player.name.localeCompare(b.player.name));
    return candidates[0]||null;
  }

  function buildNeutralDraft(){
    if(!configured())throw new Error('Set up the six Game-Day pods first.');
    const present=roster().filter(p=>p.present!==false),pods=fixedPods();
    const unassigned=present.filter(p=>!assignedPod(pods,p.name));
    if(unassigned.length)throw new Error('Assign every present player to a pod first: '+unassigned.map(p=>p.fullName||p.name).join(', '));
    if(!present.length)throw new Error('No players are marked present.');
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
          const player=effective[0],pos=def.positions[(inning-1)%2];out[pos]=player.name;used.add(player.name);return;
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
    return{innings,borrows,gaps,createdAt:new Date().toISOString()};
  }

  function draftHtml(draft){
    const borrow=draft.borrows.length?draft.borrows.map(x=>`<div class="pod-borrow"><strong>Inning ${x.inning}: ${esc(x.player)}</strong> — ${esc(x.from)} → ${esc(x.to)}</div>`).join(''):'<div class="muted">No borrowing is needed with the current attendance.</div>';
    const rows=Array.from({length:7},(_,i)=>{const n=i+1,inn=draft.innings[n]||{};return `<details><summary>Inning ${n}</summary><div class="pod-inning-preview">${POSITIONS.map(pos=>`<div><strong>${esc(pos)}:</strong> <span class="${inn[pos]?'':'pod-gap'}">${esc(inn[pos]||'Unassigned')}</span></div>`).join('')}</div></details>`;}).join('');
    return `<div id="neutralPodDraft" class="pod-draft"><strong>Private balanced rotation draft</strong><div class="muted">Field preferences are not used. ${draft.borrows.length} borrow${draft.borrows.length===1?'':'s'} • ${draft.gaps} unfilled slot${draft.gaps===1?'':'s'}.</div><div style="margin-top:7px">${borrow}</div>${rows}<div class="pod-draft-actions"><button id="publishNeutralPodRotation" class="primary" type="button">Publish balanced rotation</button><button id="discardNeutralPodRotation" type="button">Discard draft</button></div></div>`;
  }

  function showNeutralDraft(){
    const card=document.getElementById('gameDayPodManager');if(!card||!neutralDraft||card.querySelector('#neutralPodDraft'))return;
    card.insertAdjacentHTML('beforeend',draftHtml(neutralDraft));
  }

  function buildDraft(){
    try{neutralDraft=buildNeutralDraft();showNeutralDraft();alert('Balanced seven-inning draft built. Field preferences were not used. Review it, then publish when ready.');}
    catch(error){alert(error.message||'Could not build rotation draft');}
  }

  async function publishDraft(button){
    if(!neutralDraft||saving)return;if(!confirm(`Publish this balanced seven-inning rotation? Players will immediately see it.${neutralDraft.gaps?` It has ${neutralDraft.gaps} unfilled slot${neutralDraft.gaps===1?'':'s'} for a Captain to adjust manually.`:''}`))return;
    saving=true;const oldText=button.textContent;button.disabled=true;button.textContent='Publishing…';
    try{await saveFreshField('innings',neutralDraft.innings,'balanced rotation published');neutralDraft=null;location.reload();}
    catch(error){alert(error.message||'Rotation could not be published');button.disabled=false;button.textContent=oldText;}
    finally{saving=false;}
  }

  function cleanRestCard(){
    const box=document.getElementById('rotationRest');if(!box)return;
    const label=box.querySelector('.muted'),match=label&&label.textContent.match(/INNING\s+(\d+)/i),inning=match?Number(match[1]):Number(state?.gameInning||1);
    box.querySelectorAll('.rotation-person').forEach(row=>{
      const name=row.querySelector('strong')?.textContent?.trim(),detail=row.querySelector('span.muted');if(!name||!detail)return;
      if(inning>=7){if(detail.textContent!=='Final inning')detail.textContent='Final inning';return;}
      const next=posFor(name,inning+1),text=`Inning ${inning+1}: ${next==='Rest'?'Rest again':next}`;if(detail.textContent!==text)detail.textContent=text;
    });
  }

  function cleanRotationUI(){
    if(applying)return;applying=true;
    try{
      const hero=document.querySelector('#pods .rotation-hero .rotation-title');
      if(hero){const notes=hero.querySelectorAll('.muted');if(notes[1]&&notes[1].textContent!=='Build rotations from pods, attendance, and Captain decisions. Field preferences are not used here.')notes[1].textContent='Build rotations from pods, attendance, and Captain decisions. Field preferences are not used here.';}
      ['rotationProfileProgress','rotationSurveyWarning','rotationProfiles'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
      const oldActions=document.querySelector('#pods .rotation-actions');if(oldActions)oldActions.style.display='none';
      document.querySelectorAll('#rotationField .fit,#rotationEditor .fit-chip').forEach(el=>el.style.display='none');
      const editorNote=document.querySelector('#rotationEditor .rotation-note');if(editorNote&&editorNote.textContent!=='Choose any present player. Field preferences are not used in this rotation.')editorNote.textContent='Choose any present player. Field preferences are not used in this rotation.';
      const manager=document.getElementById('gameDayPodManager');if(manager){
        manager.querySelectorAll('.pod-player-pref').forEach(el=>el.style.display='none');
        const auto=manager.querySelector('#autoAssignPods');if(auto&&auto.textContent!=='Auto-balance unassigned')auto.textContent='Auto-balance unassigned';
        const setup=manager.querySelector('#setupGameDayPods');if(setup&&setup.textContent!=='Apply balanced 6-pod setup')setup.textContent='Apply balanced 6-pod setup';
        const description=[...manager.querySelectorAll('.muted')].find(el=>/first field preference|assigns players from|pod builder rotates/i.test(el.textContent));
        if(description){const text=configured()?'Assign each player to a pod once. Rotation uses pod membership, attendance, and even turn-taking — never field preferences.':'The six fixed Game-Day pods are balanced by headcount. Field preferences are not used.';if(description.textContent!==text)description.textContent=text;}
        if(neutralDraft)showNeutralDraft();
      }
      cleanRestCard();
    }finally{applying=false;}
  }

  function scheduleClean(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;cleanRotationUI();});}

  document.addEventListener('click',event=>{
    const target=event.target&&event.target.closest?event.target.closest('#autoAssignPods,#setupGameDayPods,#buildPodRotation,#buildPreferenceRotation,#publishNeutralPodRotation,#discardNeutralPodRotation'):null;
    if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(target.id==='autoAssignPods')return autoBalancePods(false,target);
    if(target.id==='setupGameDayPods')return autoBalancePods(true,target);
    if(target.id==='buildPodRotation')return buildDraft();
    if(target.id==='buildPreferenceRotation'){alert('Use the Game-Day Pod builder above. It creates the balanced rotation without using player field preferences.');return;}
    if(target.id==='publishNeutralPodRotation')return publishDraft(target);
    if(target.id==='discardNeutralPodRotation'){neutralDraft=null;target.closest('#neutralPodDraft')?.remove();}
  },true);

  const observer=new MutationObserver(scheduleClean);observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('buntpreferrednamesrefresh',scheduleClean);
  setInterval(scheduleClean,1200);
  scheduleClean();
})();