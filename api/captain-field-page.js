module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const upstream = await fetch(`${proto}://${host}/api/captain-page`, {
      headers: { 'User-Agent': 'BuntCakesCaptainFieldView/1.0' }
    });
    if (!upstream.ok) return res.status(502).send('Could not load captain manager');
    let html = await upstream.text();
    html = html.replace('</body>', '<script src="/captain-field.js?v=1"></script><script src="/captain-access.js?v=1"></script></body>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Captain field view failed to load');
  }
};