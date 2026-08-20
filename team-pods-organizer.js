(function(){
  const style=document.createElement('style');
  style.textContent=`
    #pods{gap:12px}
    .team-pod-help{border:2px solid #86efac;background:#f0fdf4}
    .team-pod-help strong{font-size:1.02rem}
    #podPlan{gap:10px}
    #podPlan>.card{padding:0;overflow:hidden;border-left:5px solid #15803d;box-shadow:0 3px 12px rgba(15,23,42,.05)}
    #podPlan>.card.my-pod{border:2px solid #15803d;border-left-width:6px;background:#fbfffc}
    .team-pod-head{padding:12px 14px;background:#f8fafc;border-bottom:1px solid var(--l)}
    .team-pod-head .pill{background:#dcfce7;color:#166534;border-color:#86efac;font-weight:800}
    .my-pod-badge{display:inline-block;margin-left:7px;padding:4px 8px;border-radius:999px;background:#15803d;color:#fff;font-size:.72rem;font-weight:800}
    .team-pod-meta{padding:10px 14px;border-bottom:1px solid #eef2f7}
    .team-pod-meta strong{color:#166534}
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

  function organize(){
    const section=document.getElementById('pods'),plan=document.getElementById('podPlan');
    if(!section||!plan)return;
    if(!document.getElementById('teamPodHelp')){
      const help=document.createElement('div');
      help.id='teamPodHelp';help.className='card team-pod-help';
      help.innerHTML='<strong>Your Rotation Pods</strong><div class="muted" style="margin-top:4px">Find your pod below. Each card shows the players and positions first; tap the inning plan only when you need the full rotation.</div>';
      plan.parentNode.insertBefore(help,plan);
    }
    const me=localStorage.getItem('buntCakesPlayerName')||new URLSearchParams(location.search).get('player')||'';
    const cards=[...plan.children].filter(x=>x.classList.contains('card'));
    cards.forEach(card=>{
      if(card.dataset.teamPodOrganized==='1')return;
      card.dataset.teamPodOrganized='1';
      const kids=[...card.children];
      const head=kids[0],players=kids[1],positions=kids[2],inningBlock=kids[3];
      if(head)head.classList.add('team-pod-head');
      if(players)players.classList.add('team-pod-meta');
      if(positions)positions.classList.add('team-pod-meta');
      if(me&&card.textContent.includes(me)){
        card.classList.add('my-pod');
        const title=head?.querySelector('strong');
        if(title&&!head.querySelector('.my-pod-badge')) title.insertAdjacentHTML('afterend','<span class="my-pod-badge">YOUR POD</span>');
      }
      if(inningBlock&&!inningBlock.closest('details')){
        inningBlock.classList.add('team-pod-plan');
        const details=document.createElement('details');
        const summary=document.createElement('summary');
        summary.innerHTML='<span>Show 7-Inning Plan</span><span class="muted" style="font-weight:600">Positions + rest innings</span>';
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