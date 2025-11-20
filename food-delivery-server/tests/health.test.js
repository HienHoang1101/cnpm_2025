process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../app');

describe('Delivery service Health', () => {
  test('GET /health returns status object', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
  });
});
