// Per-service health & metrics validation with basic assertions
// Fast, dependency-light: uses axios only.
const axios = require('axios');

const services = [
  { name: 'auth', portEnv: 'A_PORT', defaultPort: 5001 },
  { name: 'order', portEnv: 'PORT', defaultPort: 5002 },
  { name: 'delivery', portEnv: 'PORT_Delivery', defaultPort: 5004 },
  { name: 'payment', portEnv: 'PORT_Payment', defaultPort: 5005 },
  { name: 'admin', portEnv: 'PORT_Admin', defaultPort: 5008 }
];

// Metrics which should generally exist if prom-client default metrics are enabled
const expectedMetricFragments = [
  'process_cpu_seconds_total',
  'process_resident_memory_bytes',
  'nodejs_active_handles_total',
  'nodejs_eventloop_lag_seconds'
];

function buildUrl(port) {
  return `http://localhost:${port}`;
}

async function checkService(svc) {
  const port = process.env[svc.portEnv] || svc.defaultPort;
  const base = buildUrl(port);
  const healthUrl = `${base}/health`;
  const metricsUrl = `${base}/metrics`;
  const result = { name: svc.name, port, health: false, metrics: false, missingMetrics: [] };
  try {
    const h = await axios.get(healthUrl, { timeout: 3000 }).catch(() => null);
    if (h && h.status === 200) result.health = true;
  } catch (e) {
    result.healthError = e.message;
  }
  try {
    const m = await axios.get(metricsUrl, { timeout: 4000 }).catch(() => null);
    if (m && m.status === 200) {
      result.metrics = true;
      const text = typeof m.data === 'string' ? m.data : JSON.stringify(m.data);
      for (const frag of expectedMetricFragments) {
        if (!text.includes(frag)) result.missingMetrics.push(frag);
      }
    }
  } catch (e) {
    result.metricsError = e.message;
  }
  return result;
}

(async () => {
  const outputs = [];
  for (const svc of services) {
    const r = await checkService(svc);
    outputs.push(r);
    console.log(`[${svc.name}] port=${r.port} health=${r.health} metrics=${r.metrics} missingMetrics=${r.missingMetrics.join(',')}`);
  }
  const failed = outputs.filter(o => !o.health || !o.metrics || o.missingMetrics.length > 0);
  if (failed.length) {
    console.error(`Service metrics suite failed for ${failed.map(f=>f.name).join(', ')}`);
    process.exit(2);
  }
  console.log('All services expose /health and /metrics with expected base metrics');
})();
