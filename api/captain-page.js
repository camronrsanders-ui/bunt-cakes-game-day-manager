module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const upstream = await fetch(`${proto}://${host}/captain.html`, {
      headers: { 'User-Agent': 'BuntCakesCaptainView/1.0' }
    });

    if (!upstream.ok) {
      return res.status(502).send('Could not load captain page');
    }

    let html = await upstream.text();

    // Brand the captain experience with the team logo.
    html = html.replace('<title>Bunt Cakes Captain</title>', '<title>Those Dirty Bunt Cakes Captain</title><link rel="icon" href="/logo.svg" type="image/svg+xml">');
    html = html.replace('</style>', '.brand{display:flex;align-items:center;gap:12px}.brand-logo{width:88px;height:88px;object-fit:contain;flex:0 0 auto;filter:drop-shadow(0 4px 8px rgba(0,0,0,.18))}.login-logo{display:block;width:150px;height:150px;object-fit:contain;margin:-10px auto 4px}.brand h1{line-height:1.05}@media(max-width:520px){.brand-logo{width:72px;height:72px}.brand h1{font-size:1.45rem}}</style>');
    html = html.replace('<div id="login" class="login card"><h1>Captain Access</h1>', '<div id="login" class="login card"><img class="login-logo" src="/logo.svg" alt="Those Dirty Bunt Cakes logo"><h1>Captain Access</h1>');
    html = html.replace(
      '<div class="row wrap"><div><h1 style="margin:.2rem 0">Bunt Cakes Captain Manager</h1><div class="muted">Live team data • changes save automatically</div></div><div><span id="who" class="pill"></span> <button id="logout">Log out</button></div></div>',
      '<div class="row wrap"><div class="brand"><img class="brand-logo" src="/logo.svg" alt="Those Dirty Bunt Cakes logo"><div><h1 style="margin:.2rem 0">Those Dirty Bunt Cakes</h1><div class="muted">Captain Manager • live changes save automatically</div></div></div><div><span id="who" class="pill"></span> <button id="logout">Log out</button></div></div>'
    );

    // Only LeagueApps officiating slots get umpire / line-ref controls.
    html = html.replace(
      "const has=e.type==='Officiating'||e.type==='Game';",
      "const has=e.type==='Officiating';"
    );

    // On re-sync, preserve assignments only for true officiating slots.
    html = html.replace(
      "umpire:o.umpire||'',lineRef1:o.lineRef1||'',lineRef2:o.lineRef2||''",
      "umpire:x.type==='Officiating'?(o.umpire||''):'',lineRef1:x.type==='Officiating'?(o.lineRef1||''):'',lineRef2:x.type==='Officiating'?(o.lineRef2||''):''"
    );

    // The fairness tracker should count only true officiating slots.
    html = html.replace(
      "state.events.filter(e=>e.type==='Officiating'||e.umpire||e.lineRef1||e.lineRef2)",
      "state.events.filter(e=>e.type==='Officiating')"
    );

    // Force schedule times to 12-hour AM/PM format.
    html = html.replace(
      "function fmt(e){if(!e.date)return'';return new Date(e.date+'T12:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+(e.time?' • '+e.time:'')}",
      "function time12(t){if(!t)return'';const [h,m]=t.split(':').map(Number);return new Date(2000,0,1,h,m||0).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}function fmt(e){if(!e.date)return'';return new Date(e.date+'T12:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+(e.time?' • '+time12(e.time):'')}"
    );
    html = html.replace(
      "new Date(r.updatedAt).toLocaleTimeString()",
      "new Date(r.updatedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})"
    );

    // Add player resources to captain view too.
    html = html.replace(
      '<button data-tab="access">Access</button>',
      '<button data-tab="resources">Resources</button><button data-tab="access">Access</button>'
    );
    html = html.replace(
      '<section id="access" class="stack hidden">',
      '<section id="resources" class="stack hidden"><div class="card"><strong>Stonewall Boston Resources</strong><div class="muted">Quick links for players and captains.</div></div><div class="grid g2"><a class="card" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="https://sites.google.com/stonewallsports.org/bos/resources/injured-player-form?authuser=0"><strong>Injured Player Form</strong><div class="muted">Report a player injury through Stonewall Boston.</div></a><a class="card" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="https://sites.google.com/stonewallsports.org/bos/resources/fee-discount-program?authuser=0"><strong>Fee Discount Program</strong><div class="muted">Stonewall Boston fee assistance information.</div></a><a class="card" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="https://docs.google.com/document/u/1/d/e/2PACX-1vQ9OBOHo_OxrX3U46sTHYxStc21qJearXIKuRpZ-FuEWlCXSyCg3nqs5co3zdjUKeVQ_7oELo7-nuKH/pub?pli=1"><strong>Kickball League Document</strong><div class="muted">Published kickball reference document.</div></a><a class="card" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="https://sites.google.com/stonewallsports.org/bos/sports/kickball?authuser=0"><strong>Stonewall Boston Kickball</strong><div class="muted">Official Boston kickball page and league information.</div></a></div></section><section id="access" class="stack hidden">'
    );
    html = html.replace(
      "['dashboard','schedule','roster','lineup','kicking','officials','access']",
      "['dashboard','schedule','roster','lineup','kicking','officials','resources','access']"
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Captain page failed to load');
  }
};
