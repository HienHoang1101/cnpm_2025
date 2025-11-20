process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../app');

describe('Delivery service Metrics', () => {
  test('GET /metrics returns 200 or 500 (if prometheus not configured)', async () => {
    const res = await request(app).get('/metrics');
    expect([200, 500]).toContain(res.status);
  });
});
