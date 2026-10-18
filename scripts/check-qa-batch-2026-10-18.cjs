const fs=require('fs'),assert=require('node:assert/strict');
// QA batch 2026-10-18 regression guards (code-shape asserts; handlers need a DB).
const ts=fs.readFileSync('api/team-state.js','utf8');
// Public state must not hand the WhatsApp invite or captain alert metadata to
// anonymous slug-knowing visitors, while paired players keep both.
assert.match(ts,/const authed = !!playerName;/,'publicState derives authed from player identity');
assert.match(ts,/if \(!authed\) team\.chatUrl = '';/,'chatUrl stripped for anonymous callers');
assert.match(ts,/chat\\\.whatsapp\\\.com/,'whatsapp resource links filtered for anonymous callers');
assert.match(ts,/captainAlerts: authed && Array\.isArray\(raw\._captainAlerts\)/,'captainAlerts gated on auth');
// Players' Season Record card reads state.gameResults — it must be public.
assert.match(ts,/gameResults: Array\.isArray\(raw\.gameResults\) \? raw\.gameResults : \[\]/,'gameResults included in publicState');
// A player's own availability note must round-trip back to them.
assert.match(ts,/note: answer\.note \|\| '',/,'availability note returned to its author');
// Login must not throw (500) on a malformed stored hash.
const login=fs.readFileSync('api/login.js','utf8');
assert.match(login,/storedBuf\.length === derivedBuf\.length && crypto\.timingSafeEqual/,'login timingSafeEqual is length-guarded');
// Service worker cache identity bumped so old shells are evicted on activate.
const sw=fs.readFileSync('service-worker.js','utf8');
assert.match(sw,/const CACHE='feildhaus-pilot-v5';/,'service worker cache bumped to v5');
// Player reminders honour the captain-configured arrival time, and the
// per-event Add to calendar button survives the replacement renderer.
const rem=fs.readFileSync('api/team-reminders-page.js','utf8');
assert.equal((rem.match(/state\.team\.arrivalMinutes/g)||[]).length,2,'arrivalMinutes used in next-up and schedule rows');
assert.ok(rem.includes('FeildHausAddCalendar'),'schedule rows include the Add to calendar button');
assert.match(rem,/FeildHausAddCalendar\(\\\\'/,'calendar button quotes are escaped for the generated single-quoted renderer');
// Destructive officiating rebuild asks first.
const off=fs.readFileSync('captain-officiating-rotation.js','utf8');
assert.match(off,/confirm\('Rebuild the officiating rotation/,'officiating rebuild requires confirmation');
console.log('PASS QA batch 2026-10-18: public-state gating, gameResults, availability note, login guard, SW v5, arrivalMinutes, calendar button, officiating confirm');
