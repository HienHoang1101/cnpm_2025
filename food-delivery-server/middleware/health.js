const axios = require('axios');
const mongoose = require('mongoose');

async function checkHealth() {
  const dbStatus = mongoose && mongoose.connection && mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  // Check dependent services (best-effort)
  let authServiceStatus = 'unreachable';
  try {
    if (global.gConfig && global.gConfig.auth_url) {
      await axios.get(`${global.gConfig.auth_url}/health`, { timeout: 2000 });
      authServiceStatus = 'ok';
    }
  } catch (e) {
    // ignore network errors during test runs
  }

  return {
    success: true,
    status: 'ok',
    service: 'Delivery Service',
    database: dbStatus,
    dependencies: {
      auth_service: authServiceStatus,
      order_service: 'not_checked'
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
}

module.exports = { checkHealth };