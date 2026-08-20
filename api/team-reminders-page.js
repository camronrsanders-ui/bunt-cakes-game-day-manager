module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const upstream = await fetch(`${proto}://${host}/api/team-page`, {headers:{'User-Agent':'BuntCakesReminderView/1.0'}});
    if (!upstream.ok) return res.status(502).send('Could not load team page');
    let html = await upstream.text();

    const webcal = `webcal://${host}/calendar.ics`;
    const calendarHttps = `${proto}://${host}/calendar.ics`;

    html = html.replace('</style>', '.reminder-card{border:2px solid var(--a);background:#f0fdf4}.reminder-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.reminder-btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:var(--a);color:#fff;border-radius:12px;padding:10px 14px;min-height:44px;font-weight:700}.reminder-btn.secondary{background:#fff;color:var(--a);border:1px solid var(--a)}.arrival{font-weight:800;color:var(--a);margin-top:6px}@media(max-width:520px){.reminder-actions,.reminder-btn{width:100%}}</style>');

    html = html.replace(
      '<div id="next" class="card event"></div>',
      `<div class="card reminder-card"><div class="muted">GAME REMINDERS</div><h2 style="margin:.3rem 0">Arrive 1 hour before every game</h2><div>Players should be at the field one hour before game time for warm-up and practice. The subscribed calendar sends an arrival reminder 1 hour before and another reminder 30 minutes before the game.</div><div class="reminder-actions"><a class="reminder-btn" href="${webcal}">Enable Game Reminders</a><a class="reminder-btn secondary" href="${calendarHttps}">Download Calendar</a></div></div><div id="next" class="card event"></div>`
    );

    const renderNextStart = html.indexOf('function renderNext(){');
    const renderNextEnd = html.indexOf('function renderLineup(){', renderNextStart);
    if (renderNextStart >= 0 && renderNextEnd > renderNextStart) {
      const newRenderNext = `function minusMinutes(t,mins){if(!t)return'';const [h,m]=t.split(':').map(Number);let total=h*60+m-mins;while(total<0)total+=1440;const hh=Math.floor(total/60)%24,mm=total%60;return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0')}function renderNext(){const now=today(),arr=[...(state.events||[])].filter(e=>e.date&&e.date>=now).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));const e=arr[0];const arrival=e&&e.type==='Game'&&e.time?minusMinutes(e.time,60):'';$('next').innerHTML=e?'<div class="muted">NEXT UP</div><h2 style="margin:.3rem 0">'+(e.title||e.type)+'</h2><div>'+fmt(e)+'</div>'+(e.location?'<div>📍 '+e.location+'</div>':'')+(arrival?'<div class="arrival">Player arrival / warm-up: '+time12(arrival)+'</div>':'')+(e.umpire||e.lineRef1||e.lineRef2?'<div style="margin-top:8px"><strong>Officials:</strong> '+[e.umpire&&'Umpire: '+e.umpire,e.lineRef1&&'Line Ref: '+e.lineRef1,e.lineRef2&&'Line Ref: '+e.lineRef2].filter(Boolean).join(' • ')+'</div>':''):'<div class="muted">No upcoming events yet.</div>'}`;
      html = html.slice(0, renderNextStart) + newRenderNext + html.slice(renderNextEnd);
    }

    const renderEventsStart = html.indexOf('function renderEvents(){');
    const renderEventsEnd = html.indexOf('function renderTracker(){', renderEventsStart);
    if (renderEventsStart >= 0 && renderEventsEnd > renderEventsStart) {
      const newRenderEvents = `function renderEvents(){const arr=[...(state.events||[])].sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));$('events').innerHTML=arr.map(e=>{const arrival=e.type==='Game'&&e.time?minusMinutes(e.time,60):'';return '<div class="card event"><div class="row wrap"><strong>'+(e.title||e.type)+'</strong><span class="pill">'+(e.type||'Event')+'</span></div><div class="muted">'+fmt(e)+(e.location?' • '+e.location:'')+'</div>'+(arrival?'<div class="arrival">Arrive by '+time12(arrival)+' for warm-up & practice</div>':'')+(e.umpire||e.lineRef1||e.lineRef2?'<div style="margin-top:6px">'+[e.umpire&&'Umpire: '+e.umpire,e.lineRef1&&'Line Ref 1: '+e.lineRef1,e.lineRef2&&'Line Ref 2: '+e.lineRef2].filter(Boolean).join(' • ')+'</div>':'')+'</div>'}).join('')||'<div class="card muted">No events posted yet.</div>'}`;
      html = html.slice(0, renderEventsStart) + newRenderEvents + html.slice(renderEventsEnd);
    }

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Team reminder page failed to load');
  }
};
