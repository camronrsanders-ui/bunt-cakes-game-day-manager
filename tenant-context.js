(()=>{
  const DEFAULT='those-dirty-bunt-cakes';
  const match=location.pathname.match(/^\/(?:team|captain)\/([a-z0-9][a-z0-9-]{2,63})(?:\/|$)/i);
  const query=new URLSearchParams(location.search);
  const slug=(match&&match[1]||query.get('team')||DEFAULT).toLowerCase();
  window.__teamSlug=slug;
  window.__teamPath={team:`/team/${slug}`,captain:`/captain/${slug}`,calendar:`/calendar/${slug}.ics`};
  window.__teamStorageKey=(name)=>`teamgameday:${slug}:${name}`;

  // Every team-scoped API request must carry the Haus slug. Without this,
  // direct /api/* calls fall back to the founding team workspace.
  if(!window.__feildhausTenantFetchInstalled){
    window.__feildhausTenantFetchInstalled=true;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=function(input,init){
      try{
        const requestUrl=typeof input==='string'||input instanceof URL
          ? new URL(String(input),location.origin)
          : new URL(input.url,location.origin);
        if(requestUrl.origin===location.origin&&requestUrl.pathname.startsWith('/api/')){
          const nextInit={...(init||{})};
          const sourceHeaders=(input&&typeof input==='object'&&input.headers)?input.headers:undefined;
          const headers=new Headers(sourceHeaders||{});
          if(init&&init.headers)new Headers(init.headers).forEach((v,k)=>headers.set(k,v));
          headers.set('X-Team-Slug',slug);
          nextInit.headers=headers;
          if(typeof input==='string'||input instanceof URL)return nativeFetch(input,nextInit);
          return nativeFetch(new Request(input,nextInit));
        }
      }catch(_){}
      return nativeFetch(input,init);
    };
  }

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

  function installPilotFeedback(){
    if(document.getElementById('feildhausFeedbackButton'))return;
    const style=document.createElement('style');style.id='feildhaus-feedback-style';style.textContent='.fh-feedback-btn{position:fixed;right:14px;bottom:14px;z-index:9200;border:0!important;border-radius:999px!important;background:#071926!important;color:#fff!important;box-shadow:0 10px 28px rgba(7,25,38,.28);padding:10px 14px!important;font-weight:800!important;min-height:42px!important}.fh-feedback-overlay{position:fixed;inset:0;z-index:9300;background:rgba(7,25,38,.72);display:grid;place-items:end center;padding:16px}.fh-feedback-sheet{width:min(520px,100%);background:#fff;border-radius:22px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.32)}.fh-feedback-sheet h2{margin:.2rem 0}.fh-feedback-types{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.fh-feedback-types button{min-height:44px}.fh-feedback-types button.on{background:#071926!important;color:#fff!important;border-color:#071926!important}.fh-feedback-sheet textarea{width:100%;min-height:120px;border:1px solid #cbd5e1;border-radius:14px;padding:11px;font:inherit;resize:vertical}.fh-feedback-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.fh-feedback-send{background:#20cfa7!important;color:#06201a!important;border-color:#20cfa7!important;font-weight:900!important}@media(max-width:520px){.fh-feedback-overlay{padding:0;align-items:end}.fh-feedback-sheet{border-radius:22px 22px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom))}.fh-feedback-btn{bottom:calc(12px + env(safe-area-inset-bottom))}}';document.head.appendChild(style);
    const button=document.createElement('button');button.id='feildhausFeedbackButton';button.className='fh-feedback-btn';button.type='button';button.textContent='💬 Feedback';document.body.appendChild(button);
    button.onclick=()=>{
      const overlay=document.createElement('div');overlay.className='fh-feedback-overlay';overlay.innerHTML='<div class="fh-feedback-sheet" role="dialog" aria-modal="true" aria-labelledby="fhFeedbackTitle"><div class="muted">FEILDHAUS PILOT</div><h2 id="fhFeedbackTitle">Send feedback</h2><div class="muted">What should we know from this screen?</div><div class="fh-feedback-types"><button type="button" data-cat="bug">🐞 Bug</button><button type="button" data-cat="confusing">🤔 Confusing</button><button type="button" data-cat="idea">💡 Idea</button><button type="button" data-cat="love">💚 Love it</button></div><textarea maxlength="1200" placeholder="Tell us what happened or what would make FeildHaus better."></textarea><div class="fh-feedback-actions"><button type="button" data-close>Cancel</button><button type="button" class="fh-feedback-send" data-send>Send</button></div><div class="muted" data-status style="margin-top:9px"></div></div>';document.body.appendChild(overlay);
      let category='';
      overlay.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{category=b.dataset.cat;overlay.querySelectorAll('[data-cat]').forEach(x=>x.classList.toggle('on',x===b))});
      overlay.querySelector('[data-close]').onclick=()=>overlay.remove();
      overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
      overlay.querySelector('[data-send]').onclick=async()=>{
        const message=overlay.querySelector('textarea').value.trim(),status=overlay.querySelector('[data-status]'),send=overlay.querySelector('[data-send]');
        if(!category){status.textContent='Choose a feedback type first.';return}
        if(!message){status.textContent='Add a quick note before sending.';return}
        send.disabled=true;send.textContent='Sending…';status.textContent='';
        try{
          const r=await fetch('/api/team-state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'pilot-feedback',category,message,screen:location.pathname})});
          const j=await r.json().catch(()=>({}));
          if(!r.ok)throw new Error(j.error||'Could not send feedback');
          status.textContent='✓ Thanks — feedback sent.';
          send.textContent='Sent';
          setTimeout(()=>overlay.remove(),850);
        }catch(err){status.textContent=err.message;send.disabled=false;send.textContent='Send'}
      };
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installPilotFeedback,{once:true});else setTimeout(installPilotFeedback,0);

  function installCaptainShare(){
    if(!location.pathname.startsWith('/captain/')||document.getElementById('feildhausPilotShare'))return;
    const mount=()=>{
      const host=document.querySelector('.app')||document.body;
      if(!host||document.getElementById('feildhausPilotShare'))return;
      const teamUrl=location.origin+window.__teamPath.team;
      const card=document.createElement('section');
      card.id='feildhausPilotShare';
      card.className='card';
      card.style.margin='12px 0';
      card.innerHTML='<div class="muted" style="font-weight:800;letter-spacing:.08em">FEILDHAUS PILOT</div><div class="row wrap" style="margin-top:6px"><div><strong style="font-size:1.05rem">Invite your team</strong><div class="muted">Share the player view for this Haus.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-copy>Copy Link</button><button type="button" data-share>Share</button><button type="button" data-qr>Show QR</button></div></div><div data-status class="muted" style="margin-top:8px"></div>';
      host.prepend(card);
      const status=card.querySelector('[data-status]');
      card.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(teamUrl);status.textContent='✓ Team link copied.'}catch(e){prompt('Copy this team link',teamUrl)}};
      card.querySelector('[data-share]').onclick=async()=>{try{if(navigator.share)await navigator.share({title:'Join our team on FeildHaus',text:'Open our FeildHaus team page:',url:teamUrl});else{await navigator.clipboard.writeText(teamUrl);status.textContent='✓ Team link copied.'}}catch(e){}};
      card.querySelector('[data-qr]').onclick=()=>{
        let overlay=document.getElementById('feildhausQrOverlay');
        if(overlay){overlay.remove();return}
        overlay=document.createElement('div');overlay.id='feildhausQrOverlay';overlay.className='fh-feedback-overlay';
        const qr='https://quickchart.io/qr?size=360&margin=2&text='+encodeURIComponent(teamUrl);
        overlay.innerHTML='<div class="fh-feedback-sheet" style="text-align:center"><div class="muted">FEILDHAUS TEAM INVITE</div><h2 style="margin:.25rem 0 10px">Scan to join this Haus</h2><img src="'+qr+'" alt="QR code for team invite" style="width:min(320px,82vw);height:auto;border-radius:18px;border:1px solid #dbe5e8;background:#fff"><div class="muted" style="margin-top:10px;word-break:break-all">'+teamUrl.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div><button type="button" data-close style="margin-top:12px;width:100%">Done</button></div>';
        document.body.appendChild(overlay);overlay.querySelector('[data-close]').onclick=()=>overlay.remove();overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
      };
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else setTimeout(mount,0);
  }
  installCaptainShare();

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