(()=>{
  function currentTeam(s){return{primaryColor:'#15803d',accentColor:'#f7fff8',name:'',shortName:'',logoDataUrl:'',logoUrl:'',leagueAppsEnabled:false,...((s&&s.team)||{})}}
  function apply(s){
    const t=currentTeam(s),name=t.name||'Team Game Day';
    document.documentElement.style.setProperty('--a',t.primaryColor||'#15803d');
    document.documentElement.style.setProperty('--bg',t.accentColor||'#f7fff8');
    document.querySelectorAll('.brand-logo,.login-logo').forEach(img=>{img.src=t.logoDataUrl||t.logoUrl||'/generic-team-icon.svg';img.alt=name+' logo'});
    const managerTitle=document.querySelector('#manager .brand h1');if(managerTitle)managerTitle.textContent=t.name||'Your Team';
    const loginTitle=document.querySelector('#login h1');if(loginTitle)loginTitle.textContent=t.name?`${t.name} Captain Access`:'Team Captain Access';
    const sync=document.getElementById('sync');if(sync){const card=sync.closest('.card');if(card)card.style.display=t.leagueAppsEnabled?'':'none'}
  }
  async function publicBrand(){try{const r=await fetch('/api/team-state?fresh='+Date.now(),{cache:'no-store'}),j=await r.json();if(r.ok)apply(j.state||{})}catch(e){apply({})}}
  publicBrand();
  const timer=setInterval(()=>{if(typeof state!=='undefined'&&state){apply(state)}},1200);
  window.addEventListener('pageshow',()=>{if(typeof state!=='undefined'&&state)apply(state);else publicBrand()});
})();
