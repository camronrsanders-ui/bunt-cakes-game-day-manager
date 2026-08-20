const { getSql } = require('./_db');
const { ensurePushConfig } = require('./_push');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const sql = getSql();
    const config = await ensurePushConfig(sql);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ publicKey: config.publicKey });
  } catch (error) {
    const status = error.code === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message || 'Push configuration failed' });
  }
};
