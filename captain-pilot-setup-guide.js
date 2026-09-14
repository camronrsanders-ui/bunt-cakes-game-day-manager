(()=>{
  if(window.__feildhausCaptainSetupGuideInstalled)return;
  window.__feildhausCaptainSetupGuideInstalled=true;
  const founder='those-dirty-bunt-cakes';
  const slug=String(window.__teamSlug||'');
  if(!slug||slug===founder||!location.pathname.startsWith('/captain/'))return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function upcomingGame(){
    const today=new Date().toLocaleDateString('en-CA',{timeZone:state?.team?.timeZone||'UTC'});
    return (state?.events||[]).some(e=>e&&e.type==='Game'&&e.date&&e.date>=today);
  }
  function hasFieldPlan(){
    return Object.values(state?.innings||{}).some(inn=>inn&&Object.values(inn).some(Boolean));
  }
  function steps(){
    return [
      {key:'profile',label:'Add team name & branding',done:!!String(state?.team?.name||state?.team?.shortName||'').trim(),tab:'team-settings'},
      {key:'roster',label:'Add your roster',done:Array.isArray(state?.players)&&state.players.length>0,tab:'roster'},
      {key:'schedule',label:'Add an upcoming game',done:upcomingGame(),tab:'schedule'},
      {key:'field',label:'Build your first field plan',done:hasFieldPlan(),tab:'pods'},
      {key:'share',label:'Share the Player View',done:Object.values(state?.appAccess||{}).some(x=>x&&x.lastSeenAt),tab:'access'}
    ];
  }
  function openTab(tab){
    const b=document.querySelector('#manager .tabs [data-tab="'+tab+'"]');
    if(b){b.click();setTimeout(()=>b.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}),20);}
  }
  function mount(){
    if(typeof state==='undefined'||!state)return false;
    const dash=document.getElementById('dashboard');if(!dash)return false;
    const all=steps(),done=all.filter(s=>s.done).length;
    let card=document.getElementById('feildhausCaptainSetupGuide');
    if(done===all.length){if(card)card.remove();return true;}
    if(!card){
      card=document.createElement('div');
      card.id='feildhausCaptainSetupGuide';
      card.className='card';
      card.style.border='2px solid #35e6ae';
      card.style.background='linear-gradient(135deg,#f0fdf9,#ffffff)';
      dash.prepend(card);
    }
    card.innerHTML='<div class="row wrap"><div><div class="muted" style="font-weight:900;letter-spacing:.08em">FOUNDING TEAMS PILOT</div><strong style="font-size:1.1rem">Get this Haus ready for game day</strong><div class="muted">'+done+' of '+all.length+' setup steps complete. This guide disappears when you are ready. <a href="/pilot-guide.html" target="_blank" rel="noopener">Quick Start ↗</a></div></div><span class="pill">'+Math.round(done/all.length*100)+'%</span></div><div style="display:grid;gap:7px;margin-top:12px">'+all.map(s=>'<button type="button" data-setup-tab="'+esc(s.tab)+'" style="display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;'+(s.done?'opacity:.72;background:#ecfdf5':'')+'"><span>'+(s.done?'✅':'○')+' '+esc(s.label)+'</span><span class="muted">'+(s.done?'Done':'Open')+'</span></button>').join('')+'</div>';
    card.querySelectorAll('[data-setup-tab]').forEach(b=>b.onclick=()=>openTab(b.dataset.setupTab));
    return true;
  }
  const timer=setInterval(()=>{if(mount())clearInterval(timer)},200);
  setTimeout(()=>clearInterval(timer),30000);
  window.addEventListener('buntpreferrednamesrefresh',mount);
  window.addEventListener('focus',mount);
  window.addEventListener('teamlivestatechange',mount);
})();