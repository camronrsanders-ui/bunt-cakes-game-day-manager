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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-1, 1)).toISOString().slice(0,10);
    const end = new Date(Date.UTC(now.getUTCFullYear()+1, now.getUTCMonth()+2, 1)).toISOString().slice(0,10);
    const r = await fetch(`${proto}://${host}/api/leagueapps?start=${start}&end=${end}&cb=${Date.now()}`, {headers:{'User-Agent':'BuntCakesCalendar/1.0'}});
    if (!r.ok) return res.status(502).send('Could not load LeagueApps schedule');
    const data = await r.json();
    const games = (data.events || []).filter(e => e.type === 'Game' && e.date && e.time);

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Those Dirty Bunt Cakes//Game Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Dirty Bunt Cakes Games',
      'X-WR-TIMEZONE:America/New_York'
    ];

    for (const e of games) {
      const endInfo = e.endDate && e.endTime ? {date:e.endDate,time:e.endTime} : gameEnd(e.date,e.time);
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${esc(e.uid || `${e.date}-${e.time}-${e.title}`)}@buntcakes`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`);
      lines.push(`DTSTART;TZID=America/New_York:${icsLocal(e.date,e.time)}`);
      lines.push(`DTEND;TZID=America/New_York:${icsLocal(endInfo.date,endInfo.time)}`);
      lines.push(`SUMMARY:${esc(e.title || 'Dirty Bunt Cakes Game')}`);
      if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
      lines.push(`DESCRIPTION:${esc('Players should arrive 1 hour before game time for warm-up and practice. A second reminder will fire 30 minutes before game time.' + (e.url ? `\nLeagueApps: ${e.url}` : ''))}`);
      if (e.url) lines.push(`URL:${esc(e.url)}`);
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT1H');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Arrival time — be at the field now for warm-up and practice.');
      lines.push('END:VALARM');
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT30M');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Game starts in 30 minutes.');
      lines.push('END:VALARM');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');

    res.setHeader('Content-Type','text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition','inline; filename="dirty-bunt-cakes-games.ics"');
    res.setHeader('Cache-Control','no-store, max-age=0');
    return res.status(200).send(lines.join('\r\n'));
  } catch (error) {
    return res.status(500).send('Could not build game calendar');
  }
};