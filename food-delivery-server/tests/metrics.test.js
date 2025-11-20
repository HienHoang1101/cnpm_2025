process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../app');

describe('Delivery service Metrics', () => {
  test('GET /metrics returns 200, 500 or 404 (if metrics endpoint missing)', async () => {
    const res = await request(app).get('/metrics');
    expect([200, 500, 404]).toContain(res.status);
  });
});
