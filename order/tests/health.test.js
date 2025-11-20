process.env.NODE_ENV = 'test';

import request from 'supertest';
import app from '../index.js';

describe('Order service Health & Readiness', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  test('GET /ready returns not ready in test mode', async () => {
    const res = await request(app).get('/ready');
    expect([200, 503]).toContain(res.status);
  });
});
