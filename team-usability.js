(function(){
  const STYLE_ID='bunt-team-usability';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .tabs{flex-wrap:wrap;overflow:visible;position:static}
      .tabs button{flex:1 1 120px;min-height:48px;font-weight:800;font-size:.96rem;white-space:normal;line-height:1.15}
      .card{line-height:1.4}
      .card strong{line-height:1.25}
      button,.chat-btn,.reminder-btn{min-height:48px;font-size:1rem}
      .team-current-inning{border:2px solid #86efac;background:#f0fdf4}
      .team-record-card{display:flex;justify-content:space-between;align-items:center;gap:12px;border:2px solid #bbf7d0;background:#f7fff8}
      .team-record-big{font-size:1.55rem;font-weight:900;color:#166534;white-space:nowrap}
      @media(max-width:650px){
        body{font-size:17px}
        .app{padding-left:10px;padding-right:10px}
        .tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:4px 0 10px}
        .tabs button{width:100%;min-height:50px}
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

  function record(){
    const results=Array.isArray(state?.gameResults)?state.gameResults:[];
    let w=0,l=0,t=0;
    results.forEach(r=>{const a=Number(r.teamScore??r.team??0),b=Number(r.opponentScore??r.them??0);a>b?w++:a<b?l++:t++});
    return `${w}-${l}${t?'-'+t:''}`;
  }

  function mountRecord(){
    const home=document.getElementById('home');
    if(!home)return;
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
    if(!state)return;
    const n=Number(state.gameInning)||1;
    const inn=state.innings?.[n]||{};
    const label=document.getElementById('lineupLabel');
    if(label)label.textContent='Current game inning '+n;
    const html=POS.map(p=>'<div class="card"><div class="muted">'+p+'</div><strong>'+(inn[p]||'Unassigned')+'</strong></div>').join('');
    const positions=document.getElementById('positions');
    const homeLineup=document.getElementById('homeLineup');
    if(positions)positions.innerHTML=html;
    if(homeLineup)homeLineup.innerHTML=html;
    const homeCard=homeLineup&&homeLineup.closest('.card');
    if(homeCard){homeCard.classList.add('team-current-inning');const title=homeCard.querySelector('strong');if(title)title.textContent='Current fielding lineup — inning '+n;}
  }

  function install(){
    labelTabs();
    if(typeof state!=='undefined'&&state){
      window.renderLineup=currentLineup;
      renderLineup=currentLineup;
      currentLineup();
      mountRecord();
    }
    if('serviceWorker' in navigator){navigator.serviceWorker.register('/service-worker.js').catch(()=>{});}
  }

  const wait=setInterval(()=>{
    if(document.querySelector('.tabs')&&typeof state!=='undefined'&&state){clearInterval(wait);install();}
  },200);

  window.addEventListener('pageshow',()=>{labelTabs();if(typeof state!=='undefined'&&state){currentLineup();mountRecord();}});
})();