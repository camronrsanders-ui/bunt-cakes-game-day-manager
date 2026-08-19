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

    html = html.replace('<title>Bunt Cakes Team</title>', '<title>Those Dirty Bunt Cakes</title><link rel="icon" href="/logo.svg" type="image/svg+xml">');
    html = html.replace('</style>', '.brand{display:flex;align-items:center;gap:12px}.brand-logo{width:88px;height:88px;object-fit:contain;flex:0 0 auto;filter:drop-shadow(0 4px 8px rgba(0,0,0,.18))}.brand h1{line-height:1.05}@media(max-width:520px){.brand-logo{width:72px;height:72px}.brand h1{font-size:1.55rem}}</style>');
    html = html.replace(
      '<div class="row wrap"><div><h1 style="margin:.2rem 0">Bunt Cakes</h1><div class="muted">Live Team View</div></div><div><span id="updated" class="pill">Loading…</span> <button id="refresh">Refresh</button></div></div>',
      '<div class="row wrap"><div class="brand"><img class="brand-logo" src="/logo.svg" alt="Those Dirty Bunt Cakes logo"><div><h1 style="margin:.2rem 0">Those Dirty Bunt Cakes</h1><div class="muted">Live Team View</div></div></div><div><span id="updated" class="pill">Loading…</span> <button id="refresh">Refresh</button></div></div>'
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Team page failed to load');
  }
};
