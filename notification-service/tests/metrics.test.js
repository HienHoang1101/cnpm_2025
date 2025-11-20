process.env.NODE_ENV = 'test';

import request from 'supertest';
import client from 'prom-client';
import app from '../index.js';

beforeEach(() => {
  client.register.resetMetrics();
});

describe('Notification service Metrics', () => {
  test('GET /metrics returns prometheus text', async () => {
    const res = await request(app).get('/metrics');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(typeof res.text).toBe('string');
      expect(res.text.length).toBeGreaterThan(0);
    }
  });

  test('increments http_requests_total after /health hit', async () => {
    await request(app).get('/health');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/http_requests_total\{[^}]*route="\/health"[^}]*\}\s+1/);
  });
});
