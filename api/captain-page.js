module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const upstream = await fetch(`${proto}://${host}/captain.html`, {
      headers: { 'User-Agent': 'BuntCakesCaptainView/1.0' }
    });

    if (!upstream.ok) {
      return res.status(502).send('Could not load captain page');
    }

    let html = await upstream.text();

    // Brand the captain experience with the team logo and PWA metadata.
    const brandedHead = '<title>Those Dirty Bunt Cakes Captain</title><link rel="icon" href="/logo.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><meta name="theme-color" content="#15803d"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Bunt Cakes">';
    html = html.replace('<title>Bunt Cakes Captain</title>', brandedHead);
    html = html.replace('</style>', '.brand{display:flex;align-items:center;gap:12px}.brand-logo{width:88px;height:88px;object-fit:contain;flex:0 0 auto;filter:drop-shadow(0 4px 8px rgba(0,0,0,.18))}.login-logo{display:block;width:150px;height:150px;object-fit:contain;margin:-10px auto 4px}.brand h1{line-height:1.05}.pod-options{display:flex;flex-wrap:wrap;gap:7px;margin-top:7px}.pod-check{display:flex;align-items:center;gap:5px;border:1px solid var(--l);border-radius:999px;padding:6px 9px;background:#fff}.pod-check input{width:auto;margin:0}.pod-preview{display:grid;gap:5px;margin-top:10px}.pod-inning{display:grid;grid-template-columns:72px 1fr;gap:8px;padding:7px 0;border-top:1px solid var(--l)}.pod-inning:first-child{border-top:0}.pod-rest{color:#a16207;font-weight:700}@media(max-width:520px){.brand-logo{width:72px;height:72px}.brand h1{font-size:1.45rem}.pod-inning{grid-template-columns:62px 1fr}}</style>');
    html = html.replace('</style>', '.schedule-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.schedule-stat{background:#f9fafb;border:1px solid var(--l);border-radius:13px;padding:9px 10px}.schedule-stat strong{display:block;font-size:1.15rem}.schedule-section-title{font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--m);padding:4px 2px}.day-group{background:#fff;border:1px solid var(--l);border-radius:18px;overflow:hidden}.day-group.past{opacity:.68}.day-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:#f3f4f6;border-bottom:1px solid var(--l)}.day-date{font-weight:800;font-size:1.05rem}.day-count{font-size:.78rem;color:var(--m);white-space:nowrap}.schedule-event-row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;padding:13px 14px;border-top:1px solid #eceff1}.schedule-event-row:first-of-type{border-top:0}.schedule-time{font-weight:800;font-size:.95rem}.schedule-title{font-weight:800;line-height:1.25}.schedule-top{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}.schedule-meta{color:var(--m);font-size:.9rem;margin-top:4px}.schedule-chip{font-size:.72rem;font-weight:800;padding:4px 7px;border-radius:999px;white-space:nowrap}.schedule-game{color:#15803d;background:#ecfdf3}.schedule-off{color:#b45309;background:#fff7ed}.schedule-league{color:#2563eb;background:#eff6ff}.schedule-tour{color:#7c3aed;background:#f5f3ff}.schedule-other{color:#4b5563;background:#f3f4f6}.schedule-assign{margin-top:9px;padding:10px;background:#fff7ed;border-radius:12px}.schedule-assign .g3{gap:7px}@media(max-width:650px){.schedule-event-row{grid-template-columns:78px minmax(0,1fr);gap:9px;padding:12px}.schedule-summary{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:390px){.schedule-summary{grid-template-columns:1fr}.schedule-event-row{grid-template-columns:70px minmax(0,1fr)}}</style>');
    html = html.replace('<div id="login" class="login card"><h1>Captain Access</h1>', '<div id="login" class="login card"><img class="login-logo" src="/logo.svg" alt="Those Dirty Bunt Cakes logo"><h1>Captain Access</h1>');
    html = html.replace(
      '<div class="row wrap"><div><h1 style="margin:.2rem 0">Bunt Cakes Captain Manager</h1><div class="muted">Live team data • changes save automatically</div></div><div><span id="who" class="pill"></span> <button id="logout">Log out</button></div></div>',
      '<div class="row wrap"><div class="brand"><img class="brand-logo" src="/logo.svg" alt="Those Dirty Bunt Cakes logo"><div><h1 style="margin:.2rem 0">Those Dirty Bunt Cakes</h1><div class="muted">Captain Manager • live changes save automatically</div></div></div><div><span id="who" class="pill"></span> <button id="logout">Log out</button></div></div>'
    );

    // Restore rotation pods: captain sets players + positions, then builds the 7-inning swap plan.
    html = html.replace(
      '<button data-tab="kicking">Kicking</button>',
      '<button data-tab="pods">Pods</button><button data-tab="kicking">Kicking</button>'
    );
    html = html.replace(
      '<section id="kicking" class="stack hidden">',
      '<section id="pods" class="stack hidden"><div class="card"><div class="row wrap"><div><strong>Rotation Pods</strong><div class="muted">Group players who can rotate through the same positions. Set the pod, then build the 7-inning plan so everyone can see who swaps and who rests.</div></div><button id="addPod">Add Pod</button></div><button id="applyPods" class="primary" style="margin-top:10px;width:100%">Build 7-Inning Rotation</button></div><div id="podList" class="stack"></div></section><section id="kicking" class="stack hidden">'
    );
    html = html.replace(
      "if(!s.events)s.events=[];if(!s.score)s.score={team:0,opponent:0};",
      "if(!s.events)s.events=[];if(!s.pods)s.pods=[];if(!s.score)s.score={team:0,opponent:0};"
    );
    html = html.replace(
      'function render(){renderDash();renderRoster();renderLineup();renderKicking();renderEvents();renderTracker();renderAccess()}',
      'function render(){renderDash();renderRoster();renderLineup();renderPods();renderKicking();renderEvents();renderTracker();renderAccess()}'
    );
    html = html.replace(
      'function renderKicking(){',
      `function inferredPodPositions(name){const n=(name||'').toLowerCase();if(n.includes('pitch'))return ['Pitcher'];if(n.includes('middle'))return ['Second Base','Shortstop'];if(n.includes('corner'))return ['First Base','Third Base'];if(n.includes('left outfield'))return ['Left Field','Left Center Field','Center Field'];if(n.includes('outfield'))return ['Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];return []}function ensurePods(){state.pods=state.pods||[];state.pods.forEach(p=>{p.members=Array.isArray(p.members)?p.members:[];p.positions=Array.isArray(p.positions)&&p.positions.length?p.positions:inferredPodPositions(p.name)})}function playerPositionInInning(name,inning){const inn=state.innings?.[inning]||{};return POS.find(pos=>inn[pos]===name)||''}function podPreview(p){let out='';for(let i=1;i<=7;i++){const active=p.members.map(n=>({n,pos:playerPositionInInning(n,i)}));const playing=active.filter(x=>x.pos).map(x=>esc(x.n)+' — '+esc(x.pos));const resting=active.filter(x=>!x.pos).map(x=>esc(x.n));out+='<div class="pod-inning"><strong>Inning '+i+'</strong><div>'+(playing.length?playing.join(' • '):'<span class="muted">No pod assignments</span>')+(resting.length?'<div class="pod-rest">Rest: '+resting.join(', ')+'</div>':'')+'</div></div>'}return out}function renderPods(){ensurePods();const box=$('podList');if(!box)return;box.innerHTML='';if(!state.pods.length){box.innerHTML='<div class="card muted">No rotation pods yet. Add one to group players who can swap positions.</div>';return}state.pods.forEach((p,pi)=>{const d=document.createElement('div');d.className='card';d.innerHTML='<div class="row wrap"><label style="flex:1">Pod name<input class="podName" value="'+esc(p.name)+'"></label><button class="danger removePod">Remove</button></div><div style="margin-top:9px"><strong>Positions this pod covers</strong><div class="pod-options posOpts">'+POS.map(pos=>'<label class="pod-check"><input type="checkbox" value="'+esc(pos)+'" '+(p.positions.includes(pos)?'checked':'')+'>'+esc(pos)+'</label>').join('')+'</div></div><div style="margin-top:9px"><strong>Players in this pod</strong><div class="pod-options memberOpts">'+state.players.map(pl=>'<label class="pod-check"><input type="checkbox" value="'+esc(pl.name)+'" '+(p.members.includes(pl.name)?'checked':'')+'>'+esc(pl.name)+'</label>').join('')+'</div></div><div class="muted" style="margin-top:9px">Rotation order: '+(p.members.length?p.members.map(esc).join(' → '):'Choose players')+'</div><div class="pod-preview">'+podPreview(p)+'</div>';d.querySelector('.podName').onchange=e=>{p.name=e.target.value.trim()||'Rotation Pod';queueSave();renderPods()};d.querySelector('.removePod').onclick=()=>{state.pods.splice(pi,1);queueSave();renderPods()};d.querySelectorAll('.posOpts input').forEach(cb=>cb.onchange=()=>{p.positions=[...d.querySelectorAll('.posOpts input:checked')].map(x=>x.value);queueSave();renderPods()});d.querySelectorAll('.memberOpts input').forEach(cb=>cb.onchange=()=>{p.members=[...d.querySelectorAll('.memberOpts input:checked')].map(x=>x.value);queueSave();renderPods()});box.appendChild(d)})}function buildPodRotation(){ensurePods();const pods=state.pods.filter(p=>p.members.length&&p.positions.length);if(!pods.length){alert('Add players and positions to at least one pod first.');return}const covered=new Set(pods.flatMap(p=>p.positions));for(let inning=1;inning<=7;inning++){const inn=state.innings[inning]||(state.innings[inning]={});covered.forEach(pos=>{inn[pos]=''});const used=new Set(Object.values(inn).filter(Boolean));pods.forEach(p=>{const members=p.members.filter(n=>state.players.some(pl=>pl.name===n&&pl.present!==false));if(!members.length)return;const start=(inning-1)%members.length;p.positions.forEach((pos,slot)=>{let pick='';for(let t=0;t<members.length;t++){const candidate=members[(start+slot+t)%members.length];if(!used.has(candidate)){pick=candidate;break}}if(pick){inn[pos]=pick;used.add(pick)}})})}queueSave();render();alert('7-inning pod rotation built. Players can now see their swap and rest plan in Team View.')}function renderKicking(){`
    );
    html = html.replace(
      "$('addPlayer').onclick=()=>{const n=prompt('Player name');if(!n)return;state.players.push({id:uid(),name:n.trim(),role:'',present:true});state.kickingOrder.push(n.trim());queueSave();render()};",
      "$('addPlayer').onclick=()=>{const n=prompt('Player name');if(!n)return;state.players.push({id:uid(),name:n.trim(),role:'',present:true});state.kickingOrder.push(n.trim());queueSave();render()};$('addPod').onclick=()=>{state.pods=state.pods||[];state.pods.push({id:uid(),name:'New Rotation Pod',members:[],positions:[]});queueSave();renderPods()};$('applyPods').onclick=buildPodRotation;"
    );

    // Keep pod membership valid when roster names change or players are removed.
    html = html.replace(
      "state.events.forEach(ev=>['umpire','lineRef1','lineRef2'].forEach(k=>{if(ev[k]===old)ev[k]=n}));queueSave();render()",
      "state.events.forEach(ev=>['umpire','lineRef1','lineRef2'].forEach(k=>{if(ev[k]===old)ev[k]=n}));(state.pods||[]).forEach(p=>{p.members=(p.members||[]).map(x=>x===old?n:x)});queueSave();render()"
    );
    html = html.replace(
      "state.players.splice(i,1);state.kickingOrder=state.kickingOrder.filter(x=>x!==p.name);queueSave();render()",
      "state.players.splice(i,1);state.kickingOrder=state.kickingOrder.filter(x=>x!==p.name);(state.pods||[]).forEach pod=>{}"
    );
    html = html.replace(
      "(state.pods||[]).forEach pod=>{}",
      "(state.pods||[]).forEach(pod=>{pod.members=(pod.members||[]).filter(x=>x!==p.name)});queueSave();render()"
    );

    // Only LeagueApps officiating slots get umpire / line-ref controls.
    html = html.replace(
      "const has=e.type==='Officiating'||e.type==='Game';",
      "const has=e.type==='Officiating';"
    );

    // On re-sync, preserve assignments only for true officiating slots.
    html = html.replace(
      "umpire:o.umpire||'',lineRef1:o.lineRef1||'',lineRef2:o.lineRef2||''",
      "umpire:x.type==='Officiating'?(o.umpire||''):'',lineRef1:x.type==='Officiating'?(o.lineRef1||''):'',lineRef2:x.type==='Officiating'?(o.lineRef2||''):''"
    );

    // The fairness tracker should count only true officiating slots.
    html = html.replace(
      "state.events.filter(e=>e.type==='Officiating'||e.umpire||e.lineRef1||e.lineRef2)",
      "state.events.filter(e=>e.type==='Officiating')"
    );

    // Force schedule times to 12-hour AM/PM format.
    html = html.replace(
      "function fmt(e){if(!e.date)return'';return new Date(e.date+'T12:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+(e.time?' • '+e.time:'')}",
      "function time12(t){if(!t)return'';const [h,m]=t.split(':').map(Number);return new Date(2000,0,1,h,m||0).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}function fmt(e){if(!e.date)return'';return new Date(e.date+'T12:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+(e.time?' • '+time12(e.time):'')}"
    );
    html = html.replace(
      "new Date(r.updatedAt).toLocaleTimeString()",
      "new Date(r.updatedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})"
    );

    // Add player resources to captain view too.
    html = html.replace(
      '<button data-tab="access">Access</button>',
      '<button data-tab="resources">Resources</button><button data-tab="access">Access</button>'
    );
    html = html.replace(
      '<section id="access" class="stack hidden">',
      '<section id="resources" class="stack hidden"><div class="card"><strong>Stonewall Boston Resources</strong><div class="muted">Quick links for players and captains.</div></div><div class="grid g2"><a class="card" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="https://sites.google.com/stonewallsports.org/bos/resources/injured-player-form?authuser=0"><strong>Injured Player Form</strong><div class="muted">Report a player injury through Stonewall Boston.</div></a><a class="card" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="https://sites.google.com/stonewallsports.org/bos/resources/fee-discount-program?authuser=0"><strong>Fee Discount Program</strong><div class="muted">Stonewall Boston fee assistance information.</div></a><a class="card" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="https://docs.google.com/document/u/1/d/e/2PACX-1vQ9OBOHo_OxrX3U46sTHYxStc21qJearXIKuRpZ-FuEWlCXSyCg3nqs5co3zdjUKeVQ_7oELo7-nuKH/pub?pli=1"><strong>Kickball League Document</strong><div class="muted">Published kickball reference document.</div></a><a class="card" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="https://sites.google.com/stonewallsports.org/bos/sports/kickball?authuser=0"><strong>Stonewall Boston Kickball</strong><div class="muted">Official Boston kickball page and league information.</div></a></div></section><section id="access" class="stack hidden">'
    );
    html = html.replace(
      "['dashboard','schedule','roster','lineup','kicking','officials','access']",
      "['dashboard','schedule','roster','lineup','pods','kicking','officials','resources','access']"
    );

    // Add a schedule summary above the editable events list.
    html = html.replace(
      '<div class="card row"><strong>Team events</strong><button id="addEvent">Add event</button></div>',
      '<div class="card"><strong>Season Schedule</strong><div class="muted">Grouped by game day so games and officiating duties are easier to scan.</div><div id="captainScheduleSummary" class="schedule-summary"></div></div><div class="card row"><strong>Team events</strong><button id="addEvent">Add event</button></div>'
    );

    // Replace the flat event wall with grouped game-day sections while retaining officiating assignment controls.
    const organizedSchedule = `function capDayLabel(date){if(!date)return'Date TBD';return new Date(date+'T12:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}function capEventSort(a,b){return((a.date||'9999-12-31')+(a.time||'')).localeCompare((b.date||'9999-12-31')+(b.time||''))}function capTypeInfo(e){if(e.type==='Game')return{label:'GAME',cls:'schedule-game'};if(e.type==='Officiating')return{label:'OFFICIATING',cls:'schedule-off'};if(e.type==='Tournament')return{label:'PLAYOFFS',cls:'schedule-tour'};if(e.type==='League Event')return{label:'LEAGUE EVENT',cls:'schedule-league'};return{label:(e.type||'EVENT').toUpperCase(),cls:'schedule-other'}}function capAppendSection(box,label,items,isPast){if(!items.length)return;const title=document.createElement('div');title.className='schedule-section-title';title.textContent=label;box.appendChild(title);const groups=new Map();items.forEach(e=>{const k=e.date||'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e)});groups.forEach((list,date)=>{const group=document.createElement('div');group.className='day-group'+(isPast?' past':'');group.innerHTML='<div class="day-head"><div class="day-date">'+esc(capDayLabel(date))+'</div><div class="day-count">'+list.length+' '+(list.length===1?'item':'items')+'</div></div>';list.forEach(e=>{const ti=capTypeInfo(e),row=document.createElement('div');row.className='schedule-event-row';const has=e.type==='Officiating';row.innerHTML='<div class="schedule-time">'+(e.time?esc(time12(e.time)):'TBD')+'</div><div><div class="schedule-top"><div class="schedule-title">'+esc(e.title||e.type||'Event')+'</div><span class="schedule-chip '+ti.cls+'">'+esc(ti.label)+'</span></div>'+(e.location?'<div class="schedule-meta">📍 '+esc(e.location)+'</div>':'')+(has?'<div class="schedule-assign"><div class="grid g3"><label>Umpire<select class="u">'+options(e.umpire)+'</select></label><label>Line Ref 1<select class="l1">'+options(e.lineRef1)+'</select></label><label>Line Ref 2<select class="l2">'+options(e.lineRef2)+'</select></label></div></div>':'')+'</div>';if(has){[['.u','umpire'],['.l1','lineRef1'],['.l2','lineRef2']].forEach(([s,k])=>row.querySelector(s).onchange=x=>{e[k]=x.target.value;queueSave();renderTracker()})}group.appendChild(row)});box.appendChild(group)})}renderEvents=function(){const box=$('events'),all=[...state.events].sort(capEventSort),t=today(),up=all.filter(e=>!e.date||e.date>=t),past=all.filter(e=>e.date&&e.date<t),games=up.filter(e=>e.type==='Game').length,off=up.filter(e=>e.type==='Officiating').length,days=new Set(up.filter(e=>e.date).map(e=>e.date)).size;const summary=$('captainScheduleSummary');if(summary)summary.innerHTML='<div class="schedule-stat"><strong>'+days+'</strong><span class="muted">Upcoming days</span></div><div class="schedule-stat"><strong>'+games+'</strong><span class="muted">Games</span></div><div class="schedule-stat"><strong>'+off+'</strong><span class="muted">Officiating</span></div>';box.innerHTML='';capAppendSection(box,'Upcoming',up,false);capAppendSection(box,'Past',past,true);if(!all.length)box.innerHTML='<div class="card muted">No events posted yet.</div>'};`;
    html = html.replace('boot();\n</script>', organizedSchedule + 'boot();\n</script>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Captain page failed to load');
  }
};