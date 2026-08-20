(function(){
  const style=document.createElement('style');
  style.textContent=`
    #pods{gap:12px}
    .team-pod-help{border:2px solid #86efac;background:#f0fdf4}
    .team-pod-help strong{font-size:1.02rem}
    .team-pod-status{display:flex;align-items:center;gap:8px;margin-top:9px;font-weight:800;color:#166534}
    .team-pod-status-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px #dcfce7}
    #podPlan{gap:10px}
    #podPlan>.card{padding:0;overflow:hidden;border-left:5px solid #15803d;box-shadow:0 3px 12px rgba(15,23,42,.05)}
    #podPlan>.card.my-pod{border:2px solid #15803d;border-left-width:6px;background:#fbfffc}
    .team-pod-head{padding:12px 14px;background:#f8fafc;border-bottom:1px solid var(--l)}
    .team-pod-head .pill{background:#dcfce7;color:#166534;border-color:#86efac;font-weight:800}
    .my-pod-badge{display:inline-block;margin-left:7px;padding:4px 8px;border-radius:999px;background:#15803d;color:#fff;font-size:.72rem;font-weight:800}
    .team-pod-meta{padding:10px 14px;border-bottom:1px solid #eef2f7}
    .team-pod-meta strong{color:#166534}
    .team-pod-live{padding:12px 14px;background:#ecfdf3;border-bottom:1px solid #bbf7d0}
    .team-pod-live-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
    .team-pod-live-title{font-weight:900;color:#166534;letter-spacing:.02em}
    .team-pod-live-badge{display:inline-block;border-radius:999px;padding:4px 8px;background:#15803d;color:#fff;font-size:.72rem;font-weight:900}
    .team-pod-live-list{display:grid;gap:6px}
    .team-pod-live-row{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid #bbf7d0;border-radius:11px;padding:8px 10px}
    .team-pod-live-row.is-me{border:2px solid #15803d;background:#f0fdf4}
    .team-pod-live-player{font-weight:800;color:#1f2937}
    .team-pod-live-position{font-weight:800;color:#166534;text-align:right}
    .team-pod-live-position.resting{color:#a16207}
    .team-pod-you{margin-left:6px;font-size:.68rem;font-weight:900;color:#15803d}
    .team-pod-plan{margin:0!important}
    .team-pod-plan details{background:#fff}
    .team-pod-plan summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;font-weight:800}
    .team-pod-plan summary::-webkit-details-marker{display:none}
    .team-pod-plan summary:after{content:'+';font-size:1.2rem;color:#15803d}
    .team-pod-plan details[open] summary:after{content:'−'}
    .team-pod-plan-content{padding:0 14px 12px}
    .pod-inning{padding:9px 0!important}
    .pod-inning>strong{color:#166534}
    .pod-rest{font-size:.88rem}
  `;
  document.head.appendChild(style);

  const positions=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
  const esc=v=>String(v??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));

  function currentState(){
    try{return typeof state!=='undefined'&&state?state:{}}catch{return{}}
  }

  function liveInning(){
    const s=currentState();
    return Math.min(7,Math.max(1,Number(s.fieldInning||s.gameInning||1)));
  }

  function positionFor(name,inning){
    const s=currentState();
    const inn=(s.innings&&s.innings[inning])||{};
    return positions.find(pos=>inn[pos]===name)||'';
  }

  function podForTitle(title){
    const s=currentState();
    return (s.pods||[]).find(p=>(p.name||'').trim()===title.trim())||null;
  }

  function liveHtml(pod,me,inning){
    const members=(pod&&Array.isArray(pod.members)?pod.members:[]).map(name=>({name,pos:positionFor(name,inning)}));
    if(me){
      members.sort((a,b)=>(a.name===me?-1:0)-(b.name===me?-1:0));
    }
    const rows=members.length?members.map(x=>{
      const mine=me&&x.name===me;
      const label=x.pos||'Rest this inning';
      return '<div class="team-pod-live-row '+(mine?'is-me':'')+'"><div class="team-pod-live-player">'+esc(x.name)+(mine?'<span class="team-pod-you">YOU</span>':'')+'</div><div class="team-pod-live-position '+(!x.pos?'resting':'')+'">'+esc(label)+'</div></div>';
    }).join(''):'<div class="muted">No players are assigned to this pod yet.</div>';
    return '<div class="team-pod-live"><div class="team-pod-live-head"><div class="team-pod-live-title">Playing now</div><span class="team-pod-live-badge">LIVE • INNING '+inning+'</span></div><div class="team-pod-live-list">'+rows+'</div></div>';
  }

  function organize(){
    const section=document.getElementById('pods'),plan=document.getElementById('podPlan');
    if(!section||!plan)return;
    const inning=liveInning();
    if(!document.getElementById('teamPodHelp')){
      const help=document.createElement('div');
      help.id='teamPodHelp';help.className='card team-pod-help';
      help.innerHTML='<strong>Your Rotation Pods</strong><div class="muted" style="margin-top:4px">Your current position or rest assignment appears automatically below. The full 7-inning plan is still available if you want to look ahead.</div><div id="teamPodLiveStatus" class="team-pod-status"><span class="team-pod-status-dot"></span><span>Live inning '+inning+' • updates automatically from Captain View</span></div>';
      plan.parentNode.insertBefore(help,plan);
    }else{
      const status=document.getElementById('teamPodLiveStatus');
      if(status)status.innerHTML='<span class="team-pod-status-dot"></span><span>Live inning '+inning+' • updates automatically from Captain View</span>';
    }
    const me=localStorage.getItem('buntCakesPlayerName')||new URLSearchParams(location.search).get('player')||'';
    const cards=[...plan.children].filter(x=>x.classList.contains('card'));
    cards.forEach(card=>{
      if(card.dataset.teamPodOrganized==='1')return;
      card.dataset.teamPodOrganized='1';
      const kids=[...card.children];
      const head=kids[0],players=kids[1],positionsBlock=kids[2],inningBlock=kids[3];
      if(head)head.classList.add('team-pod-head');
      if(players)players.classList.add('team-pod-meta');
      if(positionsBlock)positionsBlock.classList.add('team-pod-meta');
      const title=head?.querySelector('strong');
      const pod=title?podForTitle(title.textContent):null;
      if(me&&pod&&(pod.members||[]).includes(me)){
        card.classList.add('my-pod');
        if(title&&!head.querySelector('.my-pod-badge')) title.insertAdjacentHTML('afterend','<span class="my-pod-badge">YOUR POD</span>');
      }
      if(positionsBlock&&!card.querySelector('.team-pod-live')){
        positionsBlock.insertAdjacentHTML('afterend',liveHtml(pod,me,inning));
      }
      if(inningBlock&&!inningBlock.closest('details')){
        inningBlock.classList.add('team-pod-plan');
        const details=document.createElement('details');
        const summary=document.createElement('summary');
        summary.innerHTML='<span>Show Full 7-Inning Plan</span><span class="muted" style="font-weight:600">Look ahead</span>';
        const content=document.createElement('div');content.className='team-pod-plan-content';
        while(inningBlock.firstChild)content.appendChild(inningBlock.firstChild);
        details.append(summary,content);inningBlock.appendChild(details);
      }
    });
    if(me){
      const mine=cards.find(c=>c.classList.contains('my-pod'));
      if(mine&&plan.firstElementChild!==mine)plan.prepend(mine);
    }
  }
  const timer=setInterval(()=>{const p=document.getElementById('podPlan');if(!p)return;clearInterval(timer);organize();new MutationObserver(()=>requestAnimationFrame(organize)).observe(p,{childList:true});},250);
})();