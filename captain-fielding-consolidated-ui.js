(()=>{
  const POSITIONS=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
  let selectedInning=null,scheduled=false,detailsOpen=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const getState=()=>typeof state!=='undefined'&&state?state:null;
  const targetDate=()=>{try{return String(window.BuntGameDayEligibility?.targetDate?.()||'');}catch(_){return'';}};
  const isActive=p=>{
    if(!p?.name)return false;
    try{if(typeof window.BuntGameDayEligibility?.isActive==='function')return !!window.BuntGameDayEligibility.isActive(p.name,targetDate());}catch(_){}
    return p.present!==false;
  };
  const displayName=(name,s)=>{
    const p=(s?.players||[]).find(x=>x?.name===name||x?.fullName===name);
    return p?.fullName||p?.name||name;
  };
  const liveInning=s=>Math.max(1,Math.min(7,Number(s?.gameInning||s?.fieldInning||1)));
  const currentLine=(s,inning)=>s?.innings?.[inning]||s?.innings?.[String(inning)]||{};

  function restingNames(s,line){
    const used=new Set(Object.values(line||{}).filter(Boolean).map(v=>String(v).trim().toLowerCase()));
    return (s?.players||[]).filter(isActive).filter(p=>!used.has(String(p.name||'').trim().toLowerCase())).map(p=>p.fullName||p.name);
  }
  function nextChanges(s,inning){
    if(inning>=7)return 'Final regulation inning.';
    const a=currentLine(s,inning),b=currentLine(s,inning+1),changes=[];
    POSITIONS.forEach(pos=>{
      const from=a[pos]||'',to=b[pos]||'';
      if(from!==to&&to)changes.push(`${displayName(to,s)} → ${pos}`);
    });
    return changes.length?changes.join(' • '):'No position changes scheduled.';
  }
  function renameTabs(){
    const lineupTab=document.querySelector('[data-tab="lineup"]');
    if(lineupTab)lineupTab.style.display='none';
    const lineupSection=document.getElementById('lineup');
    if(lineupSection)lineupSection.classList.add('hidden');
    const fieldTab=document.querySelector('[data-tab="pods"]');
    if(fieldTab){fieldTab.textContent='Fielding';fieldTab.setAttribute('aria-label','Fielding');}
  }
  function ensureStyle(){
    if(document.getElementById('captainFieldingConsolidatedStyle'))return;
    const style=document.createElement('style');
    style.id='captainFieldingConsolidatedStyle';
    style.textContent=`
      #fieldingInningPreview{padding:14px!important}
      #fieldingInningPreview .fielding-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      #fieldingInningPreview .fielding-head select{width:auto;min-width:112px;margin:0}
      #fieldingInningPreview .fielding-counts{font-weight:750;margin-top:8px}
      #fieldingInningPreview details{margin-top:8px}
      #fieldingInningPreview summary{cursor:pointer;font-weight:700;padding:6px 0}
      #fieldingInningPreview .fielding-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 12px;margin-top:6px}
      #fieldingInningPreview .fielding-row{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #eceff1}
      #fieldingInningPreview .fielding-pos{color:var(--m);font-size:.84rem}
      #fieldingInningPreview .fielding-player{font-weight:750;text-align:right}
      #fieldingInningPreview .fielding-rest{margin-top:8px;padding:8px 9px;background:#f9fafb;border-radius:10px}
      #fieldingInningPreview .fielding-next{margin-top:7px;font-size:.88rem;color:var(--m)}
      @media(max-width:560px){#fieldingInningPreview .fielding-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }
  function panelHtml(s,inning){
    const line=currentLine(s,inning);
    const fielding=POSITIONS.filter(pos=>line[pos]).length;
    const resting=restingNames(s,line);
    const rows=POSITIONS.map(pos=>`<div class="fielding-row"><span class="fielding-pos">${esc(pos)}</span><span class="fielding-player">${esc(line[pos]?displayName(line[pos],s):'Open')}</span></div>`).join('');
    const options=Array.from({length:7},(_,i)=>`<option value="${i+1}" ${inning===i+1?'selected':''}>Inning ${i+1}</option>`).join('');
    return `<div class="fielding-head"><strong>Fielding plan</strong><select id="fieldingPreviewInning">${options}</select></div><div class="fielding-counts">${fielding} fielding • ${resting.length} resting</div><details id="fieldingPreviewDetails" ${detailsOpen?'open':''}><summary>View inning assignments</summary><div class="fielding-grid">${rows}</div><div class="fielding-rest"><strong>Resting:</strong> ${resting.length?resting.map(esc).join(', '):'None'}</div><div class="fielding-next"><strong>Next inning:</strong> ${esc(nextChanges(s,inning))}</div></details>`;
  }
  function render(){
    scheduled=false;renameTabs();ensureStyle();
    const s=getState(),section=document.getElementById('pods');if(!s||!section)return;
    if(selectedInning==null)selectedInning=liveInning(s);
    selectedInning=Math.max(1,Math.min(7,Number(selectedInning)||1));
    let panel=document.getElementById('fieldingInningPreview');
    if(!panel){
      panel=document.createElement('div');panel.id='fieldingInningPreview';panel.className='card';
      const quick=document.getElementById('switchQuick');
      if(quick&&quick.parentNode===section)section.insertBefore(panel,quick);
      else section.insertBefore(panel,section.firstChild?.nextSibling||section.firstChild);
    }
    panel.innerHTML=panelHtml(s,selectedInning);
    const select=document.getElementById('fieldingPreviewInning');
    if(select)select.onchange=()=>{selectedInning=Number(select.value)||1;render();};
    const details=document.getElementById('fieldingPreviewDetails');
    if(details)details.ontoggle=()=>{detailsOpen=details.open;};
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(render);}

  document.addEventListener('click',e=>{if(e.target?.closest?.('#pods button'))setTimeout(schedule,150);});
  document.addEventListener('change',e=>{if(e.target?.closest?.('#pods'))setTimeout(schedule,80);});
  window.addEventListener('buntpreferrednamesrefresh',schedule);
  window.addEventListener('focus',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>!m.target?.closest?.('#fieldingInningPreview')))schedule();
  });
  const start=()=>{observer.observe(document.body,{childList:true,subtree:true});schedule();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
