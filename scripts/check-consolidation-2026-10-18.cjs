const fs=require('fs'),assert=require('node:assert/strict');
// Post-game consolidation batch 2026-10-18 regression guards.
const read=f=>fs.readFileSync(f,'utf8');

// C-2: legacy pods can no longer publish a lineup, and wear no Fielding labels.
const capPage=read('api/captain-page.js');
assert.ok(!capPage.includes("$('applyPods').onclick=buildPodRotation"),'pods Build button no longer rewrites the lineup');
assert.match(capPage,/\$\('applyPods'\)\.onclick=\(\)=>\{alert\('Pod rotations no longer publish the lineup/,'pods Build explains itself');
const fieldPage=read('api/captain-field-page.js');
assert.ok(!fieldPage.includes("replace('Add Pod', 'Auto Assign')"),'no Add Pod -> Auto Assign rename');
assert.ok(!fieldPage.includes("replace('Build 7-Inning Rotation', 'Update live')"),'no pods Update live rename');
assert.ok(!fieldPage.includes('captain-field.js'),'hidden legacy Lineup editor script removed from captain page');
assert.ok(fieldPage.includes('&manifest=1'),'captain page emits the per-team manifest');
assert.ok(fieldPage.includes('captain-live-sync.js?v=13'),'live-sync cache bumped');
assert.ok(fieldPage.includes('captain-position-switch-loader.js?v=14'),'switch loader cache bumped');

// H-1: no upcoming game -> explanation, never a crashed empty Fielding grid.
const loader=read('captain-position-switch-loader.js');
assert.match(loader,/if\(!hasUpcomingGame\(\)\)\{showNoGame\(\);return;\}/,'loader shows the no-game card instead of loading the controller');
assert.ok(loader.includes('captain-position-switches.js?v=12'),'switches cache bumped');
const switches=read('captain-position-switches.js');
assert.match(switches,/if\(!cfg\)\{box\.innerHTML=/,'renderPositions guards a missing game config');
assert.match(switches,/homeDefaultsEnabled/, 'founder home defaults are slug-gated');
assert.match(switches,/__buntNoteExternalVersion\(result\.updatedAt\)/,'publish reports its server version to the save sync');
assert.ok(!switches.includes('Draft preview • tap Update live to share'),'no draft/publish copy that contradicts auto-publish');
const liveSync=read('captain-live-sync.js');
assert.match(liveSync,/window\.__buntNoteExternalVersion=v=>/,'live-sync accepts external version notes');

// Captain boot + events.
const capHtml=read('captain.html');
assert.match(capHtml,/Could not load team data:/,'boot failure surfaces inside the visible manager');
assert.match(capHtml,/prompt\('Event title/,'Add Event collects a real title');
assert.ok(!capHtml.includes("title:'New team event'"),'Add Event no longer drops placeholder junk');

// H-2: events are editable (manual) and deletable from the captain schedule.
assert.match(capPage,/Edit event/,'manual events have an Edit action');
assert.match(capPage,/Delete this event\?/,'events have a Delete action with confirmation');

// Player page: one copy of each shared module, Umpire tab cannot get stuck.
const teamPage=read('api/team-page.js');
assert.ok(teamPage.includes('data-team-officiating-view="1"'),'static officiating view carries the dedupe marker');
assert.ok(teamPage.includes('data-bunt-umpire-console="1"'),'static umpire console carries the dedupe marker');
assert.match(teamPage,/umpEl&&b\.dataset\.tab!=='umpire'/,'tab switches hide a leftover Umpire section');
const reminders=read('api/team-reminders-page.js');
assert.ok(reminders.includes('data-bunt-field-rotation="1"'),'static field rotation carries the dedupe marker');
assert.ok(reminders.includes('data-team-captain-alerts="1"'),'static captain alerts carries the dedupe marker');
assert.ok(reminders.includes('&manifest=1'),'player page emits the per-team manifest');
assert.ok(!reminders.includes('That launch confirms your phone access'),'install copy no longer promises pairing it cannot do');

// Feedback tells unpaired players up front.
const tenant=read('tenant-context.js');
assert.match(tenant,/Pair this phone first/,'feedback gate explains pairing before composing');

// Server: full-state saves must name their base version; LeagueApps is captains-only.
const ts=read('api/team-state.js');
assert.match(ts,/code:'VERSION_REQUIRED'/,'PUT without expectedUpdatedAt is rejected');
const league=read('api/leagueapps.js');
assert.match(league,/getCaptain\(req\)/,'leagueapps requires a captain session');
assert.match(league,/Captain sign-in required/,'leagueapps 401 message');

// Service worker: navigations are network-first (no stale-shell race).
const sw=read('service-worker.js');
assert.ok(sw.includes("const CACHE='feildhaus-pilot-v6';"),'service worker cache bumped to v6');
assert.ok(!sw.includes('quickFallback'),'the stale-shell race is gone');

// Platform config.
const vercel=JSON.parse(read('vercel.json'));
assert.equal(vercel.crons.length,1,'one cron entry');
assert.equal(vercel.crons[0].schedule,'0 * * * *','reminders cron runs hourly for every timezone');
const sources=vercel.redirects.map(r=>r.source);
for(const p of ['/index.html','/team.html','/captain.html'])assert.ok(sources.includes(p),'legacy redirect '+p);
assert.ok(JSON.stringify(vercel.headers).includes('frame-ancestors'),'frame protection header set');

// Dead code: never-loaded modules are gone so audits stop reading them as live.
for(const f of ['captain-pod-controller.js','captain-pod-rotation.js','captain-pod-save-fix.js','captain-field-rotation.js','captain-field-auto-sync.js','premium-ui.js','team-pods-organizer.js','team-position-editor.js','pilot-feedback.js','enhancements.js'])assert.ok(!fs.existsSync(f),f+' deleted');
console.log('PASS consolidation batch 2026-10-18: pods publish removed, no-game Fielding, dedupe markers, umpire tab, manifests, feedback gate, PUT version, leagueapps auth, SW network-first, vercel headers/cron/redirects, dead code deleted');
