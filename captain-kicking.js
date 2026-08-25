(function(){
  const STYLE_ID='bunt-kicking-deck-styles';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .kick-hero{background:linear-gradient(135deg,#052e16,#166534);color:#fff;border:0;overflow:hidden;position:relative}
      .kick-hero:after{content:'';position:absolute;width:210px;height:210px;border-radius:50%;border:22px solid rgba(255,255,255,.07);right:-82px;top:-78px}
      .kick-eyebrow{font-size:.74rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase;opacity:.78}
      .kick-title{font-size:1.55rem;font-weight:900;margin:.2rem 0 .35rem}
      .kick-stage{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:10px;margin-top:14px;position:relative;z-index:1}
      .kick-now,.kick-next,.kick-third{border-radius:18px;padding:16px;min-height:132px;display:flex;flex-direction:column;justify-content:center}
      .kick-now{background:#fff;color:#14532d;box-shadow:0 8px 28px rgba(0,0,0,.2)}
      .kick-next{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25)}
      .kick-third{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16)}
      .kick-label{font-size:.72rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;opacity:.72}
      .kick-name{font-size:1.6rem;font-weight:950;line-height:1.05;margin-top:6px;overflow-wrap:anywhere}
      .kick-now .kick-name{font-size:2rem}
      .kick-controls{display:grid;grid-template-columns:1fr 1.45fr 1fr;gap:8px;margin-top:12px;position:relative;z-index:1}
      .kick-controls button{font-weight:800;min-height:50px}
      .kick-controls .kick-advance{background:#fff;color:#14532d;border-color:#fff}
      .kick-controls .kick-back,.kick-controls .kick-reset{background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.28)}
      .kick-count-note{font-size:.78rem;opacity:.75;margin-top:8px;position:relative;z-index:1;text-align:center}
      .kick-order-card{padding:0;overflow:hidden}
      .kick-order-head{padding:13px 14px;border-bottom:1px solid var(--l);display:flex;justify-content:space-between;gap:10px;align-items:center}
      .kick-order-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 13px;border-top:1px solid #edf0f2}
      .kick-order-row:first-child{border-top:0}
      .kick-order-row.current{background:#ecfdf3;border-left:5px solid #15803d;padding-left:8px}
      .kick-order-row.next{background:#f7fee7}
      .kick-order-row.absent{opacity:.48;background:#f9fafb}
      .kick-number{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#f3f4f6;font-weight:900}
      .kick-order-row.current .kick-number{background:#15803d;color:#fff}
      .kick-player{font-weight:850;line-height:1.15}
      .kick-status{font-size:.76rem;color:var(--m);margin-top:3px}
      .kick-mini-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
      .kick-mini-actions button{min-height:36px;padding:6px 9px;font-size:.78rem}
      .kick-set{color:#15803d;font-weight:800}
      .kick-away{display:inline-block;margin-left:5px;border-radius:999px;padding:2px 6px;background:#f3f4f6;font-size:.69rem;font-weight:800;color:#6b7280}
      @media(max-width:680px){
        .kick-stage{grid-template-columns:1fr 1fr}.kick-now{grid-column:1/-1;min-height:145px}.kick-next,.kick-third{min-height:105px}.kick-controls{grid-template-columns:1fr 1fr}.kick-controls .kick-advance{grid-column:1/-1;grid-row:1}.kick-name{font-size:1.25rem}.kick-now .kick-name{font-size:2.05rem}.kick-order-row{grid-template-columns:40px minmax(0,1fr)}.kick-mini-actions{grid-column:2;justify-content:flex-start}.kick-order-head{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function activeOrder(){
    if(!state)return[];
    const present=new Set((state.players||[]).filter(p=>p.present!==false).map(p=>p.name));
    return (state.kickingOrder||[]).filter(name=>present.has(name));
  }
  function currentInfo(){
    const active=activeOrder();
    if(!active.length)return{active,current:'',index:-1,next:'',third:'',previous:''};
    let current=state.currentKicker;
    if(!current||!active.includes(current))current=active[0];
    const index=active.indexOf(current);
    return{active,current,index,next:active[(index+1)%active.length],third:active[(index+2)%active.length],previous:active[(index-1+active.length)%active.length]};
  }
  function setCurrent(name,resetCount){
    if(!state||!name)return;
    state.currentKicker=name;
    if(resetCount&&state.counts){state.counts.balls=0;state.counts.fouls=0;}
    queueSave();
    renderKicking();
    if(typeof renderDash==='function')renderDash();
  }
  function step(delta){
    const info=currentInfo();
    if(!info.active.length)return;
    const next=info.active[(info.index+delta+info.active.length)%info.active.length];
    setCurrent(next,delta>0);
  }
  function moveOrder(i,delta){
    const j=i+delta;if(j<0||j>=state.kickingOrder.length)return;
    [state.kickingOrder[i],state.kickingOrder[j]]=[state.kickingOrder[j],state.kickingOrder[i]];
    queueSave();renderKicking();
  }
  function ensureShell(){
    const section=document.getElementById('kicking');
    const list=document.getElementById('kickList');
    if(!section||!list)return null;
    const intro=section.querySelector('.card');
    if(intro&&!intro.dataset.kickReworked){intro.dataset.kickReworked='1';intro.innerHTML='<strong>Bunt Cakes Kicking Deck</strong><div class="muted">One glance tells you who is kicking now, who is on deck, and who needs to get ready.</div>';}
    let hero=document.getElementById('kickHero');
    if(!hero){hero=document.createElement('div');hero.id='kickHero';hero.className='card kick-hero';list.parentNode.insertBefore(hero,list);}
    return{hero,list};
  }

  renderKicking=function(){
    if(!state)return;
    const shell=ensureShell();if(!shell)return;
    const info=currentInfo();
    if(!info.active.length){
      shell.hero.innerHTML='<div class="kick-eyebrow">Kicking Deck</div><div class="kick-title">No available kickers</div><div>Mark players present in the roster to activate the kicking order.</div>';
      shell.list.innerHTML='';return;
    }
    shell.hero.innerHTML=`
      <div class="kick-eyebrow">Live Kicking Deck</div>
      <div class="kick-title">Keep the line moving</div>
      <div class="kick-stage">
        <div class="kick-now"><div class="kick-label">Now Kicking</div><div class="kick-name">${esc(info.current)}</div></div>
        <div class="kick-next"><div class="kick-label">On Deck</div><div class="kick-name">${esc(info.next)}</div></div>
        <div class="kick-third"><div class="kick-label">Get Ready</div><div class="kick-name">${esc(info.third)}</div></div>
      </div>
      <div class="kick-controls">
        <button type="button" class="kick-back">Previous Kicker</button>
        <button type="button" class="kick-advance">Next Kicker</button>
        <button type="button" class="kick-reset">Reset to First Kicker</button>
      </div>
      <div class="kick-count-note">Advancing to the next kicker also clears balls and fouls for the new at-bat.</div>`;
    shell.hero.querySelector('.kick-back').onclick=()=>step(-1);
    shell.hero.querySelector('.kick-advance').onclick=()=>step(1);
    shell.hero.querySelector('.kick-reset').onclick=()=>setCurrent(info.active[0],true);

    const present=new Set((state.players||[]).filter(p=>p.present!==false).map(p=>p.name));
    shell.list.className='card kick-order-card';
    shell.list.innerHTML='<div class="kick-order-head"><div><strong>Full Kicking Order</strong><div class="muted">Tap “Make current” if you need to jump directly to someone.</div></div><span class="pill">'+info.active.length+' available</span></div>';
    (state.kickingOrder||[]).forEach((name,i)=>{
      const isPresent=present.has(name),activeIndex=info.active.indexOf(name);
      const away=isPresent?((activeIndex-info.index+info.active.length)%info.active.length):null;
      const row=document.createElement('div');
      row.className='kick-order-row'+(name===info.current?' current':name===info.next?' next':'')+(!isPresent?' absent':'');
      const status=!isPresent?'Absent — skipped automatically':name===info.current?'Now kicking':name===info.next?'On deck':name===info.third?'Get ready':away===0?'Now':away===1?'Up next':away+' turns away';
      row.innerHTML=`<div class="kick-number">${i+1}</div><div><div class="kick-player">${esc(name)}${isPresent&&away>2?'<span class="kick-away">'+away+' away</span>':''}</div><div class="kick-status">${esc(status)}</div></div><div class="kick-mini-actions"><button type="button" class="kick-set" ${!isPresent?'disabled':''}>Make current</button><button type="button" class="kick-up" ${i===0?'disabled':''}>Move up</button><button type="button" class="kick-down" ${i===state.kickingOrder.length-1?'disabled':''}>Move down</button></div>`;
      row.querySelector('.kick-set').onclick=()=>setCurrent(name,true);
      row.querySelector('.kick-up').onclick=()=>moveOrder(i,-1);
      row.querySelector('.kick-down').onclick=()=>moveOrder(i,1);
      shell.list.appendChild(row);
    });
  };

  const wait=setInterval(()=>{
    if(typeof state!=='undefined'&&state&&document.getElementById('kicking')){clearInterval(wait);renderKicking();}
  },250);
})();