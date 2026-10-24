/**
 * check-home-defaults-and-absence.cjs
 *
 * Functional checks for the two P0 follow-up fixes (2026-10-23):
 *
 *  A) Home defaults (captain-position-switches.js): the founder captain's
 *     seeded Pitcher/Catcher slots are standing choices. They must count in
 *     buildInnings even when the player has not RSVP'd "yes" — for fresh
 *     configs (seeded manual) and for already-stored configs seeded by older
 *     builds (healed at config load). Ordinary non-manual slots must keep
 *     their RSVP filter.
 *
 *  B) Mark-absent (captain-attendance.js): setManualOverride(name, false)
 *     must strip the player not only from the published innings but also
 *     from that game date's saved per-inning overrides and rotation slots,
 *     so a later rebuild cannot resurrect them.
 *
 * Both modules are loaded for real under DOM stubs and driven through their
 * public window exports.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let failures = 0;
function assert(cond, label) {
  if (cond) { console.log('  ok -', label); }
  else { failures++; console.log('  FAIL -', label); }
}

const realSetTimeout = global.setTimeout;
const realSetInterval = global.setInterval;

/* ---------------- Part A: captain-position-switches.js ---------------- */
console.log('Part A: home defaults in buildInnings');
{
  global.setTimeout = () => 0; // park install()'s retry loop
  global.setInterval = () => 0;
  const rsvpYes = new Set(); // nobody has RSVP'd yes for the game date
  global.window = {
    __teamSlug: 'those-dirty-bunt-cakes',
    addEventListener() {},
    BuntGameDayEligibility: {
      targetDate: () => '2026-10-25',
      isActive: (name) => rsvpYes.has(name),
    },
  };
  global.document = { getElementById: () => null, addEventListener() {} };
  const players = ['Cam', 'CJ', 'Gary', 'Pat', 'Ben', 'Felipe', 'Bryan', 'Chris D']
    .map((name) => ({ name, fullName: name + ' Full', present: false }));
  global.state = {
    team: { timeZone: 'America/New_York' },
    players,
    events: [{ type: 'Game', date: '2026-10-25' }],
    availability: {},
    innings: {},
    fieldSwitches: {
      // A config stored by an OLD build: home defaults seeded manual:false.
      '2026-10-25': {
        version: 3, homeDefaultsSeeded: true, updatedAt: null,
        positions: {
          'Pitcher': { slots: [{ name: 'Cam', manual: false, custom: false }, { name: 'Gary', manual: true, custom: false }], primary: 'Cam', primaryManual: false, switch: 'Gary', switchManual: true },
          'Catcher': { slots: [{ name: 'CJ', manual: false, custom: false }, { name: 'Pat', manual: true, custom: false }], primary: 'CJ', primaryManual: false, switch: 'Pat', switchManual: true },
          'First Base': { slots: [{ name: 'Ben', manual: false, custom: false }, { name: 'Felipe', manual: true, custom: false }], primary: 'Ben', primaryManual: false, switch: 'Felipe', switchManual: true },
          'Shortstop': { slots: [{ name: 'Bryan', manual: true, custom: false }, { name: '', manual: false, custom: false }], primary: 'Bryan', primaryManual: true, switch: '', switchManual: false },
          'Left Center Field': { slots: [{ name: 'Chris D', manual: true, custom: false }, { name: '', manual: false, custom: false }], primary: 'Chris D', primaryManual: true, switch: '', switchManual: false },
        },
      },
    },
    fieldSwitchInningOverrides: {},
  };
  const src = fs.readFileSync(path.join(__dirname, '..', 'captain-position-switches.js'), 'utf8');
  vm.runInThisContext(src, { filename: 'captain-position-switches.js' });
  const api = global.window.BuntPositionSwitches;
  assert(api && typeof api.buildInnings === 'function', 'module exports buildInnings');

  const innings = api.buildInnings();
  assert(innings[1]['Pitcher'] === 'Cam', 'stored config: inning 1 Pitcher is the seeded home default (Cam), not the slot-2 player');
  assert(innings[2]['Pitcher'] === 'Gary', 'stored config: inning 2 Pitcher rotates to Gary');
  assert(innings[1]['Catcher'] === 'CJ', 'stored config: inning 1 Catcher is the seeded home default (CJ)');
  assert(innings[2]['Catcher'] === 'Pat', 'stored config: inning 2 Catcher rotates to Pat');
  const healed = global.state.fieldSwitches['2026-10-25'].positions['Pitcher'].slots[0];
  assert(healed.manual === true && healed.name === 'Cam', 'stored seeded slot was healed to manual:true on load');
  assert(innings[1]['First Base'] === 'Felipe' && innings[2]['First Base'] === 'Felipe',
    'ordinary non-manual slot without an RSVP (Ben) is still filtered; manual slot (Felipe) serves both innings');

  // Fresh config: seeding itself must produce manual home defaults.
  global.state.fieldSwitches = {};
  const fresh = api.buildInnings();
  const seeded = global.state.fieldSwitches['2026-10-25'].positions['Pitcher'].slots[0];
  assert(seeded.name === 'Cam' && seeded.manual === true, 'fresh config seeds Pitcher home default as manual');
  assert(fresh[1]['Pitcher'] === 'Cam', 'fresh config: inning 1 Pitcher is Cam with no RSVP');
  global.setTimeout = realSetTimeout; global.setInterval = realSetInterval;
}

