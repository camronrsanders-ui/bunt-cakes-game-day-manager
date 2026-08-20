function formatLeagueDate(value) {
  const d = new Date(value + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()}`;
}

function defaultRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+7, 1));
  const iso = d => d.toISOString().slice(0,10);
  return { start: iso(start), end: iso(end) };
}

function unescapeIcs(value='') {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function parseIcsDate(prop='') {
  const value = typeof prop === 'string' ? prop : (prop && prop.value) || '';
  const v = value.trim();
  let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '', allDay: true };
  m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return { date:'', time:'', allDay:false };

  // IMPORTANT: Stonewall Boston's LeagueApps iCal feed currently appends a trailing Z
  // while the numeric clock value itself matches the published Boston local schedule.
  // Converting that value from UTC shifts games 4 hours earlier during EDT and 5 hours
  // earlier during EST. Preserve the exported wall clock exactly so 150000Z displays
  // as 3:00 PM Boston time, matching LeagueApps and the league schedule.
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}`, allDay: false };
}

function classifyEvent(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('umpire/line ref timeslot')) return 'Officiating';
  if (text.includes('team meet and greet')) return 'League Event';
  if (text.includes('playoffs')) return 'Tournament';
  if (text.includes('practice')) return 'Practice';
  if (/\bvs\.?\b|\bgame\b/.test(text)) return 'Game';
  return 'League Event';
}

function stableLeagueId(rawUid, description, start, title) {
  const activity = description.match(/\/activities\/(\d+)/i)?.[1];
  if (activity) return `leagueapps-activity-${activity}`;
  const leading = String(rawUid || '').match(/^(\d{6,12})/)?.[1];
  if (leading) return `leagueapps-${leading}`;
  return `leagueapps-${start.date}-${start.time}-${title}`;
}

function extractRsvpUrl(description) {
  return description.match(/RSVP Here:\s*(https?:\/\/\S+)/i)?.[1] || '';
}

function parseCalendar(text) {
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = [];
  for (const line of rawLines) {
    if (/^[ \t]/.test(line) && lines.length) lines[lines.length-1] += line.slice(1);
    else lines.push(line);
  }

  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') {
      if (current) {
        const start = parseIcsDate(current.DTSTART || '');
        const end = parseIcsDate(current.DTEND || '');
        const title = unescapeIcs(current.SUMMARY || 'LeagueApps event');
        const description = unescapeIcs(current.DESCRIPTION || '');
        const rawUid = unescapeIcs(current.UID || '');
        events.push({
          uid: stableLeagueId(rawUid, description, start, title),
          title,
          type: classifyEvent(title, description),
          date: start.date,
          time: start.time,
          endDate: end.date,
          endTime: end.time,
          allDay: start.allDay,
          location: unescapeIcs(current.LOCATION || ''),
          description,
          url: unescapeIcs(current.URL || '') || extractRsvpUrl(description)
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const lhs = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const chunks = lhs.split(';');
    const key = chunks[0].toUpperCase();
    const params = {};
    chunks.slice(1).forEach(part => {
      const eq = part.indexOf('=');
      if (eq > 0) params[part.slice(0,eq).toUpperCase()] = part.slice(eq+1);
    });
    if (['DTSTART','DTEND'].includes(key)) current[key] = { value, params };
    else if (['UID','SUMMARY','DESCRIPTION','LOCATION','URL'].includes(key)) current[key] = value;
  }
  return events.filter(e => e.date).sort((a,b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const range = defaultRange();
  const start = typeof req.query.start === 'string' ? req.query.start : range.start;
  const end = typeof req.query.end === 'string' ? req.query.end : range.end;
  const startLeague = formatLeagueDate(start);
  const endLeague = formatLeagueDate(end);
  if (!startLeague || !endLeague) return res.status(400).json({ error: 'Invalid date range' });

  const url = new URL('https://stonewallboston.leagueapps.com/ajax/loadSchedule');
  url.searchParams.set('origin','site');
  url.searchParams.set('scope','user');
  url.searchParams.set('publishedOnly','0');
  url.searchParams.set('itemType','games_events');
  url.searchParams.set('userScope','me_kids');
  url.searchParams.set('startsAfterDate', startLeague);
  url.searchParams.set('startsBeforeDate', endLeague);
  url.searchParams.set('programId','');
  url.searchParams.set('iCalExport','true');
  url.searchParams.set('userId','51159133');
  url.searchParams.set('cb', String(Date.now()));

  try {
    const upstream = await fetch(url, { headers: { 'User-Agent': 'BuntCakesSchedule/1.0', 'Accept': 'text/calendar,*/*' } });
    if (!upstream.ok) {
      const body = await upstream.text().catch(()=>'');
      return res.status(502).json({ error: `LeagueApps returned ${upstream.status}`, detail: body.slice(0,300) });
    }
    const text = await upstream.text();
    const events = parseCalendar(text);
    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=1800');
    return res.status(200).json({ source:'LeagueApps', start, end, count:events.length, events });
  } catch (error) {
    return res.status(502).json({ error:'Could not reach LeagueApps', detail:String(error && error.message || error) });
  }
};
