(()=>{
  const key=name=>window.__teamStorageKey?window.__teamStorageKey(name):'teamgameday:'+name;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);

  function selectedPlayer(){return new URLSearchParams(location.search).get('player')||localStorage.getItem(key('playerName'))||''}
  function authenticatedPlayer(){
    const access=typeof state!=='undefined'&&state&&state.playerAccess;
    return access&&access.paired===true&&String(access.playerName||'').trim()?String(access.playerName).trim():'';
  }

  function addStyles(){
    if(document.getElementById('team-onboarding-style'))return;
    const style=document.createElement('style');style.id='team-onboarding-style';style.textContent=`
      .team-onboard-overlay{position:fixed;inset:0;z-index:10020;background:rgba(15,23,42,.82);display:flex;align-items:flex-end;justify-content:center;padding:16px;overflow:hidden}
      .team-onboard-sheet{width:min(620px,100%);background:#fff;border-radius:24px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.35);max-height:min(92dvh,760px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
      .team-onboard-icon{width:86px;height:86px;display:block;margin:0 auto 8px;object-fit:contain}.team-onboard-sheet h2{text-align:center;margin:.3rem 0}.team-onboard-center{text-align:center}.team-onboard-callout{background:#f0fdf4;border:2px solid #86efac;border-radius:16px;padding:13px;margin:14px 0}.team-onboard-actions{display:grid;gap:9px;margin-top:14px}.team-onboard-actions button{width:100%;min-height:50px;font-weight:900}.team-onboard-primary{background:var(--a,#15803d)!important;color:#fff!important;border-color:var(--a,#15803d)!important}.team-onboard-secondary{background:#fff!important;color:#4b5563!important}.team-onboard-step{display:grid;grid-template-columns:34px 1fr;gap:10px;margin:12px 0;align-items:start}.team-onboard-step b{display:grid;place-items:center;width:30px;height:30px;border-radius:999px;background:var(--a,#15803d);color:#fff}
      .install-player-picker{margin-top:9px;border:1px solid #d1d5db;border-radius:14px;background:#fff;overflow:hidden}.install-player-picker-head{padding:10px 12px;font-size:.82rem;font-weight:800;color:#6b7280;background:#f9fafb;border-bottom:1px solid #e5e7eb}.install-player-list{max-height:min(38dvh,320px);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:6px}.install-player-choice{display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;min-height:48px!important;text-align:left!important;padding:10px 12px!important;margin:0!important;border:0!important;border-radius:10px!important;background:#fff!important;color:#1f2937!important;font-weight:700!important}.install-player-choice+.install-player-choice{border-top:1px solid #f1f5f9!important}.install-player-choice.selected{background:#ecfdf3!important;color:#166534!important}.install-player-choice.selected:after{content:'✓';font-weight:900}.install-select-picker-hidden{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;margin:0!important;padding:0!important}
      @media(max-width:520px){.team-onboard-overlay{padding:0;align-items:stretch}.team-onboard-sheet{width:100%;max-height:100dvh;height:100dvh;border-radius:0;padding:calc(16px + env(safe-area-inset-top)) 16px calc(18px + env(safe-area-inset-bottom));}.install-sheet{max-height:100dvh!important;height:100dvh!important;width:100%!important;border-radius:0!important;padding:calc(16px + env(safe-area-inset-top)) 16px calc(18px + env(safe-area-inset-bottom))!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important}.install-overlay{padding:0!important;align-items:stretch!important;overflow:hidden!important}.install-player-list{max-height:42dvh}}
      @media(min-width:650px){.team-onboard-overlay{align-items:center}}
    `;document.head.appendChild(style);
  }

  function logo(){return document.querySelector('.brand-logo')?.src||document.querySelector('.install-logo')?.src||'/generic-team-icon.svg'}
  function teamName(){return document.querySelector('.brand h1')?.textContent?.trim()||'Your Team'}

  function syncPlayerChoice(list,select){
    const value=select?.value||selectedPlayer();
    list?.querySelectorAll('.install-player-choice').forEach(btn=>btn.classList.toggle('selected',btn.dataset.player===value));
  }

  function repairNamePicker(){
    addStyles();
    const select=document.getElementById('installPlayer');
    const step=select?.closest('.install-step');
    if(!select||!step||document.getElementById('installPlayerPicker'))return !!select;
    const picker=document.createElement('div');picker.id='installPlayerPicker';picker.className='install-player-picker';
    picker.innerHTML='<div class="install-player-picker-head">Tap your name — scroll inside this list</div><div class="install-player-list"></div>';
    select.insertAdjacentElement('afterend',picker);
    select.classList.add('install-select-picker-hidden');
    const list=picker.querySelector('.install-player-list');
    const build=()=>{
      const opts=[...select.options].filter(o=>o.value);
      if(!opts.length)return;
      list.textContent='';
      opts.forEach(option=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='install-player-choice';
        button.dataset.player=option.value;
        button.textContent=option.textContent;
        button.onclick=()=>{
          select.value=button.dataset.player;
          select.dispatchEvent(new Event('change',{bubbles:true}));
          syncPlayerChoice(list,select);
        };
        list.appendChild(button);
      });
      syncPlayerChoice(list,select);
    };
    build();
    const observer=new MutationObserver(build);observer.observe(select,{childList:true});
    return true;
  }

  function showAfterInstall(){
    addStyles();
    let overlay=document.getElementById('teamAfterInstall');
    if(overlay)overlay.remove();
    overlay=document.createElement('div');overlay.id='teamAfterInstall';overlay.className='team-onboard-overlay';
    overlay.innerHTML='<div class="team-onboard-sheet"><img class="team-onboard-icon" alt="Team logo"><h2>Almost done</h2><div class="team-onboard-center muted">The website cannot open the Home Screen app for you.</div><div class="team-onboard-callout"><strong>Now leave this browser page and open the new <span id="teamAfterInstallName"></span> icon from your Home Screen.</strong><div class="muted" style="margin-top:5px">When the app opens, the next screen will ask you to turn on Thursday availability notifications.</div></div><div class="team-onboard-step"><b>1</b><div>Go to your iPhone Home Screen.</div></div><div class="team-onboard-step"><b>2</b><div>Tap the new team app icon.</div></div><div class="team-onboard-step"><b>3</b><div>Tap <strong>Turn On Notifications</strong> and then <strong>Allow</strong>.</div></div><div class="team-onboard-actions"><button id="teamBrowserInstead" class="team-onboard-secondary">Continue in browser instead</button></div></div>';
    document.body.appendChild(overlay);
    const icon=overlay.querySelector('.team-onboard-icon');
    if(icon)icon.src=logo();
    const nameSpan=overlay.querySelector('#teamAfterInstallName');
    if(nameSpan)nameSpan.textContent=teamName();
    document.getElementById('teamBrowserInstead').onclick=()=>{localStorage.setItem(key('installIntroDismissed'),'1');overlay.remove();const old=document.getElementById('installOverlay');if(old)old.classList.add('install-hidden')};
  }

  function showInstallGuide(){
    const overlay=document.getElementById('installOverlay');
    if(overlay){overlay.classList.remove('install-hidden');overlay.scrollTop=0;repairNamePicker();return}
    if(isIOS)alert('Tap Share in Safari → Add to Home Screen. Then open the new team icon to enable notifications.');
  }
  window.teamGameDayShowInstallGuide=showInstallGuide;

  async function showPushPromptIfNeeded(){
    const pairedName=authenticatedPlayer();
    if(!standalone()||!pairedName)return;
    let tries=0;
    while(typeof window.teamGameDayPushState!=='function'&&tries++<60)await new Promise(r=>setTimeout(r,100));
    if(typeof window.teamGameDayPushState!=='function')return;
    const status=await window.teamGameDayPushState();
    if(!status.supported||status.subscribed&&status.permission==='granted'||status.permission==='denied')return;
    if(sessionStorage.getItem(key('pushPromptDismissed')))return;
    if(document.getElementById('teamPushOnboarding'))return;
    addStyles();
    const overlay=document.createElement('div');overlay.id='teamPushOnboarding';overlay.className='team-onboard-overlay';
    overlay.innerHTML=`<div class="team-onboard-sheet"><img class="team-onboard-icon" src="${logo()}" alt="Team logo"><div class="team-onboard-center muted">ONE LAST SETUP STEP</div><h2>Turn on Thursday reminders</h2><div class="team-onboard-callout"><strong>Get a notification every Thursday when there’s a Sunday game.</strong><div class="muted" style="margin-top:5px">Tap below, then choose <strong>Allow</strong> when your phone asks. This helps captains build the lineup before Sunday.</div></div><div class="team-onboard-actions"><button id="teamEnablePushNow" class="team-onboard-primary">🔔 Turn On Notifications</button><button id="teamPushLater" class="team-onboard-secondary">Not now</button></div><div id="teamPushSetupStatus" class="muted team-onboard-center" style="margin-top:10px"></div></div>`;
    document.body.appendChild(overlay);
    const button=document.getElementById('teamEnablePushNow'),statusText=document.getElementById('teamPushSetupStatus');
    button.onclick=async()=>{button.disabled=true;button.textContent='Turning on…';statusText.textContent='Your phone should ask for notification permission.';const ok=await window.teamGameDayEnablePush();if(ok){statusText.textContent='✓ Thursday notifications are on.';button.textContent='Notifications On';setTimeout(()=>overlay.remove(),900)}else{button.disabled=false;button.textContent='🔔 Turn On Notifications';statusText.textContent='Notifications are not on yet. You can try again.'}};
    document.getElementById('teamPushLater').onclick=()=>{sessionStorage.setItem(key('pushPromptDismissed'),'1');overlay.remove()};
  }

  function repairExistingInstallFlow(){
    addStyles();
    repairNamePicker();
    const done=document.getElementById('installDoneButton');
    if(!done)return false;
    done.textContent=isIOS?'I added it — show me the next step':'I installed it — show me the next step';
    done.onclick=()=>{
      const select=document.getElementById('installPlayer');
      const player=select?.value||selectedPlayer();
      if(!player){alert('Choose your name first.');return}
      localStorage.setItem(key('playerName'),player);
      showAfterInstall();
    };
    const sheet=document.querySelector('#installOverlay .install-sheet');
    const note=sheet?.querySelector('.install-note');
    if(note)note.innerHTML='<strong>Important:</strong> On iPhone, adding the icon and enabling notifications are two separate steps. After you add it, open the new Home Screen icon to finish notification setup.';
    return true;
  }

  function install(){
    addStyles();
    let count=0;const timer=setInterval(()=>{if(repairExistingInstallFlow()||count++>80)clearInterval(timer)},100);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showPushPromptIfNeeded,{once:true});else setTimeout(showPushPromptIfNeeded,300);
    window.addEventListener('pageshow',()=>setTimeout(()=>{repairNamePicker();showPushPromptIfNeeded()},250));
    window.addEventListener('teamplayeraccesschange',()=>{
      const overlay=document.getElementById('teamPushOnboarding');
      if(!authenticatedPlayer()){
        if(overlay)overlay.remove();
        return;
      }
      setTimeout(showPushPromptIfNeeded,0);
    });
  }
  install();
})();
