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

    // Keep the old data/functions available for backward compatibility, but never render
    // the legacy pod UI on the player route. My Rotation owns this section completely.
    html = html.replace('<button data-tab="pods">Pods</button>', '<button data-tab="pods">My Rotation</button>');
    html = html.replace('<strong>Rotation Pods</strong>', '<strong>My Rotation</strong>');
    html = html.replace('Your captain sets these groups. Check here to know where you play each inning, when you rest, and who rotates in after you.', 'See where you play each inning, when you rest, and what changes next.');
    html = html.replace('NEXT INNING • POD SWAPS', 'YOUR NEXT INNING');
    html = html.replace('renderNext();renderNextSwap();renderLineup();renderPods();renderKicking();', 'renderNext();renderLineup();renderKicking();');
    html = html.replace('POD ROTATION', 'YOUR ROTATION');
    html = html.replace(/No rotation pods posted yet\./g, 'No rotation posted yet.');
    html = html.replace(/No pod swaps scheduled for inning /g, 'No rotation changes scheduled for inning ');
    html = html.replace('</body>', '<script src="/team-field-rotation.js?v=4"></script></body>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Team field rotation view failed to load');
  }
};