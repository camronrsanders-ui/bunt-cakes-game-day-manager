(function(){
  const POD_DEFS=[
    {id:'field-pod-pitcher',name:'Pitcher',positions:['Pitcher']},
    {id:'field-pod-catcher-shortstop',name:'Catcher / Shortstop',positions:['Catcher','Shortstop']},
    {id:'field-pod-first-right-center',name:'First Base / Right Center Field',positions:['First Base','Right Center Field']},
    {id:'field-pod-right-left',name:'Right Field / Left Field',positions:['Right Field','Left Field']},
    {id:'field-pod-third-left-center',name:'Third Base / Left Center Field',positions:['Third Base','Left Center Field']},
    {id:'field-pod-second-center',name:'Second Base / Center Field',positions:['Second Base','Center Field']}
  ];
  const POSITION_TO_POD=new Map(POD_DEFS.flatMap(p=>p.positions.map(pos=>[pos.toLowerCase(),p.id])));
  let busy=false,syncing=false;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const profile=()=>window.BuntFieldProfile||{};
  const prefs=p=>typeof profile().prefs==='function'?profile().prefs(p):(Array.isArray(p?.preferences)?p.preferences:[]);
  const firstPref=p=>String(prefs(p)[0]||'').trim();
  const podForPreference=position=>POSITION_TO_POD.get(String(position||'').trim().toLowerCase())||'';

  function endpoint(){
    const match=location.pathname.match(/^\/captain\/([^/?#]+)/i);
    if(match&&match[1])return'/api/team-state?team='+encodeURIComponent(decodeURIComponent(match[1]));
    const q=new URLSearchParams(location.search).get('team');
    return q?'/api/team-state?team='+encodeURIComponent(q):'/api/team-state';
  }

  async function freshState(){
    const url=endpoint();
    const response=await fetch(url+(url.includes('?')?'&':'?')+'fresh='+Date.now(),{credentials:'include',cache:'no-store',headers:{'Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Could not load the latest team state');
    if(!data.state||!Array.isArray(data.state.players))throw new Error('Latest team state is incomplete');
    return{url,state:data.state};
  }

  function blankFixedPods(){return POD_DEFS.map(def=>({id:def.id,name:def.name,positions:[...def.positions],members:[],podType:'game-day-v1'}));}

  function preferenceSetup(players){
    const pods=blankFixedPods(),unassigned=[];let assigned=0;
    players.forEach(player=>{
      if(!player||!player.name)return;
      const id=podForPreference(firstPref(player)),pod=pods.find(item=>item.id===id);
      if(pod){pod.members.push(player.name);assigned++;}else unassigned.push(player.fullName||player.name);
    });
    return{pods,assigned,unassigned};
  }

  function normalizedExistingPods(players,existing){
    const valid=new Set(players.map(p=>p&&p.name).filter(Boolean)),seen=new Set();
    return POD_DEFS.map(def=>{
      const old=(existing||[]).find(p=>p&&p.id===def.id),members=[];
      if(old&&Array.isArray(old.members))old.members.forEach(name=>{if(valid.has(name)&&!seen.has(name)){members.push(name);seen.add(name);}});
      return{id:def.id,name:def.name,positions:[...def.positions],members,podType:'game-day-v1'};
    });
  }

  function autoFill(players,existing){
    const pods=normalizedExistingPods(players,existing),assigned=new Set(pods.flatMap(p=>p.members));
    const blanks=players.filter(p=>p&&p.name&&!assigned.has(p.name)).slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));
    blanks.forEach(player=>{
      const target=pods.slice().sort((a,b)=>{
        const loadA=a.members.length/a.positions.length,loadB=b.members.length/b.positions.length;
        return loadA-loadB||a.members.length-b.members.length||POD_DEFS.findIndex(x=>x.id===a.id)-POD_DEFS.findIndex(x=>x.id===b.id);
      })[0];
      target.members.push(player.name);
    });
    return{pods,filled:blanks.map(p=>p.fullName||p.name)};
  }

  async function persistPods(url,baseState,pods){
    const next=clone(baseState);next.pods=clone(pods);
    const response=await fetch(url,{method:'PUT',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'},body:JSON.stringify({state:next})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Pod assignments could not be saved');
    if(typeof state!=='undefined'&&state)state.pods=clone(pods);
    return data;
  }

  function showStatus(message){
    const root=document.getElementById('gameDayPodManager');if(!root)return;
    let el=document.getElementById('podAssignmentModeStatus');
    if(!el){el=document.createElement('div');el.id='podAssignmentModeStatus';el.className='pod-status';el.style.marginTop='10px';const actions=root.querySelector('.pod-manager-actions');if(actions&&actions.parentElement)actions.parentElement.insertAdjacentElement('afterend',el);else root.prepend(el);}
    if(el.textContent!==message)el.textContent=message;
    clearTimeout(el._hideTimer);el._hideTimer=setTimeout(()=>{if(el.isConnected)el.remove();},5000);
  }

  function activateFieldRotation(){const tab=document.querySelector('.tabs button[data-tab="pods"]');if(tab&&!tab.classList.contains('on'))tab.click();}

  function refreshFieldRotation(){
    if(typeof window.render==='function')window.render();
    setTimeout(()=>{syncUi();activateFieldRotation();document.getElementById('gameDayPodManager')?.scrollIntoView({block:'start',behavior:'smooth'});},25);
  }

  async function resetFromPreferences(button,isInitial){
    if(busy)return;
    const promptText=isInitial?'Create the six Game-Day pods and place players using only their first saved field preference? Players without a matching preference will stay unassigned.':'Reset all pod memberships from players’ first saved field preferences? This replaces current manual/auto pod assignments. Players without a matching preference will stay unassigned.';
    if(!confirm(promptText))return;
    busy=true;const old=button.textContent;button.disabled=true;button.textContent='Assigning…';
    try{
      const latest=await freshState(),result=preferenceSetup(latest.state.players);
      await persistPods(latest.url,latest.state,result.pods);refreshFieldRotation();
      const blank=result.unassigned.length?` ${result.unassigned.length} left blank: ${result.unassigned.join(', ')}.`:' Everyone has a matching first preference.';
      setTimeout(()=>showStatus(`${result.assigned} players assigned from first preferences.${blank}`),40);
    }catch(error){alert(error.message||'Preference pod setup failed');}
    finally{busy=false;button.disabled=false;button.textContent=old;setTimeout(syncUi,50);}
  }

  async function fillUnassigned(button){
    if(busy)return;
    busy=true;const old=button.textContent;button.disabled=true;button.textContent='Filling open pods…';
    try{
      const latest=await freshState();
      const fixedCount=POD_DEFS.filter(def=>(latest.state.pods||[]).some(p=>p&&p.id===def.id)).length;
      if(fixedCount!==POD_DEFS.length)throw new Error('Set up the six Game-Day pods from preferences first.');
      const result=autoFill(latest.state.players,latest.state.pods||[]);
      if(!result.filled.length){showStatus('No unassigned players to auto-fill. Existing pod assignments were left unchanged.');return;}
      await persistPods(latest.url,latest.state,result.pods);refreshFieldRotation();
      setTimeout(()=>showStatus(`${result.filled.length} unassigned player${result.filled.length===1?'':'s'} filled into the least-loaded pods. Existing assignments were preserved.`),40);
    }catch(error){alert(error.message||'Auto-fill failed');}
    finally{busy=false;button.disabled=false;button.textContent=old;setTimeout(syncUi,50);}
  }

  function syncUi(){
    if(syncing)return;syncing=true;
    try{
      const manager=document.getElementById('gameDayPodManager');if(!manager)return;
      const setup=manager.querySelector('#setupGameDayPods,#setupPreferencePods');
      if(setup){if(setup.id!=='setupPreferencePods')setup.id='setupPreferencePods';if(setup.textContent!=='Set up pods from preferences')setup.textContent='Set up pods from preferences';}
      const auto=manager.querySelector('#autoAssignPods,#autoFillUnassignedPods');
      if(auto){if(auto.id!=='autoFillUnassignedPods')auto.id='autoFillUnassignedPods';if(auto.textContent!=='Auto-fill unassigned')auto.textContent='Auto-fill unassigned';}
      const reset=manager.querySelector('#rebalanceAllPods,#resetPreferencePods');
      if(reset){if(reset.id!=='resetPreferencePods')reset.id='resetPreferencePods';if(reset.textContent!=='Reset pods from preferences')reset.textContent='Reset pods from preferences';}
      const desired='Pod setup uses each player’s first saved preference. Players without one stay unassigned. Auto-fill only fills blanks evenly. Inning rotation ignores preferences.';
      const notes=[...manager.querySelectorAll('.muted')];
      const description=notes.find(el=>/assign each player to a pod once|first field preference|new rotation uses six fixed position pods|field preferences are not used|pod setup uses each player/i.test(el.textContent||''));
      if(description&&description.textContent!==desired)description.textContent=desired;
    }finally{syncing=false;}
  }

  document.addEventListener('click',event=>{
    const button=event.target&&event.target.closest?event.target.closest('#setupPreferencePods,#setupGameDayPods,#autoFillUnassignedPods,#autoAssignPods,#resetPreferencePods,#rebalanceAllPods'):null;
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.id==='setupPreferencePods'||button.id==='setupGameDayPods')return resetFromPreferences(button,true);
    if(button.id==='resetPreferencePods'||button.id==='rebalanceAllPods')return resetFromPreferences(button,false);
    if(button.id==='autoFillUnassignedPods'||button.id==='autoAssignPods')return fillUnassigned(button);
  },true);

  window.addEventListener('buntpreferrednamesrefresh',syncUi);
  setInterval(syncUi,1000);
  setTimeout(syncUi,0);
})();
