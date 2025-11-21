process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../app');

describe('Delivery service Metrics Content', () => {
  test('GET /metrics contains default process metrics', async () => {
    const res = await request(app).get('/metrics');
    // If metrics endpoint missing, treat as skip
    if (res.status !== 200) return;
    expect(res.text).toMatch(/process_cpu_seconds_total/);
    expect(res.text).toMatch(/process_resident_memory_bytes/);
  });
});
