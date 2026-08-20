const webpush = require('web-push');

async function ensurePushConfig(sql) {
  const rows = await sql`SELECT state FROM team_state WHERE id = 1 LIMIT 1`;
  const state = (rows[0] && rows[0].state) || {};
  let config = state._pushConfig;
  if (config && config.publicKey && config.privateKey) return config;

  const keys = webpush.generateVAPIDKeys();
  const candidate = {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    createdAt: new Date().toISOString()
  };
  const payload = JSON.stringify(candidate);
  const updated = await sql`
    UPDATE team_state
    SET state = jsonb_set(state, '{_pushConfig}', ${payload}::jsonb, true), updated_at = now()
    WHERE id = 1 AND (state->'_pushConfig' IS NULL OR state->'_pushConfig' = '{}'::jsonb)
    RETURNING state->'_pushConfig' AS config
  `;
  if (updated[0] && updated[0].config) return updated[0].config;

  const current = await sql`SELECT state->'_pushConfig' AS config FROM team_state WHERE id = 1 LIMIT 1`;
  config = current[0] && current[0].config;
  if (!config || !config.publicKey || !config.privateKey) throw new Error('Push notification keys could not be initialized');
  return config;
}

function configurePush(config) {
  webpush.setVapidDetails('mailto:notifications@those-dirty-bunt-cakes.app', config.publicKey, config.privateKey);
}

async function sendPush(config, subscription, payload) {
  configurePush(config);
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 60 * 60 * 24 * 3,
    urgency: 'normal'
  });
}

module.exports = { ensurePushConfig, sendPush };
