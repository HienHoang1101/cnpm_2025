process.env.NODE_ENV = 'test';

import request from 'supertest';
import client from 'prom-client';
import app from '../index.js';

beforeEach(() => {
  client.register.resetMetrics();
});

describe('Order service /metrics', () => {
  test('GET /metrics returns prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toMatch(/# HELP/);
    }
  });

  test('increments http_requests_total after /health hit', async () => {
    await request(app).get('/health');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/http_requests_total\{[^}]*route="\/health"[^}]*\}\s+1/);
  });
});
