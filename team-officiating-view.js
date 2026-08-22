(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const isCaptain=()=>!!document.getElementById('manager');
  const localDate=()=>new Date().toLocaleDateString('en-CA',{timeZone:(typeof state!=='undefined'&&state?.team?.timeZone)||'America/New_York'});
  const time12=t=>{if(!t)return'Time TBD';const [h,m]=String(t).split(':').map(Number);return new Date(2000,0,1,h,m||0).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})};
  const dateLabel=d=>{if(!d)return'Date TBD';return new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})};

  function assignments(){
    if(typeof state==='undefined'||!state)return[];
    return (state.events||[]).filter(e=>e&&e.type==='Officiating').sort((a,b)=>((a.date||'9999-12-31')+(a.time||'')).localeCompare((b.date||'9999-12-31')+(b.time||'')));
  }
  function assignedNames(e){
    return [
      e.umpire&&{role:'Umpire',name:e.umpire},
      e.lineRef1&&{role:'Line Ref 1',name:e.lineRef1},
      e.lineRef2&&{role:'Line Ref 2',name:e.lineRef2}
    ].filter(Boolean);
  }
  function renderCards(){
    const section=document.getElementById('officials');
    const tracker=document.getElementById('tracker');
    if(!section||!tracker)return;
    let box=document.getElementById('officiatingAssignments');
    if(!box){
      box=document.createElement('div');
      box.id='officiatingAssignments';
      box.className='officiating-assignments';
      tracker.closest('.card')?.insertAdjacentElement('beforebegin',box);
    }
    const today=localDate();
    const all=assignments();
    const upcoming=all.filter(e=>!e.date||e.date>=today);
    const current=upcoming.length?upcoming:all.slice(-3);
    if(!current.length){
      box.innerHTML='<div class="card officiating-summary-card"><strong>No officiating slots posted yet.</strong><div class="muted">Assignments will appear here when your captain posts them.</div></div>';
      return;
    }
    box.innerHTML='<div class="card officiating-summary-card"><div class="officiating-heading"><div><div class="officiating-kicker">'+(upcoming.length?'UPCOMING OFFICIATING':'RECENT OFFICIATING')+'</div><strong>Who is working each slot</strong><div class="muted">'+(isCaptain()?'Edits made in Schedule save live to the team view.':'This updates automatically when a captain changes an assignment.')+'</div></div><span class="pill">'+current.length+' '+(current.length===1?'slot':'slots')+'</span></div></div>'+current.map(e=>{
      const people=assignedNames(e);
      return '<div class="card officiating-slot"><div class="officiating-slot-top"><div><strong>'+esc(dateLabel(e.date))+'</strong><div class="muted">'+esc(time12(e.time))+(e.location?' • '+esc(e.location):'')+'</div></div><span class="type-chip type-officiating">OFFICIATING</span></div><div class="officiating-roles">'+(people.length?people.map(p=>'<div class="officiating-role"><span>'+esc(p.role)+'</span><strong>'+esc(p.name)+'</strong></div>').join(''):'<div class="officiating-unassigned">Assignments not set yet.</div>')+'</div></div>';
    }).join('');
  }
  function install(){
    if(typeof renderTracker==='function'&&!window.__officiatingTrackerWrapped){
      window.__officiatingTrackerWrapped=true;
      const original=renderTracker;
      renderTracker=function(){const result=original.apply(this,arguments);renderCards();return result;};
      try{window.renderTracker=renderTracker}catch(_){}
    }
    renderCards();
  }
  const timer=setInterval(()=>{if(typeof state!=='undefined'&&state&&document.getElementById('officials'))install()},350);
  setTimeout(()=>clearInterval(timer),20000);
  window.addEventListener('focus',renderCards);
  window.addEventListener('buntpreferrednamesrefresh',renderCards);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderCards()});
})();