(()=>{
  const esc=v=>String(v??'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function rolesOf(p){return Array.isArray(p?.roles)?p.roles:String(p?.role||'').split(/\s*(?:\/|,|•|\|)\s*/).filter(Boolean);}
  function firstAidNames(){return new Set((typeof state!=='undefined'&&state?.players||[]).filter(p=>p.firstAidVolunteer===true||rolesOf(p).includes('First Aid')).map(p=>p.name));}
  function decorate(){
    if(typeof state==='undefined'||!state)return;
    const names=firstAidNames();if(!names.size)return;
    const roots=['home','lineup','pods','kicking','officials','players'].map(id=>document.getElementById(id)).filter(Boolean);
    roots.forEach(root=>{
      root.querySelectorAll('strong,span,div').forEach(el=>{
        if(el.dataset.firstAidBadge==='1'||el.children.length)return;
        const text=(el.textContent||'').trim();if(!text)return;
        const name=[...names].find(n=>new RegExp('(^|[\\s.:•—-])'+esc(n)+'($|[\\s,.:•—-])','i').test(text));
        if(!name)return;
        const badge=document.createElement('span');badge.className='first-aid-ribbon';badge.title='First Aid volunteer';badge.setAttribute('aria-label','First Aid volunteer');badge.textContent='🎀';
        el.appendChild(document.createTextNode(' '));el.appendChild(badge);el.dataset.firstAidBadge='1';
      });
    });
  }
  const style=document.createElement('style');style.textContent='.first-aid-ribbon{display:inline-block;font-size:.9em;vertical-align:baseline;filter:saturate(1.15);margin-left:2px}.role-first-aid{color:#be185d;background:#fce7f3;border-color:#f9a8d4}';document.head.appendChild(style);
  let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('buntpreferrednamesrefresh',schedule);window.addEventListener('pageshow',schedule);setInterval(schedule,2500);schedule();
})();
