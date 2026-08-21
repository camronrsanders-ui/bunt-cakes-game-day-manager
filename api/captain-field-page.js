module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const upstream = await fetch(`${proto}://${host}/api/captain-page`, {
      headers: { 'User-Agent': 'TeamGameDayCaptainFieldView/1.0' }
    });
    if (!upstream.ok) return res.status(502).send('Could not load captain manager');
    let html = await upstream.text();

    html = html.replace(
      /function defaultState\(\)\{[\s\S]*?\}function migrate\(s\)\{/,
      `function defaultState(){const innings={};for(let i=1;i<=7;i++)innings[i]={};return{team:{name:'',shortName:'',organization:'',sport:'Kickball',location:'',primaryColor:'#15803d',accentColor:'#f7fff8',logoDataUrl:'',logoUrl:'',chatUrl:'',announcement:'',arrivalMinutes:60,secondReminderMinutes:30,leagueAppsEnabled:false,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'America/New_York'},playerVisibility:{schedule:true,lineup:true,pods:true,kicking:true,officials:true,resources:true,attendance:true},resources:[],players:[],innings,pods:[],kickingOrder:[],score:{team:0,opponent:0},counts:{balls:0,fouls:0,outs:0},gameInning:1,fieldInning:1,half:'Team kicking',events:[],season:{name:'',division:'',color:'#15803d'},lastLeagueSync:null}}function migrate(s){`
    );

    html = html.replace('<button data-tab="pods">Pods</button>', '<button data-tab="pods">Field Rotation</button>');
    html = html.replace('<strong>Rotation Pods</strong>', '<strong>Field Rotation</strong>');
    html = html.replace('Group players who can rotate through the same positions. Set the pod, then build the 7-inning plan so everyone can see who swaps and who rests.', 'Build the seven innings directly from the field and player preferences.');
    html = html.replace('Add Pod', 'Field Setup');
    html = html.replace('Build 7-Inning Rotation', 'Build Rotation From Preferences');
    html = html.replace('renderDash();renderRoster();renderLineup();renderPods();renderKicking();renderEvents();renderTracker();renderAccess()', 'renderDash();renderRoster();renderLineup();renderKicking();renderEvents();renderTracker();renderAccess()');

    const freshLeagueApps = `<script>(function(){const base=window.api;if(typeof base==='function'){window.api=function(url,opt){if(url==='/api/leagueapps')url='/api/leagueapps?cb='+Date.now();return base(url,opt)}}})();</script>`;
    html = html.replace('</body>', freshLeagueApps + '<script src="/field-profile-model.js?v=2"></script><script src="/captain-field.js?v=2"></script><script src="/captain-access.js?v=2"></script><script src="/captain-field-rotation.js?v=7"></script><script src="/captain-kicking.js?v=2"></script><script src="/captain-live-sync.js?v=4"></script><script src="/captain-roster-survey.js?v=6"></script><script src="/preferred-names.js?v=1"></script><script src="/captain-results.js?v=1"></script><script src="/captain-attendance.js?v=1"></script><script src="/captain-team-settings.js?v=1"></script><script src="/captain-team-preview.js?v=1"></script></body>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Captain field view failed to load');
  }
};
