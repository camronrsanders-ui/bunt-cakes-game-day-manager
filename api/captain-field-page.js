const { DEFAULT_TEAM_SLUG, normalizeTeamSlug } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const query = req && req.query || {};
    const hasTeam = Object.prototype.hasOwnProperty.call(query, 'team');
    const teamSlug = hasTeam ? normalizeTeamSlug(query.team) : DEFAULT_TEAM_SLUG;
    if (!teamSlug) return res.status(404).send('Team was not found');
    const upstream = await fetch(`${proto}://${host}/api/captain-page`, {
      headers: { 'User-Agent': 'TeamGameDayCaptainFieldView/1.0' }
    });
    if (!upstream.ok) return res.status(502).send('Could not load captain manager');
    let html = await upstream.text();

    if(teamSlug!=='those-dirty-bunt-cakes'){
      html=html.replaceAll('Those Dirty Bunt Cakes','Your Team').replaceAll('Bunt Cakes','Team').replaceAll('/logo.svg','/generic-team-icon.svg');
      html=html.replace('Stonewall Boston Resources','Team Resources').replace('Quick links for players and captains.','Links selected by this team.');
    }

    html = html.replace('</head>', '<script src="/tenant-context.js?v=2"></script></head>');
    html = html.replace(
      "const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});",
      "const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:state?.team?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});"
    );

    html = html.replace(
      /function defaultState\(\)\{[\s\S]*?\}function migrate\(s\)\{/,
      `function defaultState(){const innings={};for(let i=1;i<=7;i++)innings[i]={};return{team:{name:'',shortName:'',organization:'',sport:'Kickball',location:'',primaryColor:'#15803d',accentColor:'#f7fff8',logoDataUrl:'',logoUrl:'',chatUrl:'',announcement:'',arrivalMinutes:60,secondReminderMinutes:30,leagueAppsEnabled:false,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'},playerVisibility:{schedule:true,lineup:true,pods:true,kicking:true,officials:true,resources:true,attendance:true},resources:[],players:[],innings,pods:[],kickingOrder:[],score:{team:0,opponent:0},counts:{balls:0,fouls:0,outs:0},gameInning:1,fieldInning:1,half:'Team kicking',events:[],season:{name:'',division:'',color:'#15803d'},lastLeagueSync:null}}function migrate(s){`
    );

    html = html.replace('<button data-tab="pods">Pods</button>', '<button data-tab="pods">Field Rotation</button>');
    html = html.replace('<strong>Rotation Pods</strong>', '<strong>Field Rotation</strong>');
    html = html.replace('Group players who can rotate through the same positions. Set the pod, then build the 7-inning plan so everyone can see who swaps and who rests.', 'Build the seven innings directly from the field and player preferences.');
    html = html.replace('Add Pod', 'Field Setup');
    html = html.replace('Build 7-Inning Rotation', 'Build Rotation From Preferences');
    html = html.replace('renderDash();renderRoster();renderLineup();renderPods();renderKicking();renderEvents();renderTracker();renderAccess()', 'renderDash();renderRoster();renderLineup();renderKicking();renderEvents();renderTracker();renderAccess()');

    const freshLeagueApps = `<script>(function(){const base=window.api;if(typeof base==='function'){window.api=function(url,opt){if(url==='/api/leagueapps')url='/api/leagueapps?cb='+Date.now();return base(url,opt)}}})();</script>`;
    html = html.replace('</body>', freshLeagueApps + '<script src="/field-profile-model.js?v=2"></script><script src="/captain-field.js?v=3"></script><script src="/captain-access.js?v=3"></script><script src="/captain-field-rotation.js?v=7"></script><script src="/captain-kicking.js?v=2"></script><script src="/captain-live-sync.js?v=6"></script><script src="/captain-roles.js?v=1"></script><script src="/captain-roster-survey.js?v=6"></script><script src="/preferred-names.js?v=1"></script><script src="/captain-results.js?v=1"></script><script src="/captain-attendance.js?v=2"></script><script src="/captain-team-settings.js?v=2"></script><script src="/captain-tab-scope-fix.js?v=2"></script><script src="/captain-team-preview.js?v=1"></script><script src="/captain-tenant-ui.js?v=2"></script><script src="/team-officiating-view.js?v=1"></script><script src="/captain-officiating-rotation.js?v=1"></script><script src="/team-role-badges.js?v=1"></script><script src="/captain-account-controls.js?v=1"></script></body>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Captain field view failed to load');
  }
};
