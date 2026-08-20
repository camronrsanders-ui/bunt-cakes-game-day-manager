module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const upstream = await fetch(`${proto}://${host}/api/team-reminders-page`, {
      headers: { 'User-Agent': 'BuntCakesTeamFieldRotation/1.0' }
    });
    if (!upstream.ok) return res.status(502).send('Could not load team view');
    let html = await upstream.text();
    html = html.replace('</body>', '<script src="/team-field-rotation.js?v=1"></script></body>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Team field rotation view failed to load');
  }
};