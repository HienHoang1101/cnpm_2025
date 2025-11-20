const axios = require('axios');

const services = [
  { name: 'auth', url: 'http://localhost:5001' },
  { name: 'order', url: 'http://localhost:5002' },
  { name: 'restaurant', url: 'http://localhost:5003' },
  { name: 'payment', url: 'http://localhost:5004' },
  { name: 'notification', url: 'http://localhost:5007' },
  { name: 'admin', url: 'http://localhost:5000' },
];

const PROM_URL = process.env.PROM_URL || 'http://localhost:9090';

async function pingServices() {
  for (const s of services) {
    try {
      // Prefer /health if available
      const h = await axios.get(`${s.url}/health`, { timeout: 3000 }).catch(() => null);
      if (h && h.status === 200) {
        console.log(`${s.name} /health OK`);
        continue;
      }

      // Fallback to a base GET
      const b = await axios.get(s.url, { timeout: 3000 }).catch(() => null);
      if (b && b.status === 200) console.log(`${s.name} base OK`);
      else console.warn(`${s.name} did not respond to /health or base`);
    } catch (e) {
      console.warn(`${s.name} ping error:`, e.message);
    }
  }
}

async function queryPrometheus(metricName) {
  const q = encodeURIComponent(metricName);
  const url = `${PROM_URL}/api/v1/query?query=${q}`;
  const res = await axios.get(url, { timeout: 5000 });
  return res.data;
}

async function queryPrometheusWithRetry(metricName, attempts = 6, delayMs = 5000) {
  let lastErr = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      console.log(`Prometheus query attempt ${i}/${attempts} -> ${PROM_URL}`);
      const data = await queryPrometheus(metricName);
      if (data && data.status === 'success') return data;
      lastErr = new Error(`non-success status: ${data && data.status}`);
      console.warn('Prometheus returned non-success:', JSON.stringify(data).slice(0, 200));
    } catch (err) {
      lastErr = err;
      if (err.response) {
        console.warn(`Prometheus HTTP ${err.response.status} - body: ${JSON.stringify(err.response.data).slice(0,200)}`);
      } else {
        console.warn('Prometheus request error:', err.message);
      }
    }

    if (i < attempts) {
      console.log(`Waiting ${delayMs}ms before next Prometheus attempt`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr || new Error('Prometheus query failed after retries');
}

(async () => {
  try {
    // 1) Trigger traffic so services expose metrics
    console.log('Pinging services to generate metrics...');
    await pingServices();

    // Wait for metrics to be scraped
    console.log('Waiting 8s for services to expose metrics and Prometheus to scrape...');
    await new Promise((r) => setTimeout(r, 8000));

    // 2) Query Prometheus for the histogram counter created by prom-client (with retries)
    const metric = 'http_request_duration_seconds_count';
    console.log(`Querying Prometheus for metric '${metric}' (with retries)`);
    const data = await queryPrometheusWithRetry(metric, 6, 5000);

    const results = data.data && data.data.result ? data.data.result : [];
    if (results.length === 0) {
      console.error(`Metric '${metric}' not found in Prometheus. Scrape may have failed.`);
      process.exit(2);
    }

    console.log(`Metric '${metric}' present with ${results.length} time series. Sample:`);
    console.log(JSON.stringify(results.slice(0, 2), null, 2));
    console.log('Prometheus metrics check passed');
    process.exit(0);
  } catch (err) {
    console.error('Prometheus metrics check failed:', err.message || err);
    process.exit(2);
  }
})();
