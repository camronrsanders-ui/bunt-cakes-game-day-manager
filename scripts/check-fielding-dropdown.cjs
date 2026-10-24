/**
 * check-fielding-dropdown.cjs
 *
 * Fielding player dropdowns (captain-position-switches.js playerOptions):
 * captains pick from who is actually here without leaving Fielding.
 *  - Players active for the game date (RSVP yes or Captain override) lead
 *    the list in a "Here for this game" group and are marked "— here".
 *  - Everyone else follows in "Not here yet".
 *  - A player already placed in the rotation is greyed (opt-assigned) and
 *    annotated "at <position>" in the OTHER selects — but never in the
 *    select that holds them, and never disabled: still fully selectable.
 *
 * Loads the real module under a DOM stub rich enough for mount/render and
 * inspects the generated editor HTML.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let failures = 0;
function assert(cond, label) {
  if (cond) { console.log('  ok -', label); }
  else { failures++; console.log('  FAIL -', label); }
}

const src = fs.readFileSync(path.join(__dirname, '..', 'captain-position-switches.js'), 'utf8');
assert(src.includes('#pods option.opt-here{font-weight:800}'), 'source: here options are bolded');
assert(src.includes('#pods option.opt-assigned{color:#9ca3af}'), 'source: assigned options are greyed');

function makeEl(id) {
  return {
    id, innerHTML: '', textContent: '', className: '', value: '', disabled: false,
    dataset: {}, style: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    querySelectorAll: () => [], querySelector: () => null,
    appendChild() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {},
  };
}
const byId = new Map();
const here = new Set(['Gary', 'Felipe']);
global.window = {
  __teamSlug: 'those-dirty-bunt-cakes',
  addEventListener() {},
  BuntGameDayEligibility: {
    targetDate: () => '2026-10-25',
    isActive: (name) => here.has(name),
  },
};
global.document = {
  getElementById: (id) => { if (!byId.has(id)) byId.set(id, makeEl(id)); return byId.get(id); },
  createElement: () => makeEl(''),
  head: makeEl('head'),
  querySelector: () => null,
  addEventListener() {},
};
global.state = {
  team: { timeZone: 'America/New_York' },
  players: [
    { name: 'Gary', fullName: 'Gary Riedel-Gaudet', present: true },
    { name: 'Felipe', fullName: 'Felipe Parra', present: true },
    { name: 'Cam', fullName: 'Camron Sanders', present: false },
    { name: 'Ben', fullName: 'Ben DeLillo', present: false },
  ],
  events: [{ type: 'Game', date: '2026-10-25' }],
  availability: {},
  innings: {},
  fieldSwitches: {
    '2026-10-25': {
      version: 3, homeDefaultsSeeded: true, updatedAt: null,
      positions: {
        'Pitcher': { slots: [{ name: 'Gary', manual: true, custom: false }, { name: '', manual: false, custom: false }], primary: 'Gary', primaryManual: true, switch: '', switchManual: false },
        'First Base': { slots: [{ name: 'Felipe', manual: true, custom: false }, { name: '', manual: false, custom: false }], primary: 'Felipe', primaryManual: true, switch: '', switchManual: false },
      },
    },
  },
  fieldSwitchInningOverrides: {},
};

vm.runInThisContext(src, { filename: 'captain-position-switches.js' });

function selectBlock(html, pos, index) {
  const marker = `<select data-pos="${pos}" data-index="${index}">`;
  const start = html.indexOf(marker);
  if (start < 0) return '';
  const end = html.indexOf('</select>', start);
  return html.slice(start, end);
}
function optionFor(block, value) {
  const m = block.match(new RegExp(`<option value="${value}"[^>]*>[^<]*</option>`));
  return m ? m[0] : '';
}

const positions = byId.get('switchPositions').innerHTML;
assert(positions.includes('<optgroup label="Here for this game">'), 'editors: "Here for this game" group exists');
assert(positions.indexOf('<optgroup label="Here for this game">') < positions.indexOf('<optgroup label="Not here yet">'), 'editors: here group comes before not-here group');

const pitcher = selectBlock(positions, 'Pitcher', 0);
const garyOwn = optionFor(pitcher, 'Gary');
assert(garyOwn.includes('opt-here') && !garyOwn.includes('opt-assigned'), 'own select: Gary is bold-here but NOT greyed');
assert(garyOwn.includes('selected') && garyOwn.includes('— here'), 'own select: Gary selected with "— here" note');

const catcher = selectBlock(positions, 'Catcher', 0);
const garyOther = optionFor(catcher, 'Gary');
assert(garyOther.includes('opt-here') && garyOther.includes('opt-assigned'), 'other select: Gary is both here-bold and assigned-grey');
assert(garyOther.includes('at Pitcher'), 'other select: Gary annotated "at Pitcher"');
const felipeOther = optionFor(catcher, 'Felipe');
assert(felipeOther.includes('opt-assigned') && felipeOther.includes('at First Base'), 'other select: Felipe greyed with "at First Base"');
const camOpt = optionFor(catcher, 'Cam');
assert(camOpt && !camOpt.includes('opt-'), 'not-here unassigned player (Cam) renders plain');
assert(catcher.indexOf('value="Gary"') < catcher.indexOf('value="Cam"'), 'ordering: here player (Gary) listed before not-here player (Cam)');
assert(!/disabled/.test(catcher), 'no option is disabled — assignment stays fully flexible');

const quick = byId.get('switchQuick').innerHTML;
assert(quick.includes('<optgroup label="Here for this game">'), 'quick panel: here group present');
const garyQuick = (quick.match(/<option value="Gary"[^>]*>[^<]*<\/option>/) || [''])[0];
assert(garyQuick.includes('opt-assigned') && garyQuick.includes('at Pitcher'), 'quick panel: Gary greyed with "at Pitcher"');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