/* ---------------- Part B: captain-attendance.js ---------------- */
console.log('Part B: mark-absent strips overrides and rotation slots');
{
  global.setInterval = () => 0; // park the boot waiter (no #dashboard in the stub)
  global.window = { addEventListener() {}, dispatchEvent() { return true; }, buntCakesSaveNow: async () => {} };
  global.document = {
    getElementById: () => null,
    createElement: () => ({ id: '', textContent: '', style: {} }),
    head: { appendChild() {} },
    addEventListener() {},
  };
  global.state = {
    team: { timeZone: 'America/New_York' },
    players: [{ name: 'PJ', fullName: 'Peter-Joseph DeGiovanni', present: true }, { name: 'Cam', fullName: 'Camron Sanders', present: true }],
    events: [{ type: 'Game', date: '2026-10-25' }],
    availability: {},
    currentKicker: 'PJ',
    innings: {
      1: { 'Right Field': 'PJ', 'First Base': 'Felipe', 'Pitcher': 'Cam' },
      2: { 'Right Field': 'QA Guest', 'Pitcher': 'Gary' },
    },
    fieldSwitchInningOverrides: {
      '2026-10-25': { 1: { 'Right Field': 'PJ', 'Pitcher': 'Cam', 'First Base': 'Felipe' } },
      '2026-11-01': { 1: { 'Right Field': 'PJ' } },
    },
    fieldSwitches: {
      '2026-10-25': {
        positions: {
          'Right Field': { slots: [{ name: 'PJ', manual: true, custom: false }, { name: 'QA Guest', manual: true, custom: true }], primary: 'PJ', primaryManual: true, switch: 'QA Guest', switchManual: true },
        },
      },
      '2026-11-01': {
        positions: {
          'Right Field': { slots: [{ name: 'PJ', manual: true, custom: false }, { name: '', manual: false, custom: false }], primary: 'PJ', primaryManual: true, switch: '', switchManual: false },
        },
      },
    },
  };
  const src = fs.readFileSync(path.join(__dirname, '..', 'captain-attendance.js'), 'utf8');
  vm.runInThisContext(src, { filename: 'captain-attendance.js' });
  const elig = global.window.BuntGameDayEligibility;
  assert(elig && typeof elig.setManualOverride === 'function', 'module exports setManualOverride');

  elig.setManualOverride('PJ', false, '2026-10-25');
  const s = global.state;
  assert(s.innings[1]['Right Field'] === '' && s.innings[1]['Pitcher'] === 'Cam', 'published innings: PJ removed, others untouched');
  assert(s.currentKicker === '', 'current kicker cleared (pre-existing behavior)');
  assert(s.fieldSwitchInningOverrides['2026-10-25'][1]['Right Field'] === '', 'same-date override snapshot: PJ stripped');
  assert(s.fieldSwitchInningOverrides['2026-10-25'][1]['Pitcher'] === 'Cam', 'same-date override snapshot: other players untouched');
  assert(s.fieldSwitchInningOverrides['2026-11-01'][1]['Right Field'] === 'PJ', 'other date override snapshot: untouched (absence is date-scoped)');
  const rf = s.fieldSwitches['2026-10-25'].positions['Right Field'];
  assert(rf.slots[0].name === '' && rf.primary === '', 'same-date rotation slot: PJ stripped and legacy mirror updated');
  assert(rf.slots[1].name === 'QA Guest' && rf.switch === 'QA Guest', 'same-date rotation slot: the guest in slot 2 is untouched');
  assert(s.fieldSwitches['2026-11-01'].positions['Right Field'].slots[0].name === 'PJ', 'other date rotation slot: untouched');
  const pj = s.players.find((p) => p.name === 'PJ');
  assert(pj.present === false && s.gameDayAttendanceOverrides['2026-10-25']['PJ'] === false, 'attendance override recorded and presence updated');
  global.setInterval = realSetInterval;
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
