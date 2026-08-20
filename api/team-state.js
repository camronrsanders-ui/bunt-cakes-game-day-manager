const webpush = require('web-push');
const { getSql } = require('./_db');
const { requireCaptain } = require('./_auth');

const ATTENDANCE = new Set(['yes', 'no', 'not_sure']);

function publicState(value) {
  const state = value && typeof value === 'object' ? { ...value } : {};
  delete state._pushConfig;
  delete state._pushSubscriptions;
  delete state._pushReminderLog;
  return state;
}

async function ensurePushConfig(sql) {
  const rows = await sql`SELECT state FROM team_state WHERE id = 1 LIMIT 1`;
  const state = (rows[0] && rows[0].state) || {};
  let config = state._pushConfig;
  if (config && config.publicKey && config.privateKey) return config;
  const keys = webpush.generateVAPIDKeys();
  const candidate = { publicKey: keys.publicKey, privateKey: keys.privateKey, createdAt: new Date().toISOString() };
  const payload = JSON.stringify(candidate);
  const updated = await sql`
    UPDATE team_state SET state = jsonb_set(state, '{_pushConfig}', ${payload}::jsonb, true), updated_at = now()
    WHERE id = 1 AND (state->'_pushConfig' IS NULL OR state->'_pushConfig' = '{}'::jsonb)
    RETURNING state->'_pushConfig' AS config
  `;
  if (updated[0] && updated[0].config) return updated[0].config;
  const current = await sql`SELECT state->'_pushConfig' AS config FROM team_state WHERE id = 1 LIMIT 1`;
  config = current[0] && current[0].config;
  if (!config || !config.publicKey || !config.privateKey) throw new Error('Push notification keys could not be initialized');
  return config;
}

function easternParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(date);
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${obj.year}-${obj.month}-${obj.day}`, weekday: obj.weekday };
}
function plusDays(iso, days) { const [y,m,d]=iso.split('-').map(Number); return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10); }
function time12(value) { if(!value)return''; const [h,m]=value.split(':').map(Number); return new Date(2000,0,1,h,m||0).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); }

async function sendAttendanceReminder(sql) {
  const eastern = easternParts();
  if (eastern.weekday !== 'Thu') return { ok: true, skipped: 'Not Thursday in Boston' };
  const gameDate = plusDays(eastern.date, 3);
  const rows = await sql`SELECT state FROM team_state WHERE id = 1 LIMIT 1`;
  const state = (rows[0] && rows[0].state) || {};
  const games = (state.events || []).filter(e => e && e.type === 'Game' && e.date === gameDate).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  if (!games.length) return { ok: true, gameDate, skipped: 'No Sunday game scheduled' };
  if (state._pushReminderLog && state._pushReminderLog[gameDate] && state._pushReminderLog[gameDate].sentAt) return { ok: true, gameDate, skipped: 'Reminder already sent' };

  const subscriptions = state._pushSubscriptions || {};
  const roster = new Set((state.players || []).map(p => p && p.name).filter(Boolean));
  const config = await ensurePushConfig(sql);
  webpush.setVapidDetails('mailto:notifications@those-dirty-bunt-cakes.app', config.publicKey, config.privateKey);
  const times = games.map(g => time12(g.time)).filter(Boolean);
  const body = `Will you be at Sunday’s game${games.length > 1 ? 's' : ''}${times.length ? ` at ${times.join(' & ')}` : ''}? Tap to answer Yes, No, or Not sure.`;
  let sent=0,failed=0;
  const cleaned={...subscriptions};
  for (const [playerName,entries] of Object.entries(subscriptions)) {
    if(!roster.has(playerName))continue;
    const list=Array.isArray(entries)?entries:[],keep=[];
    for(const entry of list){
      if(!entry||!entry.subscription)continue;
      try{
        await webpush.sendNotification(entry.subscription,JSON.stringify({title:'Bunt Cakes • Sunday availability',body,url:`/team?player=${encodeURIComponent(playerName)}&availability=${gameDate}`,tag:`bunt-attendance-${gameDate}`,gameDate}),{TTL:259200,urgency:'normal'});
        keep.push(entry);sent++;
      }catch(error){const code=Number(error&&error.statusCode);if(code!==404&&code!==410)keep.push(entry);failed++;}
    }
    cleaned[playerName]=keep;
  }
  const log={sentAt:new Date().toISOString(),sent,failed,gameCount:games.length};
  const cleanedPayload=JSON.stringify(cleaned),logPayload=JSON.stringify(log);
  await sql`
    UPDATE team_state SET state = jsonb_set(
      jsonb_set(state, '{_pushSubscriptions}', ${cleanedPayload}::jsonb, true),
      '{_pushReminderLog}', COALESCE(state->'_pushReminderLog', '{}'::jsonb) || jsonb_build_object(${gameDate}, ${logPayload}::jsonb), true
    ), updated_at = now() WHERE id = 1
  `;
  return { ok:true,gameDate,sent,failed,games:games.length };
}

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();
    if (req.method === 'GET') {
      if (String(req.headers['user-agent'] || '') === 'vercel-cron/1.0') {
        const result = await sendAttendanceReminder(sql);
        return res.status(200).json(result);
      }
      if (String(req.query && req.query.pushConfig || '') === '1') {
        const config = await ensurePushConfig(sql);
        res.setHeader('Cache-Control','no-store');
        return res.status(200).json({ publicKey: config.publicKey });
      }
      const rows = await sql`SELECT state, updated_at FROM team_state WHERE id = 1 LIMIT 1`;
      const row = rows[0] || { state: {}, updated_at: null };
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ state: publicState(row.state), updatedAt: row.updated_at });
    }

    if (req.method === 'POST') {
      const rows = await sql`SELECT state FROM team_state WHERE id = 1 LIMIT 1`;
      const state = (rows[0] && rows[0].state) || {};
      const playerName = String(req.body && req.body.playerName || '').trim().slice(0, 80);
      const player = (state.players || []).find(p => p && p.name === playerName);
      if (!player) return res.status(404).json({ error: 'Player was not found on the roster' });
      const action = String(req.body && req.body.action || 'access');

      if (action === 'subscribe') {
        const sub=req.body&&req.body.subscription;
        if(!sub||typeof sub.endpoint!=='string'||!sub.endpoint.startsWith('https://')||!sub.keys||!sub.keys.p256dh||!sub.keys.auth)return res.status(400).json({error:'A valid push subscription is required'});
        await ensurePushConfig(sql);
        const existing=state._pushSubscriptions&&state._pushSubscriptions[playerName];
        let list=Array.isArray(existing)?existing:[];
        list=list.filter(x=>x&&x.subscription&&x.subscription.endpoint!==sub.endpoint);
        list.push({subscription:sub,updatedAt:new Date().toISOString()});list=list.slice(-3);
        const payload=JSON.stringify(list);
        await sql`UPDATE team_state SET state=jsonb_set(state,'{_pushSubscriptions}',COALESCE(state->'_pushSubscriptions','{}'::jsonb)||jsonb_build_object(${playerName},${payload}::jsonb),true),updated_at=now() WHERE id=1`;
        return res.status(200).json({ok:true,remindersEnabled:true});
      }

      if (action === 'attendance-response') {
        const gameDate=String(req.body&&req.body.gameDate||''),status=String(req.body&&req.body.status||'');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(gameDate))return res.status(400).json({error:'A valid Sunday game date is required'});
        if(!ATTENDANCE.has(status))return res.status(400).json({error:'Answer Yes, No, or Not sure'});
        const games=(state.events||[]).filter(e=>e&&e.type==='Game'&&e.date===gameDate);if(!games.length)return res.status(400).json({error:'No game is scheduled for that date'});
        const answer={status,respondedAt:new Date().toISOString()},payload=JSON.stringify(answer);
        await sql`UPDATE team_state SET state=jsonb_set(state,'{availability}',COALESCE(state->'availability','{}'::jsonb)||jsonb_build_object(${gameDate},COALESCE(state->'availability'->${gameDate},'{}'::jsonb)||jsonb_build_object(${playerName},${payload}::jsonb)),true),updated_at=now() WHERE id=1`;
        return res.status(200).json({ok:true,gameDate,playerName,status,respondedAt:answer.respondedAt});
      }

      const accessStatus = req.body && req.body.accessStatus === 'installed' ? 'installed' : 'browser';
      const now = new Date().toISOString();
      const current = (state.appAccess && state.appAccess[playerName]) || {};
      const next = { ...current, playerName, browserSeenAt: current.browserSeenAt || now, lastSeenAt: now, ...(accessStatus === 'installed' ? { installedAt: current.installedAt || now } : {}) };
      const payload = JSON.stringify(next);
      await sql`UPDATE team_state SET state=jsonb_set(state,'{appAccess}',COALESCE(state->'appAccess','{}'::jsonb)||jsonb_build_object(${playerName},${payload}::jsonb),true),updated_at=now() WHERE id=1`;
      return res.status(200).json({ ok: true, accessStatus });
    }

    if (req.method === 'PUT') {
      const user = await requireCaptain(req, res); if (!user) return;
      const next = req.body && req.body.state;
      if (!next || typeof next !== 'object' || Array.isArray(next)) return res.status(400).json({ error: 'A valid state object is required' });
      const payload = JSON.stringify(next); if (payload.length > 1000000) return res.status(413).json({ error: 'Team state is too large' });
      const rows = await sql`
        UPDATE team_state SET state=${payload}::jsonb||jsonb_build_object(
          'appAccess',COALESCE(state->'appAccess','{}'::jsonb),
          'availability',COALESCE(state->'availability','{}'::jsonb),
          '_pushConfig',COALESCE(state->'_pushConfig','{}'::jsonb),
          '_pushSubscriptions',COALESCE(state->'_pushSubscriptions','{}'::jsonb),
          '_pushReminderLog',COALESCE(state->'_pushReminderLog','{}'::jsonb)
        ),updated_at=now() WHERE id=1 RETURNING updated_at
      `;
      return res.status(200).json({ ok: true, updatedAt: rows[0] && rows[0].updated_at, updatedBy: user.display_name });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const status = error.code === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message || 'Shared state request failed' });
  }
};
