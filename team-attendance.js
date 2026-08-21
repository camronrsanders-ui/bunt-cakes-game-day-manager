(function(){
  const STYLE_ID='bunt-attendance-style';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .attendance-card{border:2px solid #86efac;background:#f0fdf4}
      .attendance-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
      .attendance-badge{display:inline-block;border-radius:999px;padding:5px 9px;background:var(--a,#15803d);color:#fff;font-size:.76rem;font-weight:900}
      .attendance-games{margin:9px 0;padding:10px;background:#fff;border:1px solid #bbf7d0;border-radius:12px}
      .attendance-answer{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
      .attendance-answer button{font-weight:900;background:#fff}.attendance-answer button.on{background:var(--a,#15803d);color:#fff;border-color:var(--a,#15803d)}
      .attendance-answer button.no.on{background:#b91c1c;border-color:#b91c1c}.attendance-answer button.maybe.on{background:#a16207;border-color:#a16207}
      .attendance-player{margin-top:9px}.attendance-saved{font-weight:800;color:#166534;margin-top:8px}
      .attendance-notify{margin-top:12px;padding:12px;border:2px solid #bbf7d0;border-radius:14px;background:#fff}
      .attendance-notify strong{display:block;font-size:1.05rem;margin-bottom:3px}.attendance-notify button{width:100%;font-weight:900;margin-top:9px;background:var(--a,#15803d);color:#fff;border-color:var(--a,#15803d)}
      .attendance-notify button:disabled{opacity:.7}
      @media(max-width:430px){.attendance-answer{grid-template-columns:1fr}.attendance-answer button{width:100%}}
    `;document.head.appendChild(style);
  }

  const esc=v=>String(v??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
  const key=n=>window.__teamStorageKey?window.__teamStorageKey(n):'teamgameday:'+n;
  const zone=()=>state?.team?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:zone()});
  const time12=t=>{if(!t)return'';const [h,m]=t.split(':').map(Number);return new Date(2000,0,1,h,m||0).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})};
  let working=false;

  function playerName(){return new URLSearchParams(location.search).get('player')||localStorage.getItem(key('playerName'))||''}
  function setPlayer(name){if(!name)return;localStorage.setItem(key('playerName'),name);const u=new URL(location.href);u.searchParams.set('player',name);history.replaceState(null,'',u.pathname+u.search+u.hash);renderCard();syncExistingSubscription()}
  function sundayDates(){const t=today(),events=Array.isArray(state?.events)?state.events:[];return[...new Set(events.filter(e=>e&&e.type==='Game'&&e.date&&e.date>=t).map(e=>e.date).filter(d=>new Date(d+'T12:00:00').getDay()===0))].sort()}
  function targetDate(){const requested=new URLSearchParams(location.search).get('availability'),dates=sundayDates();return requested&&dates.includes(requested)?requested:(dates[0]||'')}
  function gamesFor(date){return(state?.events||[]).filter(e=>e&&e.type==='Game'&&e.date===date).sort((a,b)=>(a.time||'').localeCompare(b.time||''))}
  function prettyDate(date){return new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
  function responseFor(date,name){return state?.availability?.[date]?.[name]?.status||''}
  function statusLabel(v){return v==='yes'?'Yes':v==='no'?'No':v==='not_sure'?'Not sure':''}
  function playerOptions(current){const players=(state?.players||[]).slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));return'<option value="">Choose your name</option>'+players.map(p=>'<option value="'+esc(p.name)+'" '+(p.name===current?'selected':'')+'>'+esc(p.fullName||p.name)+'</option>').join('')}
  function mount(){const home=document.getElementById('home');if(!home)return null;let card=document.getElementById('weeklyAttendanceCard');if(!card){card=document.createElement('div');card.id='weeklyAttendanceCard';card.className='card attendance-card';const reminder=home.querySelector('.reminder-card');if(reminder)reminder.insertAdjacentElement('beforebegin',card);else home.prepend(card)}return card}
  function notificationBlock(){return '<div class="attendance-notify"><strong>🔔 Thursday availability reminders</strong><div id="attendanceNotifyText" class="muted">Get a reminder each Thursday when you need to RSVP for Sunday.</div><button id="enableAttendancePush">Set Up Thursday Notifications</button></div>'}

  function renderCard(){
    if(typeof state==='undefined'||!state)return;const card=mount();if(!card)return;const date=targetDate(),name=playerName();
    if(!date){
      card.innerHTML='<div class="attendance-head"><div><div class="muted">WEEKLY GAME CHECK-IN</div><h2 style="margin:.25rem 0">Sunday Availability</h2><div class="muted">No upcoming Sunday game is posted yet.</div></div></div>'+(name?'':'<div class="attendance-player"><strong>Choose your name:</strong><select id="attendancePlayer">'+playerOptions(name)+'</select></div>')+notificationBlock();
      bindCard();return;
    }
    const games=gamesFor(date),answer=name?responseFor(date,name):'';
    const gameText=games.map(g=>'<div><strong>'+time12(g.time)+'</strong> — '+esc(g.title||'Game')+'</div>').join('');
    card.innerHTML=`<div class="attendance-head"><div><div class="muted">WEEKLY GAME CHECK-IN</div><h2 style="margin:.25rem 0">Will you be there Sunday?</h2><div>${esc(prettyDate(date))}</div></div><span class="attendance-badge">LINEUP RSVP</span></div><div class="attendance-games">${gameText}</div>${name?'<div><strong>'+esc(name)+', choose your answer:</strong></div>':'<div><strong>Choose your name first:</strong></div>'}${name?`<div class="attendance-answer"><button data-answer="yes" class="${answer==='yes'?'on':''}">✅ Yes</button><button data-answer="no" class="no ${answer==='no'?'on':''}">❌ No</button><button data-answer="not_sure" class="maybe ${answer==='not_sure'?'on':''}">🤔 Not sure</button></div>`:`<div class="attendance-player"><select id="attendancePlayer">${playerOptions(name)}</select></div>`}${answer?'<div class="attendance-saved">Saved: '+statusLabel(answer)+' • Captain View updates automatically.</div>':''}${notificationBlock()}`;
    bindCard();
    if(new URLSearchParams(location.search).get('availability')===date)setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'center'}),150)
  }

  function bindCard(){
    const sel=document.getElementById('attendancePlayer');if(sel)sel.onchange=()=>setPlayer(sel.value);
    document.querySelectorAll('#weeklyAttendanceCard [data-answer]').forEach(btn=>btn.onclick=()=>saveAnswer(btn.dataset.answer));
    const push=document.getElementById('enableAttendancePush');if(push)push.onclick=enablePush;
    refreshPushStatus();
  }

  async function saveAnswer(status){const name=playerName(),date=targetDate();if(!name||!date||working)return;working=true;try{const r=await fetch('/api/team-state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'attendance-response',playerName:name,gameDate:date,status})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not save attendance');state.availability=state.availability||{};state.availability[date]=state.availability[date]||{};state.availability[date][name]={status,respondedAt:j.respondedAt};renderCard()}catch(e){alert(e.message||'Could not save your answer')}finally{working=false}}
  function b64ToBytes(value){const pad='='.repeat((4-value.length%4)%4),base64=(value+pad).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
  function standalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
  async function registration(){if(!('serviceWorker'in navigator))throw new Error('Push notifications are not supported on this device');return navigator.serviceWorker.register('/service-worker.js').then(()=>navigator.serviceWorker.ready)}
  async function postSubscription(sub){const name=playerName();if(!name)throw new Error('Choose your name first');const r=await fetch('/api/team-state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'subscribe',playerName:name,subscription:sub.toJSON()})});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||'Could not save reminder settings')}}
  async function syncExistingSubscription(){try{if(!playerName()||!('PushManager'in window))return;const reg=await registration(),sub=await reg.pushManager.getSubscription();if(sub)await postSubscription(sub)}catch(e){}}

  async function pushState(){
    const supported=('Notification'in window)&&('PushManager'in window)&&('serviceWorker'in navigator);
    if(!supported)return{supported:false,standalone:standalone(),permission:'unsupported',subscribed:false};
    let subscribed=false;try{const reg=await registration();subscribed=!!(await reg.pushManager.getSubscription())}catch(e){}
    return{supported:true,standalone:standalone(),permission:Notification.permission,subscribed};
  }

  async function refreshPushStatus(){
    const text=document.getElementById('attendanceNotifyText'),btn=document.getElementById('enableAttendancePush');if(!text||!btn)return;
    const status=await pushState(),isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    if(!status.supported){text.textContent='This browser does not support web push reminders.';btn.textContent='Notifications unavailable';btn.disabled=true;return}
    if(isIOS&&!status.standalone){text.textContent='On iPhone: add this app to your Home Screen, then OPEN THE NEW ICON. The notification permission button appears there.';btn.textContent='Show Home Screen Setup';btn.disabled=false;return}
    if(status.subscribed&&status.permission==='granted'){text.textContent='Thursday push reminders are ON for this phone.';btn.textContent='✓ Thursday Notifications On';btn.disabled=true;return}
    if(status.permission==='denied'){text.textContent='Notifications are blocked for this app. Re-enable them in your phone settings, then reopen the app.';btn.textContent='Notifications Blocked';btn.disabled=true;return}
    text.textContent='One tap will ask your phone for permission, then Thursday reminders will be enabled.';btn.textContent='Turn On Thursday Notifications';btn.disabled=false;
  }

  async function enablePush(){
    const name=playerName();if(!name){alert('Choose your name first.');return false}
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    if(isIOS&&!standalone()){
      if(typeof window.teamGameDayShowInstallGuide==='function')window.teamGameDayShowInstallGuide();
      else alert('On iPhone, use Share → Add to Home Screen, then open the new team app icon. You can enable notifications from there.');
      return false;
    }
    const btn=document.getElementById('enableAttendancePush');if(btn){btn.disabled=true;btn.textContent='Turning on…'}
    try{
      if(!('Notification'in window)||!('PushManager'in window))throw new Error('Push notifications are not supported in this browser');
      const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Notifications were not allowed');
      const config=await fetch('/api/team-state?pushConfig=1',{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not load push setup');return j});
      const reg=await registration();let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(config.publicKey)});
      await postSubscription(sub);await refreshPushStatus();window.dispatchEvent(new Event('teamgamedaypushenabled'));return true;
    }catch(e){alert(e.message||'Could not enable reminders');if(btn){btn.disabled=false;btn.textContent='Turn On Thursday Notifications'}return false}
  }

  window.teamGameDayEnablePush=enablePush;
  window.teamGameDayPushState=pushState;
  window.teamGameDayRenderAttendance=renderCard;

  const wait=setInterval(()=>{if(typeof state==='undefined'||!state||!document.getElementById('home'))return;clearInterval(wait);renderCard();syncExistingSubscription();setInterval(()=>{renderCard()},3000)},250);
  window.addEventListener('pageshow',renderCard);
})();