(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const rolesOf=p=>window.BuntRoles?.normalizedRoles?window.BuntRoles.normalizedRoles(p):(Array.isArray(p?.roles)?p.roles:String(p?.role||'').split(/\s*(?:\/|,|•|\|)\s*/).filter(Boolean));
  const isAvailable=(name,date)=>{const a=state?.availability?.[date]?.[name]?.status;return a!=='no';};
  function counts(){
    const out=new Map((state.players||[]).map(p=>[p.name,{umpire:0,line:0,total:0}]));
    (state.events||[]).filter(e=>e.type==='Officiating').forEach(e=>{
      if(e.umpire&&out.has(e.umpire)){const x=out.get(e.umpire);x.umpire++;x.total++;}
      [e.lineRef1,e.lineRef2].forEach(n=>{if(n&&out.has(n)){const x=out.get(n);x.line++;x.total++;}});
    });
    return out;
  }
  function choose(pool,used,metric,date,ctr){
    return pool.filter(p=>!used.has(p.name)&&p.present!==false&&isAvailable(p.name,date)).sort((a,b)=>{
      const ca=ctr.get(a.name)||{umpire:0,line:0,total:0},cb=ctr.get(b.name)||{umpire:0,line:0,total:0};
      return ca[metric]-cb[metric]||ca.total-cb.total||a.name.localeCompare(b.name);
    })[0]||null;
  }
  function build(){
    if(typeof state==='undefined'||!state)return;
    const events=(state.events||[]).filter(e=>e.type==='Officiating').sort((a,b)=>((a.date||'')+(a.time||'')).localeCompare((b.date||'')+(b.time||'')));
    if(!events.length){alert('No officiating slots are on the schedule yet.');return;}
    const roster=(state.players||[]).filter(p=>p.present!==false);
    const activeUmpires=roster.filter(p=>rolesOf(p).includes('Umpire')&&!p.officiatingBackupOnly);
    const backupUmpires=roster.filter(p=>rolesOf(p).includes('Umpire')&&p.officiatingBackupOnly);
    if(!activeUmpires.length&&!backupUmpires.length){alert('Add the Umpire role to at least one player first.');return;}
    const ctr=counts();let changed=0;
    events.forEach(e=>{
      const used=new Set([e.umpire,e.lineRef1,e.lineRef2].filter(Boolean));
      if(!e.umpire){
        let pick=choose(activeUmpires,used,'umpire',e.date,ctr);
        if(!pick)pick=choose(backupUmpires,used,'umpire',e.date,ctr);
        if(pick){e.umpire=pick.name;used.add(pick.name);const c=ctr.get(pick.name);c.umpire++;c.total++;changed++;}
      }
      for(const key of ['lineRef1','lineRef2']){
        if(e[key])continue;
        const pick=choose(roster,used,'line',e.date,ctr);
        if(pick){e[key]=pick.name;used.add(pick.name);const c=ctr.get(pick.name);c.line++;c.total++;changed++;}
      }
    });
    if(!changed){alert('All officiating slots already have assignments. Nothing was changed.');return;}
    if(typeof queueSave==='function')queueSave();
    if(typeof renderEvents==='function')renderEvents();
    if(typeof renderTracker==='function')renderTracker();
    renderPanel();
  }
  function renderPanel(){
    const section=document.getElementById('officials');if(!section||typeof state==='undefined'||!state)return;
    let panel=document.getElementById('fairOfficiatingRotation');
    if(!panel){panel=document.createElement('div');panel.id='fairOfficiatingRotation';panel.className='card';section.prepend(panel);}
    const umpires=(state.players||[]).filter(p=>rolesOf(p).includes('Umpire'));
    const ctr=counts();
    panel.innerHTML='<div class="row wrap"><div><strong>Fair Officiating Rotation</strong><div class="muted">Fills only unassigned duties. Manual assignments stay untouched. Umpires rotate through qualified players; line refs rotate across available players.</div></div><button id="buildOfficiatingRotation" class="primary">Fill Fair Rotation</button></div><div class="officiating-pool">'+(umpires.length?umpires.map(p=>'<span class="pill">'+esc(p.name)+' • '+(ctr.get(p.name)?.umpire||0)+' ump'+(p.officiatingBackupOnly?' • backup':'')+'</span>').join(' '):'<span class="muted">No umpire roles set yet.</span>')+'</div>';
    panel.querySelector('#buildOfficiatingRotation').onclick=build;
  }
  const style=document.createElement('style');style.textContent='.officiating-pool{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}';document.head.appendChild(style);
  const timer=setInterval(()=>{if(typeof state!=='undefined'&&state&&document.getElementById('officials'))renderPanel()},300);setTimeout(()=>clearInterval(timer),30000);
  window.addEventListener('buntpreferrednamesrefresh',renderPanel);
})();
