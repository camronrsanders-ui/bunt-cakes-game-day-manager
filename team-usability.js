(function(){
  const STYLE_ID='bunt-team-usability';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .tabs{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;position:sticky!important;top:0!important;-webkit-overflow-scrolling:touch;scrollbar-width:none}
      .tabs::-webkit-scrollbar{display:none}
      .tabs button{flex:0 0 auto!important;width:auto!important;min-height:44px!important;padding:9px 13px!important;font-weight:800;font-size:.92rem;white-space:nowrap!important;line-height:1.15}
      .card{line-height:1.4}
      .card strong{line-height:1.25}
      button,.chat-btn,.reminder-btn{min-height:48px;font-size:1rem}
      .tabs button{min-height:44px!important}
      .team-current-inning{border:2px solid #86efac;background:#f0fdf4}
      .team-record-card{display:flex;justify-content:space-between;align-items:center;gap:12px;border:2px solid #bbf7d0;background:#f7fff8}
      .team-record-big{font-size:1.55rem;font-weight:900;color:#166534;white-space:nowrap}
      .team-quick-guide{border:2px solid #bbf7d0;background:#f0fdf4;margin:8px 0 10px}
      .team-quick-guide strong{display:block;font-size:1.05rem;color:#166534;margin-bottom:2px}
      @media(max-width:650px){
        body{font-size:17px}
        .app{padding-left:10px;padding-right:10px}
        .tabs{display:flex!important;grid-template-columns:none!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;gap:7px!important;margin:4px 0 10px!important;padding:6px!important}
        .tabs button{flex:0 0 auto!important;width:auto!important;min-width:max-content!important;min-height:44px!important;padding:9px 13px!important;font-size:.88rem!important;white-space:nowrap!important}
        .card{padding:15px}
        .muted{font-size:.94rem}
        .brand{width:100%}
        .brand+div,.brand~div{width:100%}
        .brand~div .chat-btn{margin-bottom:7px}
      }
    `;
    document.head.appendChild(style);
  }

  function labelTabs(){
    const labels={home:'Home',schedule:'Schedule',lineup:'Field Lineup',pods:'My Rotation',kicking:'Kicking',officials:'Officiating',resources:'Resources'};
    document.querySelectorAll('.tabs button[data-tab]').forEach(b=>{if(labels[b.dataset.tab])b.textContent=labels[b.dataset.tab]});
  }

  function mountQuickGuide(){
    const tabs=document.querySelector('.tabs');
    if(!tabs||document.getElementById('teamQuickGuide'))return;
    const guide=document.createElement('div');
    guide.id='teamQuickGuide';
    guide.className='card team-quick-guide';
    guide.innerHTML='<strong>Need something? Tap a button below.</strong><div>Start with <b>Home</b>. Use <b>Schedule</b> for game times, <b>Field Lineup</b> for your position, and <b>Kicking</b> for the kicking order.</div>';
    tabs.parentNode.insertBefore(guide,tabs);
  }

  function record(){
    const results=Array.isArray(state?.gameResults)?state.gameResults:[];
    let w=0,l=0,t=0;
    results.forEach(r=>{const a=Number(r.teamScore??r.team??0),b=Number(r.opponentScore??r.them??0);a>b?w++:a<b?l++:t++});
    return `${w}-${l}${t?'-'+t:''}`;
  }

  function mountRecord(){
    const home=document.getElementById('home');
    if(!home||typeof state==='undefined'||!state)return;
    let card=document.getElementById('teamSeasonRecord');
    if(!card){
      card=document.createElement('div');
      card.id='teamSeasonRecord';
      card.className='card team-record-card';
      const scoreGrid=home.querySelector('.grid.g3');
      if(scoreGrid)scoreGrid.insertAdjacentElement('afterend',card);else home.prepend(card);
    }
    card.innerHTML='<div><strong>Season Record</strong><div class="muted">Saved final game results</div></div><div class="team-record-big">'+record()+'</div>';
  }

  function currentLineup(){
    if(typeof state==='undefined'||!state)return;
    const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const n=Number(state.gameInning||state.fieldInning)||1;
    const inn=state.innings?.[n]||{};
    const label=document.getElementById('lineupLabel');
    if(label)label.textContent='Current game inning '+n;
    const html=POS.map(p=>'<div class="card"><div class="muted">'+escapeHtml(p)+'</div><strong>'+escapeHtml(inn[p]||'Unassigned')+'</strong></div>').join('');
    const positions=document.getElementById('positions');
    const homeLineup=document.getElementById('homeLineup');
    if(positions)positions.innerHTML=html;
    if(homeLineup)homeLineup.innerHTML=html;
    const homeCard=homeLineup&&homeLineup.closest('.card');
    if(homeCard){homeCard.classList.add('team-current-inning');const title=homeCard.querySelector('strong');if(title)title.textContent='Current fielding lineup — inning '+n;}
  }

  function refreshSimpleUi(){labelTabs();mountQuickGuide();mountRecord();}

  function install(){
    labelTabs();
    mountQuickGuide();
    if(typeof state!=='undefined'&&state){
      window.renderLineup=currentLineup;
      renderLineup=currentLineup;
      currentLineup();
      mountRecord();
    }
    if('serviceWorker' in navigator){navigator.serviceWorker.register('/service-worker.js').catch(()=>{});}
    setInterval(refreshSimpleUi,3000);
  }

  const wait=setInterval(()=>{
    if(document.querySelector('.tabs')&&typeof state!=='undefined'&&state){clearInterval(wait);install();}
  },200);

  window.addEventListener('pageshow',()=>{if(typeof state!=='undefined'&&state){currentLineup();refreshSimpleUi();}});
})();