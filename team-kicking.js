(function(){
  const STYLE_ID='bunt-team-kicking-styles';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .team-kick-hero{background:linear-gradient(135deg,#052e16,#166534);color:#fff;border:0;position:relative;overflow:hidden}
      .team-kick-hero:after{content:'';position:absolute;width:220px;height:220px;border-radius:50%;border:22px solid rgba(255,255,255,.07);right:-90px;top:-85px}
      .team-kick-eyebrow{font-size:.74rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase;opacity:.78}
      .team-kick-stage{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:10px;margin-top:12px;position:relative;z-index:1}
      .team-kick-card{border-radius:18px;padding:16px;min-height:118px;display:flex;flex-direction:column;justify-content:center;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.18)}
      .team-kick-card.now{background:#fff;color:#14532d;box-shadow:0 8px 28px rgba(0,0,0,.2)}
      .team-kick-label{font-size:.7rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;opacity:.72}
      .team-kick-name{font-size:1.45rem;font-weight:950;line-height:1.08;margin-top:6px;overflow-wrap:anywhere}
      .team-kick-card.now .team-kick-name{font-size:2rem}
      .my-kick-status{margin-top:11px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:10px 12px;position:relative;z-index:1}
      .kick-queue{padding:0;overflow:hidden}.kick-queue-head{padding:13px 14px;border-bottom:1px solid var(--l)}
      .kick-queue-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:9px;align-items:center;padding:11px 13px;border-top:1px solid #edf0f2}
      .kick-queue-row:first-child{border-top:0}.kick-queue-row.current{background:#ecfdf3;border-left:5px solid #15803d;padding-left:8px}.kick-queue-row.next{background:#f7fee7}.kick-queue-row.absent{opacity:.45}
      .kick-queue-num{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#f3f4f6;font-weight:900}.kick-queue-row.current .kick-queue-num{background:#15803d;color:#fff}
      .kick-queue-name{font-weight:850}.kick-queue-status{font-size:.76rem;color:var(--m);margin-top:2px}.kick-queue-badge{font-size:.72rem;font-weight:850;border-radius:999px;padding:4px 7px;background:#f3f4f6;white-space:nowrap}.kick-queue-row.current .kick-queue-badge{background:#15803d;color:#fff}.kick-queue-row.next .kick-queue-badge{background:#d9f99d;color:#365314}
      @media(max-width:650px){.team-kick-stage{grid-template-columns:1fr 1fr}.team-kick-card.now{grid-column:1/-1;min-height:140px}.team-kick-card{min-height:100px}.team-kick-name{font-size:1.2rem}.team-kick-card.now .team-kick-name{font-size:2rem}.kick-queue-row{grid-template-columns:38px minmax(0,1fr) auto;padding:10px}}
    `;document.head.appendChild(style);
  }
  function identityKey(){return window.__teamStorageKey?window.__teamStorageKey('playerName'):'buntCakesPlayerName';}
  function presentSet(){return new Set((state.players||[]).filter(p=>p.present!==false).map(p=>p.name));}
  function activeOrder(){const present=presentSet();return(state.kickingOrder||[]).filter(n=>present.has(n));}
  function info(){const active=activeOrder();if(!active.length)return{active,current:'',index:-1,next:'',third:''};let current=state.currentKicker;if(!current||!active.includes(current))current=active[0];const index=active.indexOf(current);return{active,current,index,next:active[(index+1)%active.length],third:active[(index+2)%active.length]};}
  function personalStatus(i){
    const mine=new URLSearchParams(location.search).get('player')||localStorage.getItem(identityKey())||'';if(!mine)return'';
    const idx=i.active.indexOf(mine);if(idx<0)return '<strong>'+mine+':</strong> you are not in the active kicking queue right now.';
    const away=(idx-i.index+i.active.length)%i.active.length;
    if(away===0)return '<strong>'+mine+': you are kicking now.</strong>';
    if(away===1)return '<strong>'+mine+': you are on deck.</strong> Be ready.';
    if(away===2)return '<strong>'+mine+': get ready.</strong> You are third up.';
    return '<strong>'+mine+':</strong> you are '+away+' turns away.';
  }
  function ensureShell(){
    const section=document.getElementById('kicking'),list=document.getElementById('kickList');if(!section||!list)return null;
    const intro=section.querySelector('.card');if(intro&&!intro.dataset.kickReworked){intro.dataset.kickReworked='1';intro.innerHTML='<strong>Kicking Deck</strong><div class="muted">See who is kicking now and who needs to be ready next.</div>';}
    let hero=document.getElementById('teamKickHero');if(!hero){hero=document.createElement('div');hero.id='teamKickHero';hero.className='card team-kick-hero';list.parentNode.insertBefore(hero,list);}
    return{hero,list};
  }
  renderKicking=function(){
    if(!state)return;const shell=ensureShell();if(!shell)return;const i=info();
    if(!i.active.length){shell.hero.innerHTML='<div class="team-kick-eyebrow">Kicking Deck</div><h2>No available kickers</h2>';shell.list.innerHTML='';return;}
    shell.hero.innerHTML=`<div class="team-kick-eyebrow">Live Kicking Deck</div><div class="team-kick-stage"><div class="team-kick-card now"><div class="team-kick-label">Now Kicking</div><div class="team-kick-name">${i.current}</div></div><div class="team-kick-card"><div class="team-kick-label">On Deck</div><div class="team-kick-name">${i.next}</div></div><div class="team-kick-card"><div class="team-kick-label">Get Ready</div><div class="team-kick-name">${i.third}</div></div></div>${personalStatus(i)?'<div class="my-kick-status">'+personalStatus(i)+'</div>':''}`;
    const present=presentSet();shell.list.className='card kick-queue';shell.list.innerHTML='<div class="kick-queue-head"><strong>Full Kicking Order</strong><div class="muted">The captain controls the live queue.</div></div>';
    (state.kickingOrder||[]).forEach((name,index)=>{
      const activeIndex=i.active.indexOf(name),available=present.has(name),away=available?((activeIndex-i.index+i.active.length)%i.active.length):null;
      const status=!available?'Absent — skipped':name===i.current?'Now kicking':name===i.next?'On deck':name===i.third?'Get ready':away+' turns away';
      const badge=!available?'Skipped':name===i.current?'NOW':name===i.next?'NEXT':name===i.third?'READY':'#'+(index+1);
      const row=document.createElement('div');row.className='kick-queue-row'+(name===i.current?' current':name===i.next?' next':'')+(!available?' absent':'');row.innerHTML=`<div class="kick-queue-num">${index+1}</div><div><div class="kick-queue-name">${name}</div><div class="kick-queue-status">${status}</div></div><span class="kick-queue-badge">${badge}</span>`;shell.list.appendChild(row);
    });
  };
  const wait=setInterval(()=>{if(typeof state!=='undefined'&&state&&document.getElementById('kicking')){clearInterval(wait);renderKicking();}},250);
})();