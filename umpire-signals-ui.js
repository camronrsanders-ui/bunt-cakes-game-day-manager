(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const team=()=>window.__teamSlug||'those-dirty-bunt-cakes';
  const gameId=()=>String(window.BuntUmpireConsole?.currentRulesGameId?.()||'').trim().slice(0,180);
  const signalsUrl=()=>{const id=gameId();return `/api/team-state/umpire?team=${encodeURIComponent(team())}&rules=signals${id?`&rulesGameId=${encodeURIComponent(id)}`:''}`;};
  let requestSeq=0;

  function ensureStyles(){
    if(document.getElementById('umpireSignalsUiStyles'))return;
    const style=document.createElement('style');
    style.id='umpireSignalsUiStyles';
    style.textContent=`
      .rules-mode-bar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.rules-mode-bar button{font-weight:800}.rules-mode-bar .on{background:var(--a,#15803d);color:#fff;border-color:var(--a,#15803d)}
      .signal-list{display:grid;gap:10px}.signal-card{border:1px solid #d1d5db;border-radius:14px;padding:13px;background:#fff}.signal-card h3{margin:0 0 7px}.signal-section{margin-top:8px}.signal-section strong{display:block;font-size:.76rem;letter-spacing:.06em;color:#475569}.signal-source{margin-top:10px;padding-top:9px;border-top:1px solid #e5e7eb;font-size:.82rem;color:#475569}.signal-verified{font-size:.78rem;font-weight:800;color:#166534;margin-bottom:8px}
    `;
    document.head.appendChild(style);
  }

  function safeUrl(value){
    try{const u=new URL(String(value||''),location.href);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return'';}
  }

  function card(signal){
    const sourceUrl=safeUrl(signal.source_url);
    return `<article class="signal-card"><h3>${esc(signal.title)}</h3><div class="signal-verified">✓ League verified signal</div><div class="signal-section"><strong>SIGNAL</strong><div>${esc(signal.instructions)}</div></div><div class="signal-section"><strong>USE WHEN</strong><div>${esc(signal.use_when)}</div></div>${signal.verbal_call?`<div class="signal-section"><strong>VERBAL CALL</strong><div>${esc(signal.verbal_call)}</div></div>`:''}<div class="signal-source">${esc(signal.source_name||'Verified league source')}${sourceUrl?` • <a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source</a>`:''}</div></article>`;
  }

  async function showSignals(overlay){
    const seq=++requestSeq;
    const body=overlay?.querySelector('[data-rules-body]');
    const search=overlay?.querySelector('#rulesSearchInput');
    const buttons=overlay?.querySelectorAll('[data-rules-mode]')||[];
    buttons.forEach(btn=>btn.classList.toggle('on',btn.dataset.rulesMode==='signals'));
    if(search)search.style.display='none';
    if(!body)return;
    body.innerHTML='<div class="muted">Loading verified umpire signals…</div>';
    try{
      const r=await fetch(signalsUrl(),{credentials:'include',cache:'no-store',headers:{'Cache-Control':'no-cache, no-store, must-revalidate'}});
      const j=await r.json().catch(()=>({}));
      if(seq!==requestSeq||!overlay.isConnected)return;
      if(!r.ok)throw new Error(j.error||'Umpire signals are unavailable');
      const signals=Array.isArray(j.signals)?j.signals:[];
      body.innerHTML=signals.length?`<div class="signal-list">${signals.map(card).join('')}</div>`:'<div class="muted">No verified umpire signals are available for this ruleset yet.</div>';
    }catch(e){
      if(seq!==requestSeq||!overlay.isConnected)return;
      body.innerHTML=`<div class="muted">${esc(e.message)}</div>`;
    }
  }

  function showCalls(overlay){
    requestSeq++;
    const search=overlay?.querySelector('#rulesSearchInput');
    const buttons=overlay?.querySelectorAll('[data-rules-mode]')||[];
    buttons.forEach(btn=>btn.classList.toggle('on',btn.dataset.rulesMode==='calls'));
    if(search){search.style.display='';search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));search.focus();}
    const body=overlay?.querySelector('[data-rules-body]');
    if(body)body.innerHTML='<div class="muted">Describe the play, for example “runner left early,” “ball went out of bounds,” or “four fouls.”</div>';
  }

  function enhance(overlay){
    if(!overlay||overlay.dataset.signalsEnhanced==='1')return;
    overlay.dataset.signalsEnhanced='1';
    ensureStyles();
    const search=overlay.querySelector('#rulesSearchInput');
    if(!search)return;
    const bar=document.createElement('div');
    bar.className='rules-mode-bar';
    bar.innerHTML='<button type="button" class="on" data-rules-mode="calls">🔎 What’s the Call?</button><button type="button" data-rules-mode="signals">🤚 Umpire Signals</button>';
    search.insertAdjacentElement('beforebegin',bar);
    bar.querySelector('[data-rules-mode="signals"]').onclick=()=>showSignals(overlay);
    bar.querySelector('[data-rules-mode="calls"]').onclick=()=>showCalls(overlay);
  }

  const observer=new MutationObserver(()=>enhance(document.getElementById('rulesCallsOverlay')));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  enhance(document.getElementById('rulesCallsOverlay'));
})();
