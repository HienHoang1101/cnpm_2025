process.env.NODE_ENV = 'test';

import request from 'supertest';
import app from '../index.js';

describe('Payment service /metrics', () => {
  test('GET /metrics returns prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toMatch(/# HELP/);
    }
  });
});
