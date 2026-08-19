const { neon } = require('@neondatabase/serverless');

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const err = new Error('DATABASE_URL is not configured in Vercel');
    err.code = 'DATABASE_NOT_CONFIGURED';
    throw err;
  }
  return neon(url);
}

module.exports = { getSql };
