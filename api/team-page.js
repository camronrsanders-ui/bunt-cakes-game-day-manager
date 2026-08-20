module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const upstream = await fetch(`${proto}://${host}/team.html`, {
      headers: { 'User-Agent': 'BuntCakesTeamView/1.0' }
    });

    if (!upstream.ok) return res.status(502).send('Could not load team page');

    let html = await upstream.text();
    const whatsapp = 'https://chat.whatsapp.com/EUg12yVH0YVKfQPEJplnow';

    const brandedHead = '<title>Those Dirty Bunt Cakes</title><link rel="icon" href="/logo.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><meta name="theme-color" content="#15803d"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Bunt Cakes">';
    html = html.replace('<title>Bunt Cakes Team</title>', brandedHead);
    html = html.replace('</style>', '.brand{display:flex;align-items:center;gap:12px}.brand-logo{width:88px;height:88px;object-fit:contain;flex:0 0 auto;filter:drop-shadow(0 4px 8px rgba(0,0,0,.18))}.brand h1{line-height:1.05}.pod-inning{display:grid;grid-template-columns:72px 1fr;gap:8px;padding:7px 0;border-top:1px solid var(--l)}.pod-inning:first-child{border-top:0}.pod-rest{color:#a16207;font-weight:700}.swap-line{padding:6px 0;border-top:1px solid var(--l)}.swap-line:first-child{border-top:0}.chat-btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:#15803d;color:#fff;border-radius:12px;padding:10px 14px;min-height:44px;font-weight:700}.chat-card{border:2px solid #15803d;background:#f0fdf4}@media(max-width:520px){.brand-logo{width:72px;height:72px}.brand h1{font-size:1.55rem}.pod-inning{grid-template-columns:62px 1fr}.chat-btn{width:100%}}</style>');
    html = html.replace(
      '<div class="row wrap"><div><h1 style="margin:.2rem 0">Bunt Cakes</h1><div class="muted">Live Team View</div></div><div><span id="updated" class="pill">Loading…</span> <button id="refresh">Refresh</button></div></div>',
      `<div class="row wrap"><div class="brand"><img class="brand-logo" src="/logo.svg" alt="Those Dirty Bunt Cakes logo"><div><h1 style="margin:.2rem 0">Those Dirty Bunt Cakes</h1><div class="muted">Live Team View</div></div></div><div><a class="chat-btn" href="${whatsapp}" target="_blank" rel="noopener">Open Team Chat</a> <span id="updated" class="pill">Loading…</span> <button id="refresh">Refresh</button></div></div>`
    );

    // Player-facing rotation pod plan and next-inning swap summary.
    html = html.replace(
      '<button data-tab="kicking">Kicking Order</button>',
      '<button data-tab="pods">Pods</button><button data-tab="kicking">Kicking Order</button>'
    );
    html = html.replace(
      '<div id="next" class="card event"></div><div class="card"><strong>Today’s fielding lineup</strong>',
      `<div id="next" class="card event"></div><div class="card chat-card"><div class="muted">TEAM COMMUNICATION</div><h2 style="margin:.3rem 0">Bunt Cakes WhatsApp</h2><div class="muted" style="margin-bottom:10px">Open the team group chat for announcements, questions, and game-day communication.</div><a class="chat-btn" href="${whatsapp}" target="_blank" rel="noopener">Open Team Chat</a></div><div id="nextSwap" class="card"></div><div class="card"><strong>Today’s fielding lineup</strong>`
    );
    html = html.replace(
      '<section id="kicking" class="stack hidden">',
      '<section id="pods" class="stack hidden"><div class="card"><strong>Rotation Pods</strong><div class="muted">Your captain sets these groups. Check here to know where you play each inning, when you rest, and who rotates in after you.</div></div><div id="podPlan" class="stack"></div></section><section id="kicking" class="stack hidden">'
    );
    html = html.replace(
      '<div class="grid g2"><a class="card resource"',
      `<div class="grid g2"><a class="card resource" target="_blank" rel="noopener" href="${whatsapp}"><strong>Bunt Cakes Team Chat</strong><div class="muted">Open our WhatsApp group for team communication.</div><div class="go">Open WhatsApp ↗</div></a><a class="card resource"`
    );
    html = html.replace(
      'function render(){$(\'teamScore\').textContent=state.score?.team??0;$(\'oppScore\').textContent=state.score?.opponent??0;$(\'inning\').textContent=state.gameInning??1;$(\'half\').textContent=state.half||\'\';renderNext();renderLineup();renderKicking();renderEvents();renderTracker()}',
      'function render(){$(\'teamScore\').textContent=state.score?.team??0;$(\'oppScore\').textContent=state.score?.opponent??0;$(\'inning\').textContent=state.gameInning??1;$(\'half\').textContent=state.half||\'\';renderNext();renderNextSwap();renderLineup();renderPods();renderKicking();renderEvents();renderTracker()}'
    );
    html = html.replace(
      'function renderKicking(){',
      `function inferredPodPositions(name){const n=(name||'').toLowerCase();if(n.includes('pitch'))return ['Pitcher'];if(n.includes('middle'))return ['Second Base','Shortstop'];if(n.includes('corner'))return ['First Base','Third Base'];if(n.includes('left outfield'))return ['Left Field','Left Center Field','Center Field'];if(n.includes('outfield'))return ['Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];return []}function podPositions(p){return Array.isArray(p.positions)&&p.positions.length?p.positions:inferredPodPositions(p.name)}function playerPosition(name,inning){const inn=state.innings?.[inning]||{};return POS.find(pos=>inn[pos]===name)||''}function renderNextSwap(){const box=$('nextSwap');if(!box)return;const pods=state.pods||[],n=state.gameInning||1;if(!pods.length||n>=7){box.innerHTML='<div class="muted">POD ROTATION</div><strong>'+(n>=7?'Final inning — no next-inning swap.':'No rotation pods posted yet.')+'</strong>';return}let lines=[];pods.forEach(p=>{const changes=(p.members||[]).map(name=>({name,now:playerPosition(name,n)||'Rest',next:playerPosition(name,n+1)||'Rest'})).filter(x=>x.now!==x.next);if(changes.length)lines.push('<div class="swap-line"><strong>'+p.name+'</strong><div>'+changes.map(x=>x.name+': '+x.now+' → '+x.next).join(' • ')+'</div></div>')});box.innerHTML='<div class="muted">NEXT INNING • POD SWAPS</div>'+(lines.length?lines.join(''):'<strong>No pod swaps scheduled for inning '+(n+1)+'.</strong>')}function renderPods(){const box=$('podPlan');if(!box)return;const pods=state.pods||[];if(!pods.length){box.innerHTML='<div class="card muted">No rotation pods posted yet.</div>';return}box.innerHTML=pods.map(p=>{const members=p.members||[],positions=podPositions(p);let rows='';for(let i=1;i<=7;i++){const details=members.map(name=>({name,pos:playerPosition(name,i)}));const playing=details.filter(x=>x.pos).map(x=>x.name+' — '+x.pos);const resting=details.filter(x=>!x.pos).map(x=>x.name);rows+='<div class="pod-inning"><strong>Inning '+i+'</strong><div>'+(playing.length?playing.join(' • '):'<span class="muted">No assignments</span>')+(resting.length?'<div class="pod-rest">Rest: '+resting.join(', ')+'</div>':'')+'</div></div>'}return '<div class="card"><div class="row wrap"><strong>'+p.name+'</strong><span class="pill">'+members.length+' players</span></div><div class="muted" style="margin-top:4px"><strong>Players:</strong> '+(members.join(', ')||'Not set')+'</div><div class="muted"><strong>Positions:</strong> '+(positions.join(', ')||'Not set')+'</div><div style="margin-top:9px">'+rows+'</div></div>'}).join('')}function renderKicking(){`
    );
    html = html.replace(
      "['home','schedule','lineup','kicking','officials','resources']",
      "['home','schedule','lineup','pods','kicking','officials','resources']"
    );

    html = html.replace('</body>', '<script src="/team-refresh.js?v=3"></script><script src="/team-kicking.js?v=1"></script></body>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Team page failed to load');
  }
};
