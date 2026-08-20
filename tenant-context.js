(()=>{
  const DEFAULT='those-dirty-bunt-cakes';
  const match=location.pathname.match(/^\/(?:team|captain)\/([a-z0-9][a-z0-9-]{2,63})(?:\/|$)/i);
  const query=new URLSearchParams(location.search);
  const slug=(match&&match[1]||query.get('team')||DEFAULT).toLowerCase();
  window.__teamSlug=slug;
  window.__teamPath={team:`/team/${slug}`,captain:`/captain/${slug}`,calendar:`/calendar/${slug}.ics`};
  window.__teamStorageKey=(name)=>`teamgameday:${slug}:${name}`;

  const nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    try{
      const raw=typeof input==='string'?input:input&&input.url;
      if(raw){
        const url=new URL(raw,location.origin);
        if(url.origin===location.origin&&['/api/team-state','/api/captains','/api/calendar','/api/session'].includes(url.pathname)&&!url.searchParams.has('team')){
          url.searchParams.set('team',slug);
          if(typeof input==='string') input=url.pathname+url.search+url.hash;
          else input=new Request(url.href,input);
        }
      }
    }catch(e){}
    return nativeFetch(input,init);
  };
})();
