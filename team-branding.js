(()=>{
  const DEFAULT_TEAM={name:'',shortName:'',organization:'',sport:'Kickball',location:'',primaryColor:'#15803d',accentColor:'#f7fff8',logoDataUrl:'',logoUrl:'',chatUrl:'',announcement:'',arrivalMinutes:60,secondReminderMinutes:30,leagueAppsEnabled:false,timeZone:'America/New_York'};
  const DEFAULT_VIS={schedule:true,lineup:true,pods:true,kicking:true,officials:true,resources:true,attendance:true};
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeExternalUrl=value=>{const raw=String(value||'').trim();if(!raw)return'';try{const parsed=new URL(raw);return parsed.protocol==='https:'||parsed.protocol==='http:'?parsed.href:''}catch(_){return''}};
  const $id=id=>document.getElementById(id);
  let lastKey='';

  function teamSlug(){return window.__teamSlug||'those-dirty-bunt-cakes'}
  function cfg(){const t={...DEFAULT_TEAM,...((typeof state!=='undefined'&&state&&state.team)||{})};const v={...DEFAULT_VIS,...((typeof state!=='undefined'&&state&&state.playerVisibility)||{})};return{t,v}}
  function logoSrc(t){return t.logoDataUrl||t.logoUrl||'/generic-team-icon.svg'}
  function applyColors(t){document.documentElement.style.setProperty('--a',t.primaryColor||'#15803d');document.documentElement.style.setProperty('--bg',t.accentColor||'#f7fff8');const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.content=t.primaryColor||'#15803d'}
  function applyHeader(t){
    const name=t.name||'Your Team',short=t.shortName||name,slug=teamSlug();
    document.title=name+' Game Day';
    const h=document.querySelector('.brand h1');if(h)h.textContent=name;
    const sub=document.querySelector('.brand .muted');if(sub)sub.textContent=[t.organization,t.sport,t.location].filter(Boolean).join(' • ')||'Live Team View';
    document.querySelectorAll('.brand-logo,.install-logo').forEach(img=>{img.src=logoSrc(t);img.alt=name+' logo'});
    const installTitle=$id('installTitle');if(installTitle)installTitle.textContent=`Put ${short} on your Home Screen`;
    const firstScore=document.querySelector('#home .grid.g3 .card .muted');if(firstScore)firstScore.textContent=short;
    const manifest=document.querySelector('link[rel="manifest"]');if(manifest)manifest.href=`/api/team-state?team=${encodeURIComponent(slug)}&manifest=1`;
    const touch=document.querySelector('link[rel="apple-touch-icon"]');if(touch)touch.href=`/api/team-state?team=${encodeURIComponent(slug)}&logo=1`;
    document.querySelectorAll('.reminder-actions a').forEach((a,i)=>{a.href=i===0?`webcal://${location.host}/calendar/${slug}.ics`:`/calendar/${slug}.ics`});
  }
  function applyChat(t){
    const safeUrl=safeExternalUrl(t.chatUrl);
    const links=document.querySelectorAll('.chat-btn');links.forEach(a=>{if(safeUrl){a.href=safeUrl;a.style.display='';a.textContent='Open Team Chat'}else{a.removeAttribute('href');a.style.display='none'}});
    document.querySelectorAll('.chat-card').forEach(card=>{card.style.display=safeUrl?'':'none';const h=card.querySelector('h2');if(h)h.textContent=(t.shortName||t.name||'Team')+' Chat'});
  }
  function applyAnnouncement(t){
    const home=$id('home');if(!home)return;
    let box=$id('captainAnnouncement');
    if(!t.announcement){if(box)box.remove();return}
    if(!box){box=document.createElement('div');box.id='captainAnnouncement';box.className='card';box.style.border='2px solid var(--a)';box.style.background='#fff';home.prepend(box)}
    box.innerHTML='<div class="muted">CAPTAIN ANNOUNCEMENT</div><strong>'+esc(t.announcement)+'</strong>';
  }
  function applyReminderCard(t){
    const card=document.querySelector('.reminder-card');if(!card)return;
    const h=card.querySelector('h2');if(h)h.textContent=t.arrivalMinutes?`Arrive ${t.arrivalMinutes} minutes before every game`:'Game reminders';
    const body=[...card.children].find(x=>x.tagName==='DIV'&&!x.classList.contains('muted')&&!x.classList.contains('reminder-actions'));
    if(body)body.textContent=t.arrivalMinutes?`Players should be at the field ${t.arrivalMinutes} minutes before game time. Calendar reminders use the team settings selected by the captain.`:'Use the calendar reminder button below for game-time alerts.';
  }
  function applyResources(t,v){
    const section=$id('resources');if(!section)return;
    if(v.resources===false)return;
    if(!Array.isArray(state.resources))return;
    const resources=state.resources.map(r=>r&&r.title?{...r,safeUrl:safeExternalUrl(r.url)}:null).filter(r=>r&&r.safeUrl);
    section.innerHTML='<div class="card"><strong>Team Resources</strong><div class="muted">Links selected by your captain.</div></div><div class="grid g2" id="dynamicResourceGrid"></div>';
    const grid=$id('dynamicResourceGrid');
    grid.innerHTML=resources.length?resources.map(r=>`<a class="card resource" target="_blank" rel="noopener" href="${esc(r.safeUrl)}"><strong>${esc(r.title)}</strong><div class="muted">${esc(r.description||'Open team resource')}</div><div class="go">Open resource ↗</div></a>`).join(''):'<div class="card muted">No resources have been added yet.</div>';
  }
  function applyVisibility(v){
    const map={schedule:'schedule',lineup:'lineup',pods:'pods',kicking:'kicking',officials:'officials',resources:'resources'};
    Object.entries(map).forEach(([key,id])=>{const btn=document.querySelector(`.tabs button[data-tab="${id}"]`),section=$id(id),show=v[key]!==false;if(btn)btn.style.display=show?'':'none';if(section&&!show)section.classList.add('hidden')});
    const attendance=$id('weeklyAttendanceCard');if(attendance)attendance.style.display=v.attendance===false?'none':'';
    const active=document.querySelector('.tabs button.on');if(active&&active.style.display==='none'){const home=document.querySelector('.tabs button[data-tab="home"]');if(home)home.click()}
  }
  function overrideArrivalMath(){
    if(typeof minusMinutes!=='function'||minusMinutes.__teamAware)return;
    const fn=function(t,mins){if(!t)return'';const use=Math.max(0,Number(cfg().t.arrivalMinutes ?? mins ??60));const [h,m]=t.split(':').map(Number);let total=h*60+m-use;while(total<0)total+=1440;const hh=Math.floor(total/60)%24,mm=total%60;return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0')};fn.__teamAware=true;minusMinutes=fn;
  }
  function applyAll(force=false){
    if(typeof state==='undefined'||!state)return;
    const {t,v}=cfg(),key=JSON.stringify({t,v,r:state.resources||[]});if(!force&&key===lastKey)return;lastKey=key;
    applyColors(t);applyHeader(t);applyChat(t);applyAnnouncement(t);applyReminderCard(t);applyResources(t,v);applyVisibility(v);overrideArrivalMath();
    if(typeof renderNext==='function')renderNext();if(typeof renderEvents==='function')renderEvents();
  }
  const wait=setInterval(()=>{if(typeof state==='undefined'||!state||!document.querySelector('.brand'))return;clearInterval(wait);applyAll(true);setInterval(()=>applyAll(false),1500)},150);
  window.addEventListener('buntpreferrednamesrefresh',()=>applyAll(true));
  window.addEventListener('pageshow',()=>applyAll(true));
})();
