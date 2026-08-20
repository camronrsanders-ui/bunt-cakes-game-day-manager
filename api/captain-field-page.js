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

    // The legacy pod model remains in stored state for compatibility, but Field Rotation
    // is now the only captain-facing UI rendered for this section.
    html = html.replace('<button data-tab="pods">Pods</button>', '<button data-tab="pods">Field Rotation</button>');
    html = html.replace('<strong>Rotation Pods</strong>', '<strong>Field Rotation</strong>');
    html = html.replace('Group players who can rotate through the same positions. Set the pod, then build the 7-inning plan so everyone can see who swaps and who rests.', 'Build the seven innings directly from the field and player preferences.');
    html = html.replace('Add Pod', 'Field Setup');
    html = html.replace('Build 7-Inning Rotation', 'Build Rotation From Preferences');
    html = html.replace('renderDash();renderRoster();renderLineup();renderPods();renderKicking();renderEvents();renderTracker();renderAccess()', 'renderDash();renderRoster();renderLineup();renderKicking();renderEvents();renderTracker();renderAccess()');

    const freshLeagueApps = `<script>(function(){const base=window.api;if(typeof base==='function'){window.api=function(url,opt){if(url==='/api/leagueapps')url='/api/leagueapps?cb='+Date.now();return base(url,opt)}}})();</script>`;
    html = html.replace('</body>', freshLeagueApps + '<script src="/captain-field.js?v=2"></script><script src="/captain-access.js?v=2"></script><script src="/captain-field-rotation.js?v=4"></script><script src="/captain-kicking.js?v=2"></script><script src="/captain-live-sync.js?v=4"></script><script src="/captain-roster-survey.js?v=3"></script><script src="/preferred-names.js?v=1"></script><script src="/captain-results.js?v=1"></script><script src="/captain-attendance.js?v=1"></script></body>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Captain field view failed to load');
  }
};
