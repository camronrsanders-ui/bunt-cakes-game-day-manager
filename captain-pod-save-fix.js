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
  let saving=false;

  const roster=()=>Array.isArray(window.state?.players)?window.state.players:(typeof state!=='undefined'&&Array.isArray(state?.players)?state.players:[]);
  const profile=()=>window.BuntFieldProfile||{};
  const prefs=p=>typeof profile().prefs==='function'?profile().prefs(p):(Array.isArray(p?.preferences)?p.preferences:[]);
  const firstPref=p=>String(prefs(p)[0]||'').trim();
  const podForPreference=position=>POSITION_TO_POD.get(String(position||'').trim().toLowerCase())||'';
  const currentPods=()=>typeof state!=='undefined'&&Array.isArray(state?.pods)?state.pods:[];
  const fixedConfigured=()=>POD_DEFS.every(d=>currentPods().some(p=>p&&p.id===d.id));

  function currentFixedAssignment(name){
    for(const def of POD_DEFS){
      const pod=currentPods().find(p=>p&&p.id===def.id);
      if(pod&&Array.isArray(pod.members)&&pod.members.includes(name))return def.id;
    }
    return'';
  }

  function buildPreferencePods(preserveManual){
    const pods=POD_DEFS.map(d=>({id:d.id,name:d.name,positions:[...d.positions],members:[],podType:'game-day-v1'}));
    const manual=[];
    let preferenceAssigned=0;
    roster().forEach(player=>{
      const preferredId=podForPreference(firstPref(player));
      const keepId=!preferredId&&preserveManual?currentFixedAssignment(player.name):'';
      const id=preferredId||keepId;
      const pod=pods.find(p=>p.id===id);
      if(pod){
        pod.members.push(player.name);
        if(preferredId)preferenceAssigned++;
      }else{
        manual.push(player.fullName||player.name);
      }
    });
    return{pods,preferenceAssigned,manual};
  }

  function teamStateUrl(){
    const match=location.pathname.match(/^\/captain\/([^/?#]+)/i);
    if(match&&match[1])return'/api/team-state?team='+encodeURIComponent(decodeURIComponent(match[1]));
    const q=new URLSearchParams(location.search).get('team');
    return q?'/api/team-state?team='+encodeURIComponent(q):'/api/team-state';
  }

  async function savePods(result,button){
    if(saving)return;
    saving=true;
    const oldText=button&&button.textContent;
    if(button){button.disabled=true;button.textContent='Saving pods…';}
    const status=document.getElementById('saveStatus');
    if(status)status.textContent='Saving pod assignments…';
    try{
      const url=teamStateUrl();
      const freshResponse=await fetch(url+(url.includes('?')?'&':'?')+'fresh='+Date.now(),{
        credentials:'include',cache:'no-store',headers:{'Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'}
      });
      const fresh=await freshResponse.json().catch(()=>({}));
      if(!freshResponse.ok)throw new Error(fresh.error||'Could not load the latest team state');
      if(!fresh.state||!Array.isArray(fresh.state.players))throw new Error('Latest team state is incomplete');

      // Save from a just-fetched server snapshot. The legacy optimistic timestamp
      // comparison loses PostgreSQL microseconds in the browser, so pod writes
      // intentionally omit expectedUpdatedAt until the server comparison is fixed.
      const nextState=JSON.parse(JSON.stringify(fresh.state));
      nextState.pods=result.pods;
      const saveResponse=await fetch(url,{
        method:'PUT',credentials:'include',cache:'no-store',
        headers:{'Content-Type':'application/json','Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'},
        body:JSON.stringify({state:nextState})
      });
      const saved=await saveResponse.json().catch(()=>({}));
      if(!saveResponse.ok)throw new Error(saved.error||'Pod assignments could not be saved');

      if(typeof state!=='undefined'&&state)state.pods=JSON.parse(JSON.stringify(result.pods));
      if(status)status.innerHTML='<span class="ok">Saved live</span> • pod assignments updated';
      const manualText=result.manual.length
        ? ` ${result.manual.length} player${result.manual.length===1?'':'s'} still need${result.manual.length===1?'s':''} a manual Captain assignment: ${result.manual.join(', ')}.`
        : ' Every player is assigned.';
      alert(`Auto-assigned ${result.preferenceAssigned} player${result.preferenceAssigned===1?'':'s'} from first field preferences.${manualText}`);
      location.reload();
    }catch(error){
      if(status)status.innerHTML='<span class="warn">Not saved: '+String(error.message||error)+'</span>';
      alert(error.message||'Pod auto-assign failed');
      if(button){button.disabled=false;button.textContent=oldText;}
    }finally{
      saving=false;
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target&&event.target.closest?event.target.closest('#autoAssignPods,#setupGameDayPods'):null;
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(saving)return;

    const isSetup=button.id==='setupGameDayPods'||!fixedConfigured();
    if(isSetup&&!confirm('Apply the six fixed Game-Day pods and auto-assign every player who has a matching first field preference? Players without a matching preference will stay available for manual Captain assignment.'))return;
    const result=buildPreferencePods(!isSetup);
    savePods(result,button);
  },true);
})();
