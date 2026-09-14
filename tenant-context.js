(()=>{
  const DEFAULT='those-dirty-bunt-cakes';
  const match=location.pathname.match(/^\/(?:team|captain)\/([a-z0-9][a-z0-9-]{2,63})(?:\/|$)/i);
  const query=new URLSearchParams(location.search);
  const slug=(match&&match[1]||query.get('team')||DEFAULT).toLowerCase();
  window.__teamSlug=slug;
  window.__teamPath={team:`/team/${slug}`,captain:`/captain/${slug}`,calendar:`/calendar/${slug}.ics`};
  window.__teamStorageKey=(name)=>`teamgameday:${slug}:${name}`;

  // Design-only skin. Do not inject scripts that reorder, rename, hide, or add controls.
  if(!document.querySelector('link[data-premium-team-theme]')){
    const theme=document.createElement('link');
    theme.rel='stylesheet';
    theme.href='/premium-theme.css?v=2';
    theme.dataset.premiumTeamTheme='1';
    document.head.appendChild(theme);
  }
  if(!document.querySelector('link[data-redesign-qa-fixes]')){
    const fixes=document.createElement('link');
    fixes.rel='stylesheet';
    fixes.href='/redesign-qa-fixes.css?v=2';
    fixes.dataset.redesignQaFixes='1';
    document.head.appendChild(fixes);
  }
  document.documentElement.dataset.teamSlug=slug;
  document.documentElement.classList.add('premium-team-ui');

  // Pilot recognition: founding teams keep their original team brand while FeildHaus
  // provides a lightweight platform badge in captain and player views.
  const foundingTeams={
    'those-dirty-bunt-cakes':{number:'001',city:'Boston',classYear:'2026'}
  };
  const founding=foundingTeams[slug];
  function installFeildHausIdentity(){
    if(!document.querySelector('link[data-feildhaus-icon]')){
      const icon=document.createElement('link');icon.rel='icon';icon.type='image/svg+xml';icon.href='/feildhaus-mark.svg';icon.dataset.feildhausIcon='1';document.head.appendChild(icon);
    }
    if(!founding||document.querySelector('.feildhaus-founding-badge'))return;
    const brand=document.querySelector('.brand');
    if(!brand)return;
    const textWrap=brand.querySelector('div');
    if(!textWrap)return;
    const badge=document.createElement('div');
    badge.className='feildhaus-founding-badge';
    badge.setAttribute('aria-label','FeildHaus Founding Team number '+founding.number);
    badge.innerHTML='<img src="/feildhaus-mark.svg" alt="" aria-hidden="true"><span><strong>FeildHaus Founding Team #'+founding.number+'</strong><small>'+founding.city+' · Class of '+founding.classYear+'</small></span>';
    textWrap.appendChild(badge);
    if(!document.getElementById('feildhaus-founding-style')){
      const style=document.createElement('style');style.id='feildhaus-founding-style';style.textContent='.feildhaus-founding-badge{display:inline-flex;align-items:center;gap:7px;margin-top:7px;padding:6px 9px;border-radius:999px;background:#071926;color:#fff;border:1px solid rgba(32,207,167,.55);box-shadow:0 5px 16px rgba(7,25,38,.16)}.feildhaus-founding-badge img{width:25px;height:25px;flex:0 0 auto}.feildhaus-founding-badge span{display:grid;line-height:1.05}.feildhaus-founding-badge strong{font-size:.7rem;letter-spacing:.02em}.feildhaus-founding-badge small{font-size:.61rem;color:#b9f5df;margin-top:2px}@media(max-width:520px){.feildhaus-founding-badge{padding:5px 8px}.feildhaus-founding-badge img{width:22px;height:22px}}';document.head.appendChild(style);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installFeildHausIdentity,{once:true});else setTimeout(installFeildHausIdentity,0);

  const nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    try{
      const raw=typeof input==='string'?input:input&&input.url;
      if(raw){
        const url=new URL(raw,location.origin);
        if(url.origin===location.origin&&['/api/team-state','/api/captains','/api/calendar','/api/session'].includes(url.pathname)&&!url.searchParams.has('team'))url.searchParams.set('team',slug);
        if(url.origin===location.origin&&url.pathname==='/api/team-state'&&location.pathname.startsWith('/team/')&&!url.searchParams.has('player')){
          const player=query.get('player')||localStorage.getItem(window.__teamStorageKey('playerName'))||'';
          if(player)url.searchParams.set('player',player);
        }
        if(typeof input==='string')input=url.pathname+url.search+url.hash;
        else input=new Request(url.href,input);
      }
    }catch(e){}
    return nativeFetch(input,init);
  };
})();