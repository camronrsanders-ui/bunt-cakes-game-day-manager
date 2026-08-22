(()=>{
  if(!document.querySelector('link[data-premium-dashboard-style]')){
    const style=document.createElement('link');style.rel='stylesheet';style.href='/premium-dashboard.css?v=1';style.dataset.premiumDashboardStyle='1';document.head.appendChild(style);
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const storageKey=name=>window.__teamStorageKey?window.__teamStorageKey(name):'teamgameday:'+name;
  let currentScheduleFilter='all';

  function playerName(){
    return new URLSearchParams(location.search).get('player')||localStorage.getItem(storageKey('playerName'))||'';
  }
  function currentInning(){
    try{return Math.max(1,Math.min(7,Number(state?.gameInning||state?.fieldInning||1)))}catch(_){return 1}
  }
  function positionFor(name,inning){
    if(!name)return'';
    try{
      const inn=state?.innings?.[inning]||{};
      return Object.keys(inn).find(position=>inn[position]===name)||'Rest';
    }catch(_){return''}
  }

  function arrangePlayerHome(){
    const home=document.getElementById('home');
    if(!home||document.getElementById('manager'))return;
    const next=document.getElementById('next');
    const attendance=document.getElementById('weeklyAttendanceCard');
    const rotation=document.getElementById('nextSwap');
    const scoreGrid=home.querySelector(':scope > .grid.g3');
    const reminder=home.querySelector(':scope > .reminder-card');
    const chat=home.querySelector(':scope > .chat-card');
    const announcement=document.getElementById('captainAnnouncement');
    const lineup=[...home.children].find(el=>el.classList?.contains('card')&&el.querySelector('#homeLineup'));

    if(next){next.classList.add('premium-next-game');home.insertBefore(next,home.firstChild)}
    if(announcement){announcement.classList.add('premium-announcement');next?.insertAdjacentElement('afterend',announcement)}
    if(attendance){attendance.classList.add('premium-rsvp-card');(announcement||next)?.insertAdjacentElement('afterend',attendance)}
    if(rotation){rotation.classList.add('premium-next-rotation');(attendance||announcement||next)?.insertAdjacentElement('afterend',rotation)}
    if(scoreGrid){scoreGrid.classList.add('premium-live-strip');(rotation||attendance||announcement||next)?.insertAdjacentElement('afterend',scoreGrid)}
    if(reminder){reminder.classList.add('premium-game-reminders');scoreGrid?.insertAdjacentElement('afterend',reminder)}
    if(chat){chat.classList.add('premium-team-chat');reminder?.insertAdjacentElement('afterend',chat)}
    if(lineup){lineup.classList.add('premium-lineup-preview');home.appendChild(lineup)}
  }

  function renderPlayerPositionHero(){
    if(document.getElementById('manager'))return;
    const section=document.getElementById('lineup');
    if(!section||typeof state==='undefined'||!state)return;
    let hero=document.getElementById('premiumPlayerPosition');
    if(!hero){
      hero=document.createElement('div');hero.id='premiumPlayerPosition';hero.className='card premium-player-position';
      const first=section.firstElementChild;first?.insertAdjacentElement('afterend',hero);
    }
    const name=playerName(),inning=currentInning();
    if(!name){
      hero.innerHTML='<div><span class="premium-kicker">PLAYER VIEW</span><h2>Your live position</h2><p class="muted">Choose your name during app setup to highlight your assignment automatically.</p></div><div class="premium-inning-orb">'+inning+'</div>';
      return;
    }
    const now=positionFor(name,inning)||'Unassigned';
    const next=inning<7?positionFor(name,inning+1):'Final inning';
    hero.innerHTML=`<div><span class="premium-kicker">YOU ARE HERE • INNING ${inning}</span><h2>${esc(now)}</h2><div class="muted">${esc(name)}${inning<7?' • Next: '+esc(next):' • Final inning'}</div></div><div class="premium-inning-orb">${inning}</div>`;
  }

  function buildScheduleFilters(){
    if(document.getElementById('manager'))return;
    const schedule=document.getElementById('schedule');
    const events=document.getElementById('events');
    if(!schedule||!events)return;
    let filters=document.getElementById('premiumScheduleFilters');
    if(!filters){
      filters=document.createElement('div');filters.id='premiumScheduleFilters';filters.className='premium-schedule-filters';
      filters.innerHTML='<button data-filter="all" class="on">All</button><button data-filter="game">Games</button><button data-filter="officiating">Officiating</button><button data-filter="other">Events</button>';
      events.insertAdjacentElement('beforebegin',filters);
      filters.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
        currentScheduleFilter=btn.dataset.filter;
        filters.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===btn));
        applyScheduleFilter();
      });
    }
    applyScheduleFilter();
  }

  function applyScheduleFilter(){
    const events=document.getElementById('events');if(!events)return;
    events.querySelectorAll('.day-group').forEach(group=>{
      let visible=0;
      group.querySelectorAll('.event-row').forEach(row=>{
        const type=(row.querySelector('.type-chip')?.textContent||'').trim().toLowerCase();
        const show=currentScheduleFilter==='all'||
          (currentScheduleFilter==='game'&&type==='game')||
          (currentScheduleFilter==='officiating'&&type==='officiating')||
          (currentScheduleFilter==='other'&&type!=='game'&&type!=='officiating');
        row.style.display=show?'':'none';if(show)visible++;
      });
      group.style.display=visible?'':'none';
    });
  }

  function captainQuickActions(){
    const manager=document.getElementById('manager'),dash=document.getElementById('dashboard');
    if(!manager||!dash||manager.classList.contains('hidden'))return;
    const scoreGrid=dash.querySelector(':scope > .grid.g3');
    if(scoreGrid)scoreGrid.classList.add('premium-captain-scoreboard');
    const grids=dash.querySelectorAll(':scope > .grid.g3');
    if(grids[1])grids[1].classList.add('premium-count-strip');

    let quick=document.getElementById('premiumCaptainQuickActions');
    if(!quick){
      quick=document.createElement('div');quick.id='premiumCaptainQuickActions';quick.className='card premium-captain-actions';
      quick.innerHTML='<div class="row wrap"><div><span class="premium-kicker">GAME DAY CONTROL</span><h2>Quick actions</h2></div><span class="pill">Captain</span></div><div class="premium-action-grid"><button data-go="lineup">◇<strong>Edit lineup</strong><span>Set the live field</span></button><button data-go="schedule">▣<strong>Schedule</strong><span>Games & officiating</span></button><button data-go="pods">↻<strong>Rotation</strong><span>Plan seven innings</span></button><button data-go="dashboard" data-scroll="captainAttendance">✓<strong>Availability</strong><span>Sunday RSVP status</span></button></div>';
      scoreGrid?.insertAdjacentElement('afterend',quick);
      quick.querySelectorAll('[data-go]').forEach(btn=>btn.onclick=()=>{
        const tab=document.querySelector(`.tabs button[data-tab="${btn.dataset.go}"]`);
        if(tab)tab.click();
        const target=btn.dataset.scroll&&document.getElementById(btn.dataset.scroll);
        if(target)setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'start'}),50);
      });
    }
    const attendance=document.getElementById('captainAttendance');
    if(attendance){attendance.classList.add('premium-captain-attendance');quick?.insertAdjacentElement('afterend',attendance)}
  }

  function addSectionTitles(){
    const map={schedule:'SCHEDULE',lineup:'LIVE LINEUP',pods:'MY ROTATION',kicking:'KICKING ORDER',officials:'OFFICIATING',resources:'TEAM HUB',roster:'ROSTER',access:'CAPTAIN ACCESS'};
    Object.entries(map).forEach(([id,label])=>{
      const section=document.getElementById(id);if(!section||section.dataset.premiumTitle)return;
      section.dataset.premiumTitle='1';
      const title=document.createElement('div');title.className='premium-section-heading';title.textContent=label;
      section.prepend(title);
    });
  }

  function run(){
    if(typeof state==='undefined'||!state)return;
    arrangePlayerHome();renderPlayerPositionHero();buildScheduleFilters();captainQuickActions();addSectionTitles();
  }

  const timer=setInterval(run,600);
  setTimeout(()=>clearInterval(timer),20000);
  window.addEventListener('focus',run);
  window.addEventListener('buntpreferrednamesrefresh',run);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});
})();