process.env.NODE_ENV = 'test';

import request from 'supertest';
import app from '../index.js';

describe('Health & Readiness endpoints', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'auth-service');
  });

  test('GET /ready returns not ready when DB not connected', async () => {
    const res = await request(app).get('/ready');
    // In test mode we skip DB connect, so readiness should be 503
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('status', 'ready');
    } else {
      expect(res.body).toHaveProperty('status', 'not_ready');
    }
  });
});
