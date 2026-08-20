(function(){
  const STYLE_ID='captainPodsOrganizerStyles';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #pods{gap:14px}
      #pods>.card:first-child{border:2px solid #86efac;background:#f0fdf4}
      .pod-organizer-summary{display:grid;gap:10px}
      .pod-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .pod-summary-stat{background:#fff;border:1px solid var(--l);border-radius:14px;padding:10px}
      .pod-summary-stat strong{display:block;font-size:1.25rem;color:#15803d}
      .pod-unassigned{margin-top:2px;padding:10px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa}
      .pod-unassigned.good{background:#f0fdf4;border-color:#86efac}
      #podList{gap:12px}
      #podList .pod-card{padding:0;overflow:hidden;border-left:5px solid #15803d;box-shadow:0 4px 14px rgba(15,23,42,.05)}
      .pod-card-header{padding:12px 14px;background:#f8fafc;border-bottom:1px solid var(--l);align-items:flex-end}
      .pod-card-header label{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--m);font-weight:800}
      .pod-card-header input{font-size:1.05rem;font-weight:800;color:#1f2937;background:#fff}
      .pod-card-header .removePod{align-self:flex-end}
      .pod-counts{display:flex;flex-wrap:wrap;gap:6px;margin:0 6px 1px auto}
      .pod-count-chip{font-size:.75rem;font-weight:800;border-radius:999px;padding:5px 8px;background:#dcfce7;color:#166534;white-space:nowrap}
      .pod-editor{border-bottom:1px solid #eef2f7;background:#fff}
      .pod-editor>summary,.pod-preview-details>summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:800}
      .pod-editor>summary::-webkit-details-marker,.pod-preview-details>summary::-webkit-details-marker{display:none}
      .pod-editor>summary:after,.pod-preview-details>summary:after{content:'+';font-size:1.2rem;color:#15803d}
      .pod-editor[open]>summary:after,.pod-preview-details[open]>summary:after{content:'−'}
      .pod-selected-count{font-size:.75rem;font-weight:800;color:#166534;background:#dcfce7;border-radius:999px;padding:4px 8px;margin-left:auto;margin-right:6px}
      .pod-editor-content{padding:0 14px 13px!important;margin:0!important}
      .pod-editor-content>strong{display:none}
      .pod-options{gap:6px!important}
      .pod-check{border-radius:10px!important;padding:7px 9px!important;font-size:.9rem}
      .pod-check:has(input:checked){background:#dcfce7;border-color:#4ade80;color:#166534;font-weight:700}
      .pod-rotation-line{margin:0!important;padding:11px 14px;background:#f0fdf4!important;color:#166534!important;font-weight:700;border-bottom:1px solid #bbf7d0}
      .pod-preview-details{background:#fff}
      .pod-preview-details>summary{color:#1f2937}
      .pod-preview{margin:0!important;padding:0 14px 12px}
      .pod-inning{padding:9px 0!important}
      .pod-inning>strong{color:#166534}
      .pod-rest{font-size:.88rem}
      .pod-howto{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px}
      .pod-howto div{background:#fff;border:1px solid #bbf7d0;border-radius:12px;padding:8px;font-size:.86rem}
      .pod-howto b{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#15803d;color:#fff;margin-right:5px}
      @media(max-width:620px){.pod-summary-grid,.pod-howto{grid-template-columns:1fr}.pod-card-header{align-items:stretch}.pod-counts{margin:4px 0 0}.pod-card-header .removePod{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function getState(){
    try{return typeof state!=='undefined'&&state?state:null}catch(e){return null}
  }

  function makeSummary(){
    const section=document.getElementById('pods');
    const list=document.getElementById('podList');
    if(!section||!list)return;
    let summary=document.getElementById('podOrganizerSummary');
    if(!summary){
      summary=document.createElement('div');
      summary.id='podOrganizerSummary';
      summary.className='card pod-organizer-summary';
      list.parentNode.insertBefore(summary,list);
    }
    const s=getState();
    const pods=s?.pods||[];
    const roster=s?.players||[];
    const assigned=new Set(pods.flatMap(p=>Array.isArray(p.members)?p.members:[]));
    const available=roster.filter(p=>p.present!==false);
    const unassigned=available.filter(p=>!assigned.has(p.name));
    summary.innerHTML=`
      <div><strong>Pod Setup at a Glance</strong><div class="muted">Keep the screen simple: open only the section you need to edit.</div></div>
      <div class="pod-summary-grid">
        <div class="pod-summary-stat"><strong>${pods.length}</strong><span class="muted">Rotation pods</span></div>
        <div class="pod-summary-stat"><strong>${assigned.size}</strong><span class="muted">Players assigned</span></div>
        <div class="pod-summary-stat"><strong>${unassigned.length}</strong><span class="muted">Players not in a pod</span></div>
      </div>
      <div class="pod-unassigned ${unassigned.length?'':'good'}"><strong>${unassigned.length?'Still needs a pod:':'All available players are covered'}</strong><div class="muted">${unassigned.length?unassigned.map(p=>p.name).join(', '):'Every available player is currently included in at least one pod.'}</div></div>
      <div class="pod-howto"><div><b>1</b>Choose positions</div><div><b>2</b>Choose players</div><div><b>3</b>Build the 7-inning rotation</div></div>
    `;
  }

  function wrapEditor(section,label,count){
    if(!section||section.closest('details'))return;
    const details=document.createElement('details');
    details.className='pod-editor';
    const summary=document.createElement('summary');
    summary.innerHTML=`<span>${label}</span><span class="pod-selected-count">${count} selected</span>`;
    section.parentNode.insertBefore(details,section);
    details.appendChild(summary);
    details.appendChild(section);
    section.classList.add('pod-editor-content');
  }

  function decorateCard(card){
    if(card.dataset.podOrganized==='1')return;
    card.dataset.podOrganized='1';
    card.classList.add('pod-card');
    const children=[...card.children];
    const header=children[0];
    const positions=children.find(el=>el.querySelector&&el.querySelector('.posOpts'));
    const members=children.find(el=>el.querySelector&&el.querySelector('.memberOpts'));
    const preview=children.find(el=>el.classList&&el.classList.contains('pod-preview'));
    const rotation=children.find(el=>el.classList&&el.classList.contains('muted')&&/Rotation order:/i.test(el.textContent||''));
    const posCount=positions?positions.querySelectorAll('.posOpts input:checked').length:0;
    const memberCount=members?members.querySelectorAll('.memberOpts input:checked').length:0;

    if(header){
      header.classList.add('pod-card-header');
      const remove=header.querySelector('.removePod');
      const counts=document.createElement('div');
      counts.className='pod-counts';
      counts.innerHTML=`<span class="pod-count-chip">${memberCount} player${memberCount===1?'':'s'}</span><span class="pod-count-chip">${posCount} position${posCount===1?'':'s'}</span>`;
      if(remove)header.insertBefore(counts,remove);else header.appendChild(counts);
    }
    wrapEditor(positions,'Positions this pod covers',posCount);
    wrapEditor(members,'Players in this pod',memberCount);
    if(rotation)rotation.classList.add('pod-rotation-line');
    if(preview&&!preview.closest('details')){
      const details=document.createElement('details');
      details.className='pod-preview-details';
      const summary=document.createElement('summary');
      summary.innerHTML='<span>7-Inning Rotation Preview</span><span class="muted" style="font-weight:600">Tap to open</span>';
      preview.parentNode.insertBefore(details,preview);
      details.append(summary,preview);
    }
  }

  let busy=false;
  function organize(){
    if(busy)return;busy=true;
    try{
      makeSummary();
      const list=document.getElementById('podList');
      if(list)[...list.children].filter(el=>el.classList.contains('card')).forEach(decorateCard);
    }finally{busy=false}
  }

  const timer=setInterval(()=>{
    const list=document.getElementById('podList');
    if(!list)return;
    clearInterval(timer);
    organize();
    const observer=new MutationObserver(()=>requestAnimationFrame(organize));
    observer.observe(list,{childList:true,subtree:false});
    const pods=document.getElementById('pods');
    if(pods)new MutationObserver(()=>requestAnimationFrame(makeSummary)).observe(pods,{childList:true,subtree:true});
  },250);
})();