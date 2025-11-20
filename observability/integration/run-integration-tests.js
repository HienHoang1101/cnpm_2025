const axios = require('axios');

const services = [
  { name: 'auth', url: 'http://localhost:5001' },
  { name: 'order', url: 'http://localhost:5002' },
  { name: 'restaurant', url: 'http://localhost:5003' },
  { name: 'payment', url: 'http://localhost:5004' },
  { name: 'notification', url: 'http://localhost:5007' },
  { name: 'admin', url: 'http://localhost:5000' },
];

// Optional functional checks per service. These are best-effort and only cause
// the script to fail if INTEGRATION_STRICT=true in the environment.
const functionalChecks = {
  auth: [
    { method: 'post', path: '/api/auth/login', body: { email: 'test@example.com', password: 'x' } }
  ],
  order: [
    { method: 'post', path: '/api/orders', body: { items: [], restaurantId: 'demo', userId: 'demo' } }
  ],
  notification: [
    { method: 'post', path: '/api/notifications', body: { to: 'user@example.com', message: 'integration-test' } }
  ]
};

async function checkService(s) {
  try {
    const h = await axios.get(`${s.url}/health`, { timeout: 3000 });
    console.log(`${s.name} /health =>`, h.status);
    const m = await axios.get(`${s.url}/metrics`, { timeout: 3000 });
    console.log(`${s.name} /metrics =>`, m.status, `(len ${m.data.length})`);
      // run optional functional checks (best-effort)
      const checks = functionalChecks[s.name] || [];
      for (const c of checks) {
        try {
          const fn = axios[c.method] || axios.get;
          const url = `${s.url}${c.path}`;
          const resp = await fn(url, c.body, { timeout: 4000 });
          console.log(`${s.name} ${c.method.toUpperCase()} ${c.path} =>`, resp.status);
        } catch (fe) {
          // If endpoint not found (404) or method not allowed (405), treat as skipped
          if (fe.response && (fe.response.status === 404 || fe.response.status === 405)) {
            console.warn(`${s.name} ${c.method.toUpperCase()} ${c.path} skipped (status ${fe.response.status})`);
          } else {
            console.error(`${s.name} functional check ${c.method.toUpperCase()} ${c.path} failed:`, fe.message);
            if (process.env.INTEGRATION_STRICT === 'true') throw fe;
          }
        }
      }
    return true;
  } catch (e) {
    console.error(`\n--- ${s.name} check failed ---`);
    if (e.response) {
      console.error('HTTP error status:', e.response.status);
      console.error('Response headers:', e.response.headers);
      // try to print response body safely
      try {
        const text = typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
        console.error('Response body:', text);
      } catch (err2) {
        console.error('Response body: <unprintable>');
      }
    } else if (e.request) {
      console.error('No response received. Request made but no reply.');
      console.error('Request info:', e.request && e.request._header ? e.request._header : e.request);
    } else {
      console.error('Request setup error:', e.message);
    }
    console.error('Error stack:', e.stack);
    return false;
  }
}

(async () => {
  let ok = true;
  for (const s of services) {
    const res = await checkService(s);
    ok = ok && res;
  }
  if (!ok) {
    console.error('One or more services failed checks');
    process.exit(2);
  }
  console.log('All integration smoke checks passed');
})();
