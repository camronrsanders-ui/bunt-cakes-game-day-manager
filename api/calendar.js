function esc(value='') {
  return String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}

function icsLocal(date, time) {
  if (!date || !time) return '';
  return `${date.replace(/-/g,'')}T${time.replace(':','')}00`;
}

function gameEnd(date, time, minutes=50) {
  const [y,m,d] = date.split('-').map(Number);
  const [hh,mm] = time.split(':').map(Number);
  const dt = new Date(Date.UTC(y,m-1,d,hh,mm));
  dt.setUTCMinutes(dt.getUTCMinutes()+minutes);
  return {
    date: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`,
    time: `${String(dt.getUTCHours()).padStart(2,'0')}:${String(dt.getUTCMinutes()).padStart(2,'0')}`
  };
}

function slug(value='team') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50) || 'team';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const r = await fetch(`${proto}://${host}/api/team-state?fresh=${Date.now()}`, {headers:{'User-Agent':'TeamGameDayCalendar/1.0'},cache:'no-store'});
    if (!r.ok) return res.status(502).send('Could not load team schedule');
    const data = await r.json();
    const state = data.state || {};
    const team = state.team || {};
    const teamName = team.name || 'Team';
    const shortName = team.shortName || teamName;
    const timeZone = team.timeZone || 'America/New_York';
    const arrival = Math.max(0, Math.min(180, Number(team.arrivalMinutes ?? 60)));
    const second = Math.max(0, Math.min(180, Number(team.secondReminderMinutes ?? 30)));
    const games = (state.events || []).filter(e => e.type === 'Game' && e.date && e.time).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//${esc(teamName)}//Game Calendar//EN`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(shortName)} Games`,
      `X-WR-TIMEZONE:${esc(timeZone)}`
    ];

    for (const e of games) {
      const endInfo = e.endDate && e.endTime ? {date:e.endDate,time:e.endTime} : gameEnd(e.date,e.time);
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${esc(e.sourceUid || e.uid || `${e.date}-${e.time}-${e.title}`)}@teamgameday`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`);
      lines.push(`DTSTART;TZID=${esc(timeZone)}:${icsLocal(e.date,e.time)}`);
      lines.push(`DTEND;TZID=${esc(timeZone)}:${icsLocal(endInfo.date,endInfo.time)}`);
      lines.push(`SUMMARY:${esc(e.title || `${teamName} Game`)}`);
      if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
      const reminderText = arrival ? `Players should arrive ${arrival} minutes before game time.` : 'Game time reminder.';
      lines.push(`DESCRIPTION:${esc(reminderText + (e.url ? `\nSchedule link: ${e.url}` : ''))}`);
      if (e.url) lines.push(`URL:${esc(e.url)}`);
      if (arrival > 0) {
        lines.push('BEGIN:VALARM');
        lines.push(`TRIGGER:-PT${arrival}M`);
        lines.push('ACTION:DISPLAY');
        lines.push(`DESCRIPTION:${esc(`Arrival time — ${teamName} warm-up / check-in.`)}`);
        lines.push('END:VALARM');
      }
      if (second > 0 && second !== arrival) {
        lines.push('BEGIN:VALARM');
        lines.push(`TRIGGER:-PT${second}M`);
        lines.push('ACTION:DISPLAY');
        lines.push(`DESCRIPTION:${esc(`Game starts in ${second} minutes.`)}`);
        lines.push('END:VALARM');
      }
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');

    res.setHeader('Content-Type','text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition',`inline; filename="${slug(shortName)}-games.ics"`);
    res.setHeader('Cache-Control','no-store, max-age=0');
    return res.status(200).send(lines.join('\r\n'));
  } catch (error) {
    return res.status(500).send('Could not build game calendar');
  }
};
