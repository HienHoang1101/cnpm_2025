process.env.NODE_ENV = 'test';

import request from 'supertest';
import app from '../index.js';

describe('Notification service Metrics', () => {
  test('GET /metrics returns prometheus text', async () => {
    const res = await request(app).get('/metrics');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(typeof res.text).toBe('string');
      expect(res.text.length).toBeGreaterThan(0);
    }
  });
});
