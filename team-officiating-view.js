(()=>{
  const TEAM_OFFICIATING_STYLE_ID='team-officiating-mobile-fit';
  function ensureOfficiatingStyles(){
    if(document.getElementById(TEAM_OFFICIATING_STYLE_ID))return;
    const style=document.createElement('style');style.id=TEAM_OFFICIATING_STYLE_ID;style.textContent=`
      #officials{min-width:0;overflow-x:hidden}
      #officials .card{min-width:0;max-width:100%}
      #officials .table{overflow:visible;max-width:100%}
      #officials .tr{min-width:0;width:100%;grid-template-columns:minmax(0,1.45fr) repeat(4,minmax(48px,.62fr));gap:6px;padding:9px 6px;align-items:center}
      #officials .tr>div{min-width:0;overflow-wrap:anywhere}
      .officiating-assignments{display:grid;gap:10px;min-width:0}
      .officiating-heading,.officiating-slot-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0}
      .officiating-heading>div,.officiating-slot-top>div{min-width:0}
      .officiating-kicker{font-size:.72rem;font-weight:900;letter-spacing:.1em;color:#b45309;margin-bottom:3px}
      .officiating-roles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}
      .officiating-role,.officiating-unassigned{min-width:0;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:9px 10px}
      .officiating-role span{display:block;color:#9a3412;font-size:.72rem;font-weight:850;text-transform:uppercase;letter-spacing:.05em}
      .officiating-role strong{display:block;margin-top:2px;overflow-wrap:anywhere}
      @media(max-width:650px){
        #officials .tr{grid-template-columns:minmax(0,1.35fr) repeat(4,minmax(38px,.55fr));font-size:.78rem;gap:4px;padding:8px 3px}
        #officials .tr.head{font-size:.68rem}
        #officials .num{font-variant-numeric:tabular-nums}
        .officiating-roles{grid-template-columns:1fr}
        .officiating-heading,.officiating-slot-top{align-items:flex-start}
      }
      @media(max-width:390px){
        #officials .tr{grid-template-columns:minmax(0,1.25fr) repeat(4,minmax(32px,.5fr));font-size:.72rem}
        #officials .tr.head{font-size:.62rem}
        #officials .pill,#officials .type-chip{font-size:.62rem;padding:3px 6px}
      }
    `;document.head.appendChild(style);
  }
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
  function preserveViewport(update){
    const scrolling=document.scrollingElement;
    const top=scrolling?scrolling.scrollTop:(window.scrollY||0),left=scrolling?scrolling.scrollLeft:(window.scrollX||0);
    const active=document.activeElement;
    update();
    const restore=()=>{
      if(scrolling){scrolling.scrollTop=top;scrolling.scrollLeft=left;}
      else if(typeof window.scrollTo==='function')window.scrollTo(left,top);
      if(active&&active.isConnected&&typeof active.focus==='function')try{active.focus({preventScroll:true});}catch(_){active.focus();}
    };
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(restore);else setTimeout(restore,0);
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
      preserveViewport(()=>tracker.closest('.card')?.insertAdjacentElement('beforebegin',box));
    }
    const today=localDate();
    const all=assignments();
    const fingerprint=JSON.stringify({events:all,availability:state.availability,players:state.players});
    if(box.dataset.fingerprint===fingerprint)return;
    box.dataset.fingerprint=fingerprint;
    const upcoming=all.filter(e=>!e.date||e.date>=today);
    const current=upcoming.length?upcoming:all.slice(-3);
    if(!current.length){
      preserveViewport(()=>{box.innerHTML='<div class="card officiating-summary-card"><strong>No officiating slots posted yet.</strong><div class="muted">Assignments will appear here when your captain posts them.</div></div>';});
      return;
    }
    preserveViewport(()=>{box.innerHTML='<div class="card officiating-summary-card"><div class="officiating-heading"><div><div class="officiating-kicker">'+(upcoming.length?'UPCOMING OFFICIATING':'RECENT OFFICIATING')+'</div><strong>Who is working each slot</strong><div class="muted">'+(isCaptain()?'Edits made in Schedule save live to the team view.':'This updates automatically when a captain changes an assignment.')+'</div></div><span class="pill">'+current.length+' '+(current.length===1?'slot':'slots')+'</span></div></div>'+current.map(e=>{
      const people=assignedNames(e);
      return '<div class="card officiating-slot"><div class="officiating-slot-top"><div><strong>'+esc(dateLabel(e.date))+'</strong><div class="muted">'+esc(time12(e.time))+(e.location?' • '+esc(e.location):'')+'</div></div><span class="type-chip type-officiating">OFFICIATING</span></div><div class="officiating-roles">'+(people.length?people.map(p=>'<div class="officiating-role"><span>'+esc(p.role)+'</span><strong>'+esc(p.name)+'</strong></div>').join(''):'<div class="officiating-unassigned">Assignments not set yet.</div>')+'</div></div>';
    }).join('');});
  }
  function install(){
    ensureOfficiatingStyles();
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
  window.addEventListener('teamlivestatechange',renderCards);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderCards()});
})();
