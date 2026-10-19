/* Guards the unified Umpire Console game bar (umpire-tracker.js v3):
   ONE scoreboard — the bar mounts inside the console card and drives the
   console's shared game record (teamAScore/teamBScore/inning/kickingTeam);
   the console no longer renders its own duplicate score cards or inning /
   kicking selects. Rules flow follows SSB Kickball Rules Section 4:
   5 innings max, 40:00 clock (30 turf), no new inning at/after time,
   home-held bottom skip (4.4), regular-season ties stand / playoff extras
   (4.5), 6-run half cap (4.3.1), slaughter check (4.3.2). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failures++; };

const tracker = read('umpire-tracker.js');
const consoleJs = read('umpire-console.js');
for (const pageFile of ['api/team-page.js', 'api/captain-field-page.js']) {
  const page = read(pageFile);
  ok(pageFile + ' loads the game bar v4 next to console v7', page.includes('umpire-tracker.js?v=4') && page.includes('umpire-console.js?v=7'));
}

// --- Unified-console wiring ---
ok('console renders the game bar mount point', consoleJs.includes('id="umpireGameBar"'));
ok('console mounts the bar with its shared game record io', consoleJs.includes('UmpireGameBar.mount') && consoleJs.includes('gameFor(event.eventId)'));
ok('console no longer renders duplicate score cards', !consoleJs.includes('data-score-team') && !consoleJs.includes('id="umpireTeamA"'));
ok('console no longer renders duplicate inning/kicking selects', !consoleJs.includes('id="umpireInning"') && !consoleJs.includes('id="umpireKicking"') && !consoleJs.includes('id="umpireNextHalf"'));
ok('console count controls remain (balls/strikes/fouls/outs)', consoleJs.includes('data-count="balls"') && consoleJs.includes('id="umpireResetCounts"'));
ok('bar exposes the mount API and no standalone card', tracker.includes('window.UmpireGameBar') && !tracker.includes('umpire-tracker-card') && !tracker.includes('insertAdjacentElement'));
ok('bar drives the shared record fields only', tracker.includes('teamBScore') && tracker.includes('teamAScore') && tracker.includes("kickingTeam:'a'") && tracker.includes("kickingTeam:'b'"));
ok('bar keeps clock meta per officiating slot', tracker.includes("feildhaus-umpire-tracker-v3:'") && tracker.includes('eventId'));
ok('game setup open state survives console re-renders', tracker.includes('setupOpen') && tracker.includes("addEventListener('toggle'") && tracker.includes('if(det&&sess.setupOpen&&!det.open)det.open=true;'));
ok('console pauses live refresh while game setup is open', consoleJs.includes("utb-setup[open]") && consoleJs.includes('function editingConsole()'));

// --- Core rules flow (view-based) ---
const store = {};
const sandbox = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  navigator: {}, console, setInterval: () => 0, clearInterval: () => {},
  document: undefined,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(tracker, sandbox);
const C = sandbox.window.UmpireGameTrackerCore;
ok('core is exposed for tests', !!C && typeof C.endHalfView === 'function');

function view(over) { return Object.assign({ inning: 1, half: 'top', away: 0, home: 0, mode: 'regular', timeUp: false, extra: false, over: false, finalReason: '', runsThisHalf: 0 }, over || {}); }

let v = view();
ok('top 1 -> bottom 1', C.endHalfView(v) === 'to-bottom');
v.half = 'bottom';
ok('bottom 1 -> next inning', C.endHalfView(v) === 'next-inning');
v = view({ inning: 5, half: 'top', away: 2, home: 5 });
ok('home leading after top of 5th ends the game (4.4)', C.endHalfView(v) === 'final' && v.over === true && v.finalReason === 'home-held');
v = view({ inning: 5, half: 'top', away: 5, home: 2 });
ok('away leading after top of 5th still plays the bottom', C.endHalfView(v) === 'to-bottom');
v = view({ inning: 5, half: 'bottom', away: 5, home: 2 });
ok('bottom of 5th with a leader is final', C.endHalfView(v) === 'final' && v.finalReason === 'regulation');
v = view({ inning: 5, half: 'bottom', away: 3, home: 3 });
ok('regular-season tie stands (4.5)', C.endHalfView(v) === 'final' && v.finalReason === 'tie');
v = view({ inning: 5, half: 'bottom', away: 3, home: 3, mode: 'playoffs' });
ok('playoff tie goes to extras (4.5)', C.endHalfView(v) === 'extra-start' && v.extra === true);
v = view({ inning: 6, half: 'bottom', away: 4, home: 3, mode: 'playoffs', extra: true });
ok('decided extra inning is final', C.endHalfView(v) === 'final' && v.finalReason === 'extra-decided');
v = view({ inning: 6, half: 'bottom', away: 4, home: 4, mode: 'playoffs', extra: true });
ok('tied extra inning continues', C.endHalfView(v) === 'extra-next');
v = view({ inning: 2, half: 'bottom', away: 1, home: 0, timeUp: true });
ok('time-up bottom of 2nd with a leader is final', C.endHalfView(v) === 'final');
v = view({ inning: 2, half: 'top', away: 0, home: 1, timeUp: true });
ok('time-up top with home leading skips the bottom (4.4)', C.endHalfView(v) === 'final' && v.finalReason === 'home-held');
ok('run cap at 6 in regular season', C.capReached(view({ runsThisHalf: 6 })) === true);
ok('no run cap in playoffs', C.capReached(view({ runsThisHalf: 9, mode: 'playoffs' })) === false);
ok('slaughter needs gap AND (30 min or 3 innings)', C.slaughterMet(view({ away: 10, home: 0, inning: 2 }), 29 * 60000) === false
  && C.slaughterMet(view({ away: 10, home: 0, inning: 2 }), 30 * 60000) === true
  && C.slaughterMet(view({ away: 10, home: 0, inning: 4 }), 5 * 60000) === true);
const m = C.createMeta(); m.durationMin = 40;
ok('40-minute default limit', C.limitMs(m) === 40 * 60000);
m.runningSince = 100000;
ok('countdown decreases while running', C.remainingMs(m, 100000 + 61000) === 40 * 60000 - 61000);
ok('clock formats as MM:SS', C.fmtClock(40 * 60000) === '40:00' && C.fmtClock(0) === '00:00');

// --- Mount smoke test with a fake DOM: one scoreboard, driven by the bar ---
function fakeEl() {
  const el = { _cache: {}, style: {}, dataset: {}, textContent: '', value: '', disabled: false,
    classList: { toggle() {}, add() {}, remove() {} },
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html || ''; },
    querySelector(sel) { if (sel === '.utb' && !this._html) return null; return this._cache[sel] || (this._cache[sel] = fakeEl()); },
    querySelectorAll(sel) {
      if (sel === '[data-score]') return this._scores || (this._scores = [0, 1, 2, 3].map((i) => { const b = fakeEl(); b.dataset = { score: i < 2 ? 'away' : 'home', d: i % 2 ? '1' : '-1' }; return b; }));
      if (sel.includes('data-mode')) return this._modes || (this._modes = [0, 1].map((i) => { const b = fakeEl(); b.dataset = { mode: i ? 'playoffs' : 'regular' }; return b; }));
      if (sel.includes('data-dur')) return this._durs || (this._durs = [0, 1].map((i) => { const b = fakeEl(); b.dataset = { dur: i ? '30' : '40' }; return b; }));
      if (sel === '.utb-inn') return this._inns || (this._inns = [0, 1].map((i) => { const b = fakeEl(); b.dataset = { d: i ? '1' : '-1' }; return b; }));
      return [];
    },
    addEventListener() {}, appendChild() {}, contains() { return true; } };
  return el;
}
const docStub = { getElementById: () => null, createElement: () => fakeEl(), head: fakeEl(), contains: () => true };
const sandbox2 = { localStorage: sandbox.localStorage, navigator: {}, console, setInterval: () => 0, clearInterval: () => {}, document: docStub, confirm: () => true };
sandbox2.window = sandbox2; sandbox2.window.__teamSlug = 'test-team';
vm.createContext(sandbox2);
vm.runInContext(tracker, sandbox2);
const game = { teamAName: 'Home Sox', teamBName: 'Away Cats', teamAScore: 0, teamBScore: 0, balls: 0, strikes: 0, fouls: 0, outs: 0, inning: 1, kickingTeam: 'b' };
const patches = [];
const io = { eventId: 'evt-1', getGame: () => game, patch: (p) => { patches.push(p); Object.assign(game, p); } };
const barEl = fakeEl();
let mountThrew = '';
try { sandbox2.window.UmpireGameBar.mount(barEl, io); } catch (e) { mountThrew = e.message; }
ok('bar mounts without throwing (' + (mountThrew || 'clean') + ')', mountThrew === '');
ok('bar shows the official 40:00 clock', barEl.querySelector('.utb-clock').textContent === '40:00');
const awayPlus = barEl.querySelectorAll('[data-score]')[1];
awayPlus.onclick();
ok('bar + Run patches the shared away score', patches.some((p) => p.teamBScore === 1));
const afterScore = patches.length;
barEl.querySelector('.utb-half').onclick();
ok('bar End-half patches kicking team + count reset to the shared record', patches.slice(afterScore).some((p) => p.kickingTeam === 'a' && p.balls === 0 && p.outs === 0));

console.log(failures ? `\n${failures} check(s) failed` : '\nAll umpire game bar checks passed');
process.exit(failures ? 1 : 0);
