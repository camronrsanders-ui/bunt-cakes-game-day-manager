(()=>{
  if(!document.querySelector('link[data-premium-mobile-nav-style]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='/premium-mobile-nav.css?v=1';link.dataset.premiumMobileNavStyle='1';document.head.appendChild(link);
  }
  const media=matchMedia('(max-width:700px)');
  const playerPrimary=['home','schedule','lineup','pods'];
  const captainPrimary=['dashboard','schedule','lineup'];
  let sheet=null;

  function closeSheet(){if(sheet){sheet.classList.remove('open');setTimeout(()=>{sheet?.remove();sheet=null},180)}}
  function tabLabel(btn){return btn.querySelector('.premium-nav-label')?.textContent?.trim()||btn.textContent.trim()||btn.dataset.tab}
  function clickTab(btn){btn?.click();closeSheet();setTimeout(updateActive,20)}

  function createMoreButton(tabs,isCaptain){
    let btn=document.getElementById('premiumMoreNav');
    if(btn)return btn;
    btn=document.createElement('button');btn.id='premiumMoreNav';btn.type='button';btn.className='premium-more-nav';
    btn.innerHTML='<span class="premium-more-dots">•••</span><span class="premium-nav-label">More</span>';
    btn.onclick=()=>openSheet(tabs,isCaptain);
    tabs.appendChild(btn);return btn;
  }

  function createAttendanceButton(tabs){
    let btn=document.getElementById('premiumAttendanceNav');if(btn)return btn;
    btn=document.createElement('button');btn.id='premiumAttendanceNav';btn.type='button';btn.className='premium-attendance-nav';
    btn.innerHTML='<span class="premium-more-check">✓</span><span class="premium-nav-label">Attendance</span>';
    btn.onclick=()=>{
      document.querySelector('.tabs button[data-tab="dashboard"]')?.click();
      setTimeout(()=>document.getElementById('captainAttendance')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
      setTimeout(updateActive,20);
    };
    tabs.appendChild(btn);return btn;
  }

  function overflowButtons(tabs,isCaptain){
    const primary=isCaptain?captainPrimary:playerPrimary;
    return [...tabs.querySelectorAll('button[data-tab]')].filter(btn=>!primary.includes(btn.dataset.tab));
  }

  function openSheet(tabs,isCaptain){
    closeSheet();
    sheet=document.createElement('div');sheet.id='premiumMoreSheet';sheet.className='premium-more-sheet';
    const buttons=overflowButtons(tabs,isCaptain);
    sheet.innerHTML='<div class="premium-more-backdrop"></div><div class="premium-more-panel"><div class="premium-more-handle"></div><div class="row"><div><span class="premium-kicker">'+(isCaptain?'CAPTAIN TOOLS':'TEAM TOOLS')+'</span><h2>More</h2></div><button class="premium-more-close" type="button" aria-label="Close">×</button></div><div class="premium-more-list"></div></div>';
    const list=sheet.querySelector('.premium-more-list');
    buttons.forEach(original=>{
      const item=document.createElement('button');item.type='button';item.className='premium-more-item';item.innerHTML='<strong>'+tabLabel(original)+'</strong><span>Open →</span>';item.onclick=()=>clickTab(original);list.appendChild(item);
    });
    if(!buttons.length)list.innerHTML='<div class="muted">No additional tools are available.</div>';
    sheet.querySelector('.premium-more-backdrop').onclick=closeSheet;sheet.querySelector('.premium-more-close').onclick=closeSheet;
    document.body.appendChild(sheet);requestAnimationFrame(()=>sheet?.classList.add('open'));
  }

  function updateActive(){
    const tabs=document.querySelector('.tabs');if(!tabs)return;
    const isCaptain=!!document.getElementById('manager');
    const primary=isCaptain?captainPrimary:playerPrimary;
    const active=tabs.querySelector('button[data-tab].on')?.dataset.tab||'';
    const more=document.getElementById('premiumMoreNav');if(more)more.classList.toggle('on',!!active&&!primary.includes(active));
    const attendance=document.getElementById('premiumAttendanceNav');
    if(attendance)attendance.classList.remove('on');
  }

  function apply(){
    const tabs=document.querySelector('.tabs');if(!tabs)return;
    const isCaptain=!!document.getElementById('manager');
    const primary=isCaptain?captainPrimary:playerPrimary;
    const originals=[...tabs.querySelectorAll('button[data-tab]')];
    originals.forEach(btn=>btn.classList.toggle('premium-overflow-tab',media.matches&&!primary.includes(btn.dataset.tab)));
    if(!media.matches){document.getElementById('premiumMoreNav')?.remove();document.getElementById('premiumAttendanceNav')?.remove();closeSheet();return;}
    if(isCaptain)createAttendanceButton(tabs);
    createMoreButton(tabs,isCaptain);
    // Keep the intended five primary controls ordered at the front.
    const ordered=isCaptain?[...captainPrimary.map(k=>tabs.querySelector(`button[data-tab="${k}"]`)),document.getElementById('premiumAttendanceNav'),document.getElementById('premiumMoreNav')]:[...playerPrimary.map(k=>tabs.querySelector(`button[data-tab="${k}"]`)),document.getElementById('premiumMoreNav')];
    ordered.filter(Boolean).forEach(node=>tabs.appendChild(node));
    updateActive();
  }

  document.addEventListener('click',e=>{if(e.target.closest('.tabs button[data-tab]'))setTimeout(updateActive,20)});
  media.addEventListener?.('change',apply);
  const timer=setInterval(apply,500);setTimeout(()=>clearInterval(timer),18000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();