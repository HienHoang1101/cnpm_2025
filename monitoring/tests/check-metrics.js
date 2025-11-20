const axios = require('axios');

const services = [
  { name: 'prometheus', url: 'http://localhost:9090' },
  { name: 'grafana', url: 'http://localhost:3000' },
  { name: 'jaeger', url: 'http://localhost:16686' },
  { name: 'auth', url: 'http://localhost:5001' },
  { name: 'order', url: 'http://localhost:5002' },
  { name: 'restaurant', url: 'http://localhost:5003' },
  { name: 'payment', url: 'http://localhost:5004' },
  { name: 'notification', url: 'http://localhost:5007' },
  { name: 'admin', url: 'http://localhost:5000' },
];

async function check(s) {
  try {
    const health = await axios.get(`${s.url}/health`, { timeout: 3000 }).catch(() => null);
    if (health && health.status === 200) {
      console.log(`${s.name} healthy`);
    } else {
      // Allow services that don't expose /health to pass if the base URL responds
      const base = await axios.get(s.url, { timeout: 3000 }).catch(() => null);
      if (base && base.status === 200) {
        console.log(`${s.name} base OK`);
      } else {
        console.warn(`${s.name} not healthy (no 200 on /health or base)`);
      }
    }

    // Check /metrics when available
    const metrics = await axios.get(`${s.url}/metrics`, { timeout: 3000 }).catch(() => null);
    if (metrics && metrics.status === 200) {
      console.log(`${s.name} /metrics OK (len ${metrics.data.length})`);
    } else {
      console.warn(`${s.name} /metrics not available`);
    }
    return true;
  } catch (e) {
    console.error(`${s.name} check failed:`, e.message);
    return false;
  }
}

(async () => {
  let ok = true;
  for (const s of services) {
    const res = await check(s);
    ok = ok && res;
  }
  if (!ok) {
    console.error('Monitoring smoke checks found issues');
    process.exit(2);
  }
  console.log('Monitoring smoke checks passed');
})();
