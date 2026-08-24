(()=>{
  const key=name=>window.__teamStorageKey?window.__teamStorageKey(name):'teamgameday:'+name;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);

  function selectedPlayer(){return new URLSearchParams(location.search).get('player')||localStorage.getItem(key('playerName'))||''}

  function addStyles(){
    if(document.getElementById('team-onboarding-style'))return;
    const style=document.createElement('style');style.id='team-onboarding-style';style.textContent=`
      .team-onboard-overlay{position:fixed;inset:0;z-index:10020;background:rgba(15,23,42,.82);display:flex;align-items:flex-end;justify-content:center;padding:16px;min-height:100vh;min-height:100dvh;overflow:hidden}
      .team-onboard-sheet{width:min(620px,100%);background:#fff;border-radius:24px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.35);max-height:92vh;max-height:92dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-bottom:max(22px,env(safe-area-inset-bottom))}
      .team-onboard-icon{width:86px;height:86px;display:block;margin:0 auto 8px;object-fit:contain}.team-onboard-sheet h2{text-align:center;margin:.3rem 0}.team-onboard-center{text-align:center}.team-onboard-callout{background:#f0fdf4;border:2px solid #86efac;border-radius:16px;padding:13px;margin:14px 0}.team-onboard-actions{display:grid;gap:9px;margin-top:14px}.team-onboard-actions button{width:100%;min-height:50px;font-weight:900}.team-onboard-primary{background:var(--a,#15803d)!important;color:#fff!important;border-color:var(--a,#15803d)!important}.team-onboard-secondary{background:#fff!important;color:#4b5563!important}.team-onboard-step{display:grid;grid-template-columns:34px 1fr;gap:10px;margin:12px 0;align-items:start}.team-onboard-step b{display:grid;place-items:center;width:30px;height:30px;border-radius:999px;background:var(--a,#15803d);color:#fff}
      .team-player-picker-button{display:none;width:100%;min-height:52px;margin-top:7px;padding:11px 42px 11px 13px;border:2px solid #cbd5e1!important;border-radius:14px!important;background:#fff!important;color:#111827!important;font-weight:800!important;text-align:left;position:relative}
      .team-player-picker-button:after{content:'⌄';position:absolute;right:14px;top:50%;transform:translateY(-55%);font-size:1.35rem;color:#15803d}
      .team-player-picker-overlay{position:fixed;inset:0;z-index:10060;background:rgba(15,23,42,.86);display:flex;align-items:flex-end;justify-content:center;padding:10px;padding-top:max(10px,env(safe-area-inset-top));padding-bottom:max(10px,env(safe-area-inset-bottom));height:100vh;height:100dvh;overflow:hidden}
      .team-player-picker-sheet{width:min(620px,100%);height:min(82dvh,720px);max-height:calc(100dvh - max(20px,env(safe-area-inset-top)) - max(20px,env(safe-area-inset-bottom)));background:#fff;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden}
      .team-player-picker-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:18px 18px 12px;border-bottom:1px solid #e5e7eb;flex:0 0 auto}.team-player-picker-head h2{margin:0;text-align:left}.team-player-picker-close{min-width:46px;min-height:46px;border-radius:999px!important;background:#f3f4f6!important;color:#374151!important;font-weight:900!important}
      .team-player-picker-list{padding:10px 12px 18px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;flex:1 1 auto}.team-player-choice{display:block;width:100%;min-height:54px;margin:0 0 8px;padding:12px 14px;border:1px solid #d1d5db!important;border-radius:14px!important;background:#fff!important;color:#111827!important;font-weight:800!important;text-align:left}.team-player-choice.selected{background:#ecfdf3!important;border-color:#15803d!important;color:#065f46!important}.team-player-choice:last-child{margin-bottom:0}
      #installOverlay{height:100vh;height:100dvh;overflow:hidden;padding-top:max(10px,env(safe-area-inset-top));padding-bottom:max(10px,env(safe-area-inset-bottom))}
      #installOverlay .install-sheet{max-height:100%!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-bottom:max(22px,env(safe-area-inset-bottom))!important}
      @media(max-width:700px){#installPlayer.team-native-player-select{display:none!important}.team-player-picker-button{display:block}.team-onboard-overlay{padding:10px;padding-top:max(10px,env(safe-area-inset-top));padding-bottom:max(10px,env(safe-area-inset-bottom));align-items:stretch}.team-onboard-sheet{max-height:100%;border-radius:20px}.team-player-picker-sheet{height:100%;max-height:100%;border-radius:20px}}
      @media(min-width:701px){.team-onboard-overlay{align-items:center}}
    `;document.head.appendChild(style);
  }

  function logo(){return document.querySelector('.brand-logo')?.src||document.querySelector('.install-logo')?.src||'/generic-team-icon.svg'}
  function teamName(){return document.querySelector('.brand h1')?.textContent?.trim()||'Your Team'}

  function closePlayerPicker(overlay,oldOverflow){
    if(overlay)overlay.remove();
    document.body.style.overflow=oldOverflow||'';
  }

  function showPlayerPicker(select,trigger){
    addStyles();
    const previous=document.getElementById('teamPlayerPickerOverlay');
    if(previous)previous.remove();
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const overlay=document.createElement('div');
    overlay.id='teamPlayerPickerOverlay';
    overlay.className='team-player-picker-overlay';
    overlay.innerHTML='<div class="team-player-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="teamPlayerPickerTitle"><div class="team-player-picker-head"><div><div class="muted" style="font-size:.8rem;font-weight:800;letter-spacing:.08em">PLAYER SETUP</div><h2 id="teamPlayerPickerTitle">Choose your name</h2></div><button type="button" class="team-player-picker-close" aria-label="Close">✕</button></div><div class="team-player-picker-list"></div></div>';
    const list=overlay.querySelector('.team-player-picker-list');
    const renderChoices=()=>{
      const choices=[...select.options].filter(o=>o.value);
      if(!choices.length){
        list.innerHTML='<div class="muted" style="padding:18px;text-align:center">Loading roster…</div>';
        return false;
      }
      list.innerHTML='';
      choices.forEach(option=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='team-player-choice'+(select.value===option.value?' selected':'');
        button.textContent=option.textContent||option.value;
        button.onclick=()=>{
          select.value=option.value;
          select.dispatchEvent(new Event('change',{bubbles:true}));
          trigger.textContent=option.textContent||option.value;
          closePlayerPicker(overlay,oldOverflow);
        };
        list.appendChild(button);
      });
      return true;
    };
    renderChoices();
    if(![...select.options].some(o=>o.value)){
      let tries=0;
      const timer=setInterval(()=>{if(renderChoices()||tries++>30)clearInterval(timer)},100);
    }
    overlay.querySelector('.team-player-picker-close').onclick=()=>closePlayerPicker(overlay,oldOverflow);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closePlayerPicker(overlay,oldOverflow)});
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>{list.scrollTop=0});
  }

  function installMobilePlayerPicker(){
    const select=document.getElementById('installPlayer');
    if(!select||select.dataset.mobilePicker==='1')return;
    select.dataset.mobilePicker='1';
    select.classList.add('team-native-player-select');
    const button=document.createElement('button');
    button.type='button';
    button.className='team-player-picker-button';
    const selected=select.options[select.selectedIndex];
    button.textContent=select.value?(selected?.textContent||select.value):'Choose your name';
    button.onclick=()=>showPlayerPicker(select,button);
    select.insertAdjacentElement('afterend',button);
    select.addEventListener('change',()=>{
      const option=select.options[select.selectedIndex];
      button.textContent=select.value?(option?.textContent||select.value):'Choose your name';
    });
  }

  function showAfterInstall(){
    addStyles();
    let overlay=document.getElementById('teamAfterInstall');
    if(overlay)overlay.remove();
    overlay=document.createElement('div');overlay.id='teamAfterInstall';overlay.className='team-onboard-overlay';
    overlay.innerHTML=`<div class="team-onboard-sheet"><img class="team-onboard-icon" src="${logo()}" alt="Team logo"><h2>Almost done</h2><div class="team-onboard-center muted">The website cannot open the Home Screen app for you.</div><div class="team-onboard-callout"><strong>Now leave this browser page and open the new ${teamName()} icon from your Home Screen.</strong><div class="muted" style="margin-top:5px">When the app opens, the next screen will ask you to turn on Thursday availability notifications.</div></div><div class="team-onboard-step"><b>1</b><div>Go to your iPhone Home Screen.</div></div><div class="team-onboard-step"><b>2</b><div>Tap the new team app icon.</div></div><div class="team-onboard-step"><b>3</b><div>Tap <strong>Turn On Notifications</strong> and then <strong>Allow</strong>.</div></div><div class="team-onboard-actions"><button id="teamBrowserInstead" class="team-onboard-secondary">Continue in browser instead</button></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById('teamBrowserInstead').onclick=()=>{localStorage.setItem(key('installIntroDismissed'),'1');overlay.remove();const old=document.getElementById('installOverlay');if(old)old.classList.add('install-hidden')};
  }

  function showInstallGuide(){
    const overlay=document.getElementById('installOverlay');
    if(overlay){overlay.classList.remove('install-hidden');overlay.scrollTop=0;const sheet=overlay.querySelector('.install-sheet');if(sheet)sheet.scrollTop=0;installMobilePlayerPicker();return}
    if(isIOS)alert('Tap Share in Safari → Add to Home Screen. Then open the new team icon to enable notifications.');
  }
  window.teamGameDayShowInstallGuide=showInstallGuide;

  async function showPushPromptIfNeeded(){
    if(!standalone()||!selectedPlayer())return;
    let tries=0;
    while(typeof window.teamGameDayPushState!=='function'&&tries++<60)await new Promise(r=>setTimeout(r,100));
    if(typeof window.teamGameDayPushState!=='function')return;
    const status=await window.teamGameDayPushState();
    if(!status.supported||status.subscribed&&status.permission==='granted'||status.permission==='denied')return;
    if(sessionStorage.getItem(key('pushPromptDismissed')))return;
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
    installMobilePlayerPicker();
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
    let count=0;const timer=setInterval(()=>{if(repairExistingInstallFlow()||count++>50)clearInterval(timer)},100);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showPushPromptIfNeeded,{once:true});else setTimeout(showPushPromptIfNeeded,300);
    window.addEventListener('pageshow',()=>setTimeout(showPushPromptIfNeeded,250));
  }
  install();
})();
