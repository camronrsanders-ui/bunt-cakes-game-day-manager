(()=>{
  const icons={
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z"/></svg>',
    dashboard:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zm9 0h7v5h-7zm0 7h7v9h-7zM4 13h7v7H4z"/></svg>',
    schedule:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2v3M18 2v3M3.5 8.5h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 12h3v3H7zm7 0h3v3h-3z"/></svg>',
    roster:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c.4-4 2.4-6 6-6s5.6 2 6 6M16 7h5M18.5 4.5v5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    lineup:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 12l9 9 9-9z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v10M7 12h10" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    pods:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7a7 7 0 0 1 12-2l2-2v6h-6l2.1-2.1A4 4 0 0 0 8 8M19 17a7 7 0 0 1-12 2l-2 2v-6h6l-2.1 2.1A4 4 0 0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    kicking:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="m9 8 6 8M15 8l-6 8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    officials:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3m1 1h11l-2 4 2 4H6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    resources:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 11h6M9 15h6" stroke="currentColor" stroke-width="2"/></svg>',
    access:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 12h9m-3 0v3m-3-3v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" stroke="currentColor" stroke-width="2"/></svg>'
  };
  const labels={dashboard:'Home',home:'Home',schedule:'Schedule',roster:'Roster',lineup:'Lineup',pods:'Rotation',kicking:'Kicking',officials:'Officiating',resources:'Resources',access:'Access',settings:'Settings','team-settings':'Settings'};

  function decorateTabs(){
    document.querySelectorAll('.tabs button[data-tab]').forEach(btn=>{
      if(btn.dataset.premiumDecorated)return;
      const key=btn.dataset.tab;
      btn.dataset.premiumDecorated='1';
      btn.innerHTML=`<span class="premium-nav-icon">${icons[key]||icons.settings}</span><span class="premium-nav-label">${labels[key]||btn.textContent.trim()}</span>`;
      btn.setAttribute('aria-label',labels[key]||key);
    });
  }

  function decorateHeader(){
    const player=document.querySelector('.app>.row.wrap:first-child .brand');
    const captain=document.querySelector('#manager>.row.wrap:first-child');
    const host=player||captain;
    if(!host||host.querySelector('.premium-eyebrow'))return;
    const title=host.querySelector('h1');
    if(!title)return;
    const eyebrow=document.createElement('div');
    eyebrow.className='premium-eyebrow';
    eyebrow.textContent=player?'TEAM GAME DAY':'CAPTAIN COMMAND';
    title.parentElement.insertBefore(eyebrow,title);
  }

  function decorateSections(){
    const ids=['home','dashboard','schedule','roster','lineup','pods','kicking','officials','resources','access'];
    ids.forEach(id=>{const el=document.getElementById(id);if(el)el.dataset.premiumSection=id});
    const status=document.getElementById('updated');if(status)status.classList.add('premium-live-status');
    const save=document.getElementById('saveStatus');if(save)save.classList.add('premium-save-status');
  }

  function run(){decorateTabs();decorateHeader();decorateSections();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  const obs=new MutationObserver(()=>run());
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>obs.disconnect(),12000);
})();