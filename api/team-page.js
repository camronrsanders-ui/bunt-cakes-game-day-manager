module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const upstream = await fetch(`${proto}://${host}/team.html`, {
      headers: { 'User-Agent': 'TeamGameDayTeamView/1.0' }
    });

    if (!upstream.ok) return res.status(502).send('Could not load team page');

    let html = await upstream.text();
    const brandedHead = '<title>Team Game Day</title><link rel="icon" href="/generic-team-icon.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" sizes="180x180" href="/generic-team-icon.svg"><meta name="theme-color" content="#15803d"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Game Day">';
    html = html.replace('<title>Bunt Cakes Team</title>', brandedHead);
    html = html.replace('</style>', '.brand{display:flex;align-items:center;gap:12px}.brand-logo{width:88px;height:88px;object-fit:contain;flex:0 0 auto;filter:drop-shadow(0 4px 8px rgba(0,0,0,.18))}.brand h1{line-height:1.05}.chat-btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:var(--a);color:#fff;border-radius:12px;padding:10px 14px;min-height:44px;font-weight:700}.chat-card{border:2px solid var(--a);background:#f0fdf4}@media(max-width:520px){.brand-logo{width:72px;height:72px}.brand h1{font-size:1.55rem}.chat-btn{width:100%}}</style>');
    html = html.replace(
      '<div class="row wrap"><div><h1 style="margin:.2rem 0">Bunt Cakes</h1><div class="muted">Live Team View</div></div><div><span id="updated" class="pill">Loading…</span> <button id="refresh">Refresh</button></div></div>',
      '<div class="row wrap"><div class="brand"><img class="brand-logo" src="/generic-team-icon.svg" alt="Team logo"><div><h1 style="margin:.2rem 0">Your Team</h1><div class="muted">Live Team View</div></div></div><div><a class="chat-btn" style="display:none" href="#" target="_blank" rel="noopener">Open Team Chat</a> <span id="updated" class="pill">Loading…</span> <button id="refresh">Refresh</button></div></div>'
    );

    html = html.replace('<button data-tab="kicking">Kicking Order</button>','<button data-tab="pods">My Rotation</button><button data-tab="kicking">Kicking Order</button>');
    html = html.replace(
      '<div id="next" class="card event"></div><div class="card"><strong>Today’s fielding lineup</strong>',
      '<div id="next" class="card event"></div><div class="card chat-card" style="display:none"><div class="muted">TEAM COMMUNICATION</div><h2 style="margin:.3rem 0">Team Chat</h2><div class="muted" style="margin-bottom:10px">Open the team group chat for announcements, questions, and game-day communication.</div><a class="chat-btn" style="display:none" href="#" target="_blank" rel="noopener">Open Team Chat</a></div><div id="nextSwap" class="card"></div><div class="card"><strong>Today’s fielding lineup</strong>'
    );
    html = html.replace(
      '<section id="kicking" class="stack hidden">',
      '<section id="pods" class="stack hidden"><div class="card"><strong>My Rotation</strong><div class="muted">See where you field, when you switch, and when you rest.</div></div></section><section id="kicking" class="stack hidden">'
    );
    html = html.replace(
      "const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});",
      "const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:state?.team?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});"
    );
    html = html.replace("['home','schedule','lineup','kicking','officials','resources']","['home','schedule','lineup','pods','kicking','officials','resources']");
    html = html.replace('load();setInterval(load,20000);', 'load();');
    html = html.replace('</body>', '<script src="/team-refresh.js?v=11"></script><script src="/team-kicking.js?v=1"></script><script src="/team-officiating-view.js?v=1"></script><script src="/rules-visual-renderer.js?v=1"></script><script src="/umpire-console.js?v=2"></script></body>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Team page failed to load');
  }
};
