(()=>{
  if(window.__feildhausCaptainModeInstalled)return;
  window.__feildhausCaptainModeInstalled=true;
  const slug=String(window.__teamSlug||'').trim();
  if(!slug||!location.pathname.startsWith('/team/'))return;

  async function json(url){
    const r=await fetch(url,{credentials:'include',cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Request failed');
    return j;
  }

  function mount(session){
    if(document.getElementById('feildhausCaptainMode'))return;
    if(!session||session.authenticated!==true||!session.team||session.team.slug!==slug)return;

    const bar=document.createElement('div');
    bar.id='feildhausCaptainMode';
    bar.style.cssText='position:sticky;top:0;z-index:9100;background:#071926;color:#fff;border-bottom:1px solid rgba(53,230,174,.35);padding:8px 12px;box-shadow:0 8px 24px rgba(7,25,38,.16)';
    bar.innerHTML='<div style="max-width:980px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:10px"><div style="min-width:0"><strong style="display:block;font-size:.88rem">Captain access active</strong><span style="display:block;color:#b9f5df;font-size:.76rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">You are viewing the player side of this Haus.</span></div><a href="/captain/'+encodeURIComponent(slug)+'" style="flex:0 0 auto;text-decoration:none;background:#35e6ae;color:#06221a;border-radius:999px;padding:8px 12px;font-weight:900;font-size:.82rem">Captain Mode</a></div>';
    document.body.prepend(bar);
  }

  async function check(){
    try{
      const session=await json('/api/session');
      mount(session);
    }catch(_){}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});
  else check();
  window.addEventListener('pageshow',check);
})();