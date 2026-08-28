(()=>{
  const SECTION_MAP={
    pods:{key:'fieldRotation',label:'Field Rotation'},
    kicking:{key:'kicking',label:'Kicking Order'},
    lineup:{key:'lineup',label:'Lineup'},
    'team-settings':{key:'teamSettings',label:'Team Settings'}
  };
  const SECTION_IDS={fieldRotation:'pods',kicking:'kicking',lineup:'lineup',teamSettings:'team-settings'};
  let installed=false;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function captainName(){
    const raw=(typeof user!=='undefined'&&user&&(user.displayName||user.display_name||user.email))||'Captain';
    return String(raw||'Captain').trim()||'Captain';
  }

  function activeSection(){
    const tab=document.querySelector('#manager .tabs button.on[data-tab]');
    return tab?SECTION_MAP[tab.dataset.tab]||null:null;
  }

  function ensureActivity(){
    if(typeof state==='undefined'||!state)return null;
    if(!state.captainActivity||typeof state.captainActivity!=='object'||Array.isArray(state.captainActivity))state.captainActivity={};
    return state.captainActivity;
  }

  function stamp(section){
    const activity=ensureActivity();
    if(!activity||!section)return;
    activity[section.key]={updatedAt:new Date().toISOString(),updatedBy:captainName()};
    renderAll();
  }

  function formatWhen(value){
    if(!value)return'';
    const date=new Date(value);if(Number.isNaN(date.getTime()))return'';
    const now=new Date();
    const sameDay=date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth()&&date.getDate()===now.getDate();
    const time=date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
    if(sameDay)return 'Today at '+time;
    return date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:date.getFullYear()===now.getFullYear()?undefined:'numeric'})+' at '+time;
  }

  function ensureStyle(){
    if(document.getElementById('captainActivityStyles'))return;
    const style=document.createElement('style');style.id='captainActivityStyles';style.textContent=`
      .captain-activity-strip{display:flex;gap:8px 12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:9px 11px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:13px;font-size:.82rem}
      .captain-activity-strip .captain-activity-label{font-weight:900;color:#166534}
      .captain-activity-strip .captain-activity-meta{color:#4b5563}
      .captain-activity-strip .captain-activity-who{font-weight:800;color:#1f2937}
    `;document.head.appendChild(style);
  }

  function renderOne(key,label){
    const section=document.getElementById(SECTION_IDS[key]);if(!section)return false;
    ensureStyle();
    let strip=section.querySelector(`.captain-activity-strip[data-activity-key="${key}"]`);
    if(!strip){
      strip=document.createElement('div');strip.className='captain-activity-strip';strip.dataset.activityKey=key;
      section.insertBefore(strip,section.firstChild||null);
    }
    const record=state&&state.captainActivity&&state.captainActivity[key];
    if(record&&record.updatedAt){
      strip.innerHTML=`<span class="captain-activity-label">Last Captain update</span><span class="captain-activity-who">${esc(record.updatedBy||'Captain')}</span><span class="captain-activity-meta">${esc(formatWhen(record.updatedAt))}</span>`;
      strip.title=`${label} last changed by ${record.updatedBy||'Captain'} on ${new Date(record.updatedAt).toLocaleString()}`;
    }else{
      strip.innerHTML=`<span class="captain-activity-label">Last Captain update</span><span class="captain-activity-meta">No update recorded yet</span>`;
      strip.title=`${label} activity tracking starts with this release.`;
    }
    return true;
  }

  function renderAll(){
    if(typeof state==='undefined'||!state)return;
    Object.entries({fieldRotation:'Field Rotation',kicking:'Kicking Order',lineup:'Lineup',teamSettings:'Team Settings'}).forEach(([key,label])=>renderOne(key,label));
  }

  function install(){
    if(installed)return;
    if(typeof state==='undefined'||!state||typeof queueSave!=='function'){setTimeout(install,120);return;}
    installed=true;
    const originalQueueSave=queueSave;
    queueSave=function(...args){
      const section=activeSection();if(section)stamp(section);
      return originalQueueSave.apply(this,args);
    };
    window.__buntCaptainActivity={currentSection:activeSection,render:renderAll};
    window.addEventListener('buntpreferrednamesrefresh',renderAll);
    window.addEventListener('buntcaptainactivitychange',renderAll);
    window.addEventListener('focus',renderAll);
    document.addEventListener('click',event=>{if(event.target?.closest?.('#manager .tabs button'))setTimeout(renderAll,0)});
    let tries=0;const mountTimer=setInterval(()=>{renderAll();if(++tries>40&&document.getElementById('team-settings'))clearInterval(mountTimer)},250);
    renderAll();
  }

  install();
})();
