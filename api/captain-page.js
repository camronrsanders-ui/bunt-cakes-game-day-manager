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

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Captain page failed to load');
  }
};
