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
      .attendance-saved{font-weight:800;color:#166534;margin-top:8px}
      .attendance-future{margin-top:14px;padding-top:12px;border-top:1px solid #bbf7d0}.attendance-future h3{margin:.2rem 0}.attendance-future-list{display:grid;gap:9px;margin-top:9px}
      .attendance-future-row{background:#fff;border:1px solid #d1fae5;border-radius:13px;padding:10px}.attendance-future-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.attendance-future-games{font-size:.86rem;color:#6b7280;margin-top:3px}
      .attendance-future-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}.attendance-future-actions button{padding:8px;font-weight:800}.attendance-future-actions button.on{background:var(--a,#15803d);color:#fff}.attendance-future-actions button.no.on{background:#b91c1c;border-color:#b91c1c}.attendance-future-actions button.maybe.on{background:#a16207;border-color:#a16207}
      .attendance-notify{margin-top:12px;padding:12px;border:2px solid #bbf7d0;border-radius:14px;background:#fff}
      .attendance-notify strong{display:block;font-size:1.05rem;margin-bottom:3px}.attendance-notify button{width:100%;font-weight:900;margin-top:9px;background:var(--a,#15803d);color:#fff;border-color:var(--a,#15803d)}
      .attendance-notify button:disabled{opacity:.7}.attendance-access-required{margin-top:10px;padding:12px;border:1px solid #f59e0b;border-radius:14px;background:#fffbeb;color:#92400e;font-weight:700}
      @media(max-width:430px){.attendance-answer,.attendance-future-actions{grid-template-columns:1fr}.attendance-answer button,.attendance-future-actions button{width:100%}}
    `;document.head.appendChild(style);
  }

  const esc=v=>String(v??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
  const zone=()=>state?.team?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:zone()});
  const time12=t=>{if(!t)return'';const [h,m]=t.split(':').map(Number);return new Date(2000,0,1,h,m||0).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})};
  let working=false,accessRejected=false;

  function playerAccess(){return state&&state.playerAccess&&typeof state.playerAccess==='object'?state.playerAccess:{paired:false}}
  function playerName(){if(accessRejected)return'';const access=playerAccess();return access.paired===true?String(access.playerName||'').trim():''}
  function sundayDates(){const t=today(),events=Array.isArray(state?.events)?state.events:[];return[...new Set(events.filter(e=>e&&e.type==='Game'&&e.date&&e.date>=t).map(e=>e.date).filter(d=>new Date(d+'T12:00:00').getDay()===0))].sort()}
  function targetDate(){const requested=new URLSearchParams(location.search).get('availability'),dates=sundayDates();return requested&&dates.includes(requested)?requested:(dates[0]||'')}
  function gamesFor(date){return(state?.events||[]).filter(e=>e&&e.type==='Game'&&e.date===date).sort((a,b)=>(a.time||'').localeCompare(b.time||''))}
  function prettyDate(date){return new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
  function responseFor(date,name){return state?.availability?.[date]?.[name]?.status||''}
  function statusLabel(v){return v==='yes'?'Going':v==='no'?'Opted out':v==='not_sure'?'Not sure':'No response'}
  function mount(){const home=document.getElementById('home');if(!home)return null;let card=document.getElementById('weeklyAttendanceCard');if(!card){card=document.createElement('div');card.id='weeklyAttendanceCard';card.className='card attendance-card';const reminder=home.querySelector('.reminder-card');if(reminder)reminder.insertAdjacentElement('beforebegin',card);else home.prepend(card)}return card}
  function notificationBlock(){return '<div class="attendance-notify"><strong>🔔 Thursday availability reminders</strong><div id="attendanceNotifyText" class="muted">Get a reminder each Thursday when you need to RSVP for Sunday.</div><button id="enableAttendancePush">Set Up Thursday Notifications</button></div>'}
  function accessRequiredBlock(){return accessRejected?'<div class="attendance-access-required"><strong>Player access needs to reconnect on this phone/app.</strong><div style="margin-top:6px">Ask your captain for a new setup link, then open that link in this same app or browser. You do not need a full access reset unless your captain specifically chooses one.</div></div>':'<div class="attendance-access-required">Player access needs to be set up. Ask your captain for your setup link.</div>'}
  function rejectAccess(){accessRejected=true;if(typeof state!=='undefined'&&state)state.playerAccess={paired:false};renderCard();window.dispatchEvent(new Event('teamplayeraccesschange'))}
  function answerButtons(date,answer,compact=false){
    const cls=compact?'attendance-future-actions':'attendance-answer';
    return `<div class="${cls}"><button data-answer="yes" data-date="${esc(date)}" class="${answer==='yes'?'on':''}">✅ ${compact?'Going':'Yes'}</button><button data-answer="no" data-date="${esc(date)}" class="no ${answer==='no'?'on':''}">❌ ${compact?'Opt out':'No'}</button><button data-answer="not_sure" data-date="${esc(date)}" class="maybe ${answer==='not_sure'?'on':''}">🤔 Not sure</button></div>`;
  }
  function futureBlock(name,currentDate){
    const dates=sundayDates().filter(d=>d!==currentDate);if(!dates.length)return'';
    return `<div class="attendance-future"><div class="muted">PLAN AHEAD</div><h3>Future game availability</h3><div class="muted">Opt out now for any future Sunday you already know you cannot attend. A No is date-specific and removes you from that date’s officiating pool.</div><div class="attendance-future-list">${dates.map(date=>{const answer=responseFor(date,name),games=gamesFor(date),times=games.map(g=>time12(g.time)).filter(Boolean).join(' & ');return `<div class="attendance-future-row"><div class="attendance-future-top"><div><strong>${esc(prettyDate(date))}</strong><div class="attendance-future-games">${esc(times||'Game time TBD')}</div></div><span class="pill">${esc(statusLabel(answer))}</span></div>${answerButtons(date,answer,true)}</div>`}).join('')}</div></div>`;
  }

  function renderCard(){
    if(typeof state==='undefined'||!state)return;const card=mount();if(!card)return;const date=targetDate(),name=playerName(),paired=!!name;
    if(!date){card.innerHTML='<div class="attendance-head"><div><div class="muted">GAME AVAILABILITY</div><h2 style="margin:.25rem 0">Sunday Availability</h2><div class="muted">No upcoming Sunday game is posted yet.</div></div></div>'+(paired?notificationBlock():accessRequiredBlock());bindCard();return;}
    const games=gamesFor(date),answer=paired?responseFor(date,name):'',gameText=games.map(g=>'<div><strong>'+time12(g.time)+'</strong> — '+esc(g.title||'Game')+'</div>').join('');
    card.innerHTML=`<div class="attendance-head"><div><div class="muted">NEXT GAME CHECK-IN</div><h2 style="margin:.25rem 0">Will you be there?</h2><div>${esc(prettyDate(date))}</div></div><span class="attendance-badge">GAME RSVP</span></div><div class="attendance-games">${gameText}</div>${paired?'<div><strong>'+esc(name)+', choose your answer:</strong></div>'+answerButtons(date,answer,false):accessRequiredBlock()}${answer?'<div class="attendance-saved">Saved: '+statusLabel(answer)+' • Captain View updates automatically.</div>':''}${paired?futureBlock(name,date)+notificationBlock():''}`;
    bindCard();
    if(new URLSearchParams(location.search).get('availability')===date)setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'center'}),150)
  }

  function bindCard(){document.querySelectorAll('#weeklyAttendanceCard [data-answer][data-date]').forEach(btn=>btn.onclick=()=>saveAnswer(btn.dataset.answer,btn.dataset.date));const push=document.getElementById('enableAttendancePush');if(push)push.onclick=enablePush;refreshPushStatus()}

  async function saveAnswer(status,date=targetDate()){
    const name=playerName();if(!name){renderCard();return}if(!date||working)return;working=true;
    try{
      const r=await fetch('/api/team-state',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'attendance-response',playerName:name,gameDate:date,status})});
      const j=await r.json().catch(()=>({}));if(r.status===401&&j&&j.playerAccessRequired){rejectAccess();return}if(!r.ok)throw new Error(j.error||'Could not save attendance');
      accessRejected=false;state.availability=state.availability||{};state.availability[date]=state.availability[date]||{};state.availability[date][name]={status,respondedAt:j.respondedAt};renderCard();
    }catch(e){alert(e.message||'Could not save your answer')}finally{working=false}
  }
  function b64ToBytes(value){const pad='='.repeat((4-value.length%4)%4),base64=(value+pad).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
  function standalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
  async function registration(){if(!('serviceWorker'in navigator))throw new Error('Push notifications are not supported on this device');return navigator.serviceWorker.register('/service-worker.js').then(()=>navigator.serviceWorker.ready)}
  async function postSubscription(sub){const name=playerName();if(!name)throw new Error('Player access needs to be set up. Ask your captain for your setup link.');const r=await fetch('/api/team-state',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'subscribe',playerName:name,subscription:sub.toJSON()})});if(!r.ok){const j=await r.json().catch(()=>({}));if(r.status===401&&j&&j.playerAccessRequired){rejectAccess();throw new Error('Player access needs to reconnect on this phone/app.')}throw new Error(j.error||'Could not save reminder settings')}}
  async function syncExistingSubscription(){try{if(!playerName()||!('PushManager'in window))return;const reg=await registration(),sub=await reg.pushManager.getSubscription();if(sub)await postSubscription(sub)}catch(e){}}

  async function pushState(){const supported=('Notification'in window)&&('PushManager'in window)&&('serviceWorker'in navigator);if(!supported)return{supported:false,standalone:standalone(),permission:'unsupported',subscribed:false};let subscribed=false;try{const reg=await registration();subscribed=!!(await reg.pushManager.getSubscription())}catch(e){}return{supported:true,standalone:standalone(),permission:Notification.permission,subscribed}}
  async function refreshPushStatus(){
    const text=document.getElementById('attendanceNotifyText'),btn=document.getElementById('enableAttendancePush');if(!text||!btn)return;if(!playerName()){text.textContent='Player access is required before notifications can be connected.';btn.textContent='Player access required';btn.disabled=true;return}
    const status=await pushState(),isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);if(!status.supported){text.textContent='This browser does not support web push reminders.';btn.textContent='Notifications unavailable';btn.disabled=true;return}
    if(isIOS&&!status.standalone){text.textContent='On iPhone: add this app to your Home Screen, then OPEN THE NEW ICON. The notification permission button appears there.';btn.textContent='Show Home Screen Setup';btn.disabled=false;return}
    if(status.subscribed&&status.permission==='granted'){text.textContent='Thursday push reminders are ON for this phone.';btn.textContent='✓ Thursday Notifications On';btn.disabled=true;return}
    if(status.permission==='denied'){text.textContent='Notifications are blocked for this app. Re-enable them in your phone settings, then reopen the app.';btn.textContent='Notifications Blocked';btn.disabled=true;return}
    text.textContent='One tap will ask your phone for permission, then Thursday reminders will be enabled.';btn.textContent='Turn On Thursday Notifications';btn.disabled=false;
  }
  async function enablePush(){
    const name=playerName();if(!name){renderCard();return false}const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);if(isIOS&&!standalone()){if(typeof window.teamGameDayShowInstallGuide==='function')window.teamGameDayShowInstallGuide();else alert('On iPhone, use Share → Add to Home Screen, then open the new team app icon. You can enable notifications from there.');return false}
    const btn=document.getElementById('enableAttendancePush');if(btn){btn.disabled=true;btn.textContent='Turning on…'}
    try{if(!('Notification'in window)||!('PushManager'in window))throw new Error('Push notifications are not supported in this browser');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Notifications were not allowed');const config=await fetch('/api/team-state?pushConfig=1',{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not load push setup');return j});const reg=await registration();let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(config.publicKey)});await postSubscription(sub);await refreshPushStatus();window.dispatchEvent(new Event('teamgamedaypushenabled'));return true}catch(e){alert(e.message||'Could not enable reminders');if(btn){btn.disabled=false;btn.textContent='Turn On Thursday Notifications'}return false}
  }

  window.teamGameDayEnablePush=enablePush;window.teamGameDayPushState=pushState;window.teamGameDayRenderAttendance=renderCard;
  const wait=setInterval(()=>{if(typeof state==='undefined'||!state||!document.getElementById('home'))return;clearInterval(wait);renderCard();syncExistingSubscription()},250);
  window.addEventListener('buntpreferrednamesrefresh',renderCard);window.addEventListener('teamplayeraccesschange',()=>{const access=playerAccess();if(access.paired===true)accessRejected=false;renderCard();if(playerName())syncExistingSubscription()});window.addEventListener('pageshow',renderCard);
})();
