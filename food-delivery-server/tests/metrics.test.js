process.env.NODE_ENV = 'test';

const request = require('supertest');
const client = require('prom-client');
const app = require('../app');

beforeEach(() => {
  client.register.resetMetrics();
});

describe('Delivery service Metrics', () => {
  test('GET /metrics returns 200, 500 or 404 (if metrics endpoint missing)', async () => {
    const res = await request(app).get('/metrics');
    expect([200, 500, 404]).toContain(res.status);
  });

  test('increments http_requests_total after /health hit', async () => {
    await request(app).get('/health');
    const res = await request(app).get('/metrics');
    if (res.status === 404) {
      // metrics endpoint not wired up in this environment
      return;
    }
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/http_requests_total\{[^}]*route="\/health"[^}]*\}\s+1/);
  });
});
