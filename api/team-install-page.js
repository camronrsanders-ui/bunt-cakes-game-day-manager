module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const upstream = await fetch(`${proto}://${host}/api/team-reminders-page`, {
      headers: { 'User-Agent': 'BuntCakesInstallExperience/1.0' }
    });
    if (!upstream.ok) return res.status(502).send('Could not load team page');

    let html = await upstream.text();

    html = html.replace('</head>', `<script>
      window.__buntInstallPrompt = null;
      window.addEventListener('beforeinstallprompt', function(event) {
        event.preventDefault();
        window.__buntInstallPrompt = event;
        window.dispatchEvent(new Event('buntinstallready'));
      });
    </script></head>`);

    html = html.replace('</style>', `.install-overlay{position:fixed;inset:0;background:rgba(15,23,42,.78);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:16px}.install-sheet{width:min(620px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:24px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.3)}.install-logo{width:92px;height:92px;display:block;margin:0 auto 8px}.install-sheet h2{text-align:center;margin:.25rem 0}.install-step{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:start;margin:12px 0}.install-step b{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#15803d;color:#fff}.install-select{width:100%;margin-top:6px;border:1px solid #d1d5db;border-radius:12px;padding:11px;font:inherit}.install-actions{display:grid;gap:9px;margin-top:14px}.install-actions button{width:100%;font-weight:800}.install-actions .install-primary{background:#15803d;color:#fff;border-color:#15803d}.install-note{background:#f0fdf4;border:1px solid #86efac;border-radius:14px;padding:11px;margin-top:10px}.install-later{background:transparent!important;border:0!important;color:#6b7280!important;font-weight:600!important}.install-hidden{display:none!important}@media(min-width:650px){.install-overlay{align-items:center}.install-sheet{padding:24px}} </style>`);

    html = html.replace('</body>', `<div id="installOverlay" class="install-overlay install-hidden" aria-modal="true" role="dialog" aria-labelledby="installTitle">
      <div class="install-sheet">
        <img class="install-logo" src="/logo.svg" alt="Those Dirty Bunt Cakes logo">
        <h2 id="installTitle">Put Bunt Cakes on your Home Screen</h2>
        <div class="muted" style="text-align:center">Set this up once so game times, lineups, reminders, kicking order and team updates are always easy to reach.</div>

        <div class="install-step"><b>1</b><div><strong>Who is using this phone?</strong><select id="installPlayer" class="install-select"><option value="">Choose your name</option></select></div></div>
        <div id="iosInstallSteps" class="install-hidden">
          <div class="install-step"><b>2</b><div><strong>Tap Share in your browser.</strong><div class="muted">On iPhone, use the Share button / menu for this page.</div></div></div>
          <div class="install-step"><b>3</b><div><strong>Tap Add to Home Screen.</strong><div class="muted">Turn on <em>Open as Web App</em> if your phone shows that option, then tap Add.</div></div></div>
          <div class="install-step"><b>4</b><div><strong>Open Bunt Cakes from the new Home Screen icon.</strong><div class="muted">Opening it from the icon lets the captain dashboard confirm that this phone has app access.</div></div></div>
        </div>
        <div id="promptInstallSteps" class="install-hidden">
          <div class="install-step"><b>2</b><div><strong>Install the Bunt Cakes app.</strong><div class="muted">Use the green Install button below. If your browser does not offer it, open the browser menu and choose Install app or Add to Home screen.</div></div></div>
          <div class="install-step"><b>3</b><div><strong>Open Bunt Cakes from your Home Screen.</strong><div class="muted">That confirms your phone has direct access.</div></div></div>
        </div>
        <div class="install-note"><strong>Game-day expectation:</strong> Players should use the Home Screen app so they can quickly reach the schedule and subscribe to the 1-hour arrival + 30-minute game reminders.</div>
        <div class="install-actions">
          <button id="installAppButton" class="install-primary install-hidden">Install Bunt Cakes</button>
          <button id="installDoneButton" class="install-primary">I added it — I’ll open it from my Home Screen</button>
          <button id="installLaterButton" class="install-later">Continue in browser for now</button>
        </div>
      </div>
    </div>
    <script>
    (function(){
      const overlay=document.getElementById('installOverlay');
      const playerSelect=document.getElementById('installPlayer');
      const iosSteps=document.getElementById('iosInstallSteps');
      const promptSteps=document.getElementById('promptInstallSteps');
      const installBtn=document.getElementById('installAppButton');
      const doneBtn=document.getElementById('installDoneButton');
      const laterBtn=document.getElementById('installLaterButton');
      const isStandalone=window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
      const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
      const params=new URLSearchParams(location.search);
      let player=params.get('player') || localStorage.getItem('buntCakesPlayerName') || '';

      function setPlayer(name){
        player=name||'';
        if(player){
          localStorage.setItem('buntCakesPlayerName',player);
          const u=new URL(location.href);u.searchParams.set('player',player);history.replaceState(null,'',u.pathname+u.search+u.hash);
          checkIn(isStandalone?'installed':'browser');
        }
      }
      async function checkIn(status){
        if(!player)return;
        try{await fetch('/api/player-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerName:player,status})})}catch(e){}
      }
      function updateInstallButton(){
        if(window.__buntInstallPrompt){installBtn.classList.remove('install-hidden');promptSteps.classList.remove('install-hidden')}
      }
      async function loadPlayers(){
        try{
          const r=await fetch('/api/team-state',{cache:'no-store'});const j=await r.json();
          const players=(j.state?.players||[]).slice().sort((a,b)=>(a.fullName||a.name).localeCompare(b.fullName||b.name));
          playerSelect.innerHTML='<option value="">Choose your name</option>'+players.map(p=>'<option value="'+String(p.name).replace(/"/g,'&quot;')+'">'+(p.fullName||p.name)+'</option>').join('');
          if(player){playerSelect.value=player;checkIn(isStandalone?'installed':'browser')}
        }catch(e){}
      }

      playerSelect.addEventListener('change',()=>setPlayer(playerSelect.value));
      window.addEventListener('buntinstallready',updateInstallButton);
      window.addEventListener('appinstalled',()=>{checkIn('installed');localStorage.setItem('buntCakesInstalledAcknowledged','1');overlay.classList.add('install-hidden')});
      installBtn.addEventListener('click',async()=>{
        if(!player){alert('Choose your name first so the captain can confirm your access.');return}
        if(!window.__buntInstallPrompt)return;
        const result=await window.__buntInstallPrompt.prompt();
        window.__buntInstallPrompt=null;
        installBtn.classList.add('install-hidden');
        if(result && result.outcome==='accepted') localStorage.setItem('buntCakesInstallAccepted','1');
      });
      doneBtn.addEventListener('click',()=>{
        if(!player){alert('Choose your name first so the captain can confirm your access.');return}
        localStorage.setItem('buntCakesInstallIntroDismissed','1');
        overlay.classList.add('install-hidden');
      });
      laterBtn.addEventListener('click',()=>{
        if(player)checkIn('browser');
        localStorage.setItem('buntCakesInstallIntroDismissed','1');
        overlay.classList.add('install-hidden');
      });

      if(isIOS){iosSteps.classList.remove('install-hidden')}else{promptSteps.classList.remove('install-hidden')}
      updateInstallButton();
      loadPlayers();
      if(isStandalone){
        if(player)checkIn('installed');
      }else if(!localStorage.getItem('buntCakesInstallIntroDismissed')){
        overlay.classList.remove('install-hidden');
      }
    })();
    </script></body>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Team install page failed to load');
  }
};