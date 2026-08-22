(()=>{
  const DEFAULT='those-dirty-bunt-cakes';
  const match=location.pathname.match(/^\/(?:team|captain)\/([a-z0-9][a-z0-9-]{2,63})(?:\/|$)/i);
  const query=new URLSearchParams(location.search);
  const slug=(match&&match[1]||query.get('team')||DEFAULT).toLowerCase();
  window.__teamSlug=slug;
  window.__teamPath={team:`/team/${slug}`,captain:`/captain/${slug}`,calendar:`/calendar/${slug}.ics`};
  window.__teamStorageKey=(name)=>`teamgameday:${slug}:${name}`;

  // Shared premium visual layer. Team-specific branding can still override --a / colors at runtime.
  if(!document.querySelector('link[data-premium-team-theme]')){
    const theme=document.createElement('link');
    theme.rel='stylesheet';
    theme.href='/premium-theme.css?v=1';
    theme.dataset.premiumTeamTheme='1';
    document.head.appendChild(theme);
  }
  if(!document.querySelector('script[data-premium-team-ui]')){
    const ui=document.createElement('script');
    ui.src='/premium-ui.js?v=1';
    ui.defer=true;
    ui.dataset.premiumTeamUi='1';
    document.head.appendChild(ui);
  }
  document.documentElement.dataset.teamSlug=slug;
  document.documentElement.classList.add('premium-team-ui');

  const nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    try{
      const raw=typeof input==='string'?input:input&&input.url;
      if(raw){
        const url=new URL(raw,location.origin);
        if(url.origin===location.origin&&['/api/team-state','/api/captains','/api/calendar','/api/session'].includes(url.pathname)&&!url.searchParams.has('team')){
          url.searchParams.set('team',slug);
        }
        if(url.origin===location.origin&&url.pathname==='/api/team-state'&&location.pathname.startsWith('/team/')&&!url.searchParams.has('player')){
          const player=query.get('player')||localStorage.getItem(window.__teamStorageKey('playerName'))||'';
          if(player)url.searchParams.set('player',player);
        }
        if(typeof input==='string') input=url.pathname+url.search+url.hash;
        else input=new Request(url.href,input);
      }
    }catch(e){}
    return nativeFetch(input,init);
  };
})();