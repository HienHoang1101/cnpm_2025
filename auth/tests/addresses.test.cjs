const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../index');
const User = require('../model/User');

describe('User addresses flow', () => {
  const OLD_SECRET = process.env.JWT_SECRET;
  let token;
  let originalFindById;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    token = jwt.sign({ id: 'user1' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  beforeEach(() => {
    // save and replace DB lookup
    originalFindById = User.findById;
    const userObj = {
      _id: 'user1',
      name: 'Test User',
      email: 't@example.com',
      addresses: [],
      save: async function () { return this; },
    };

    User.findById = async (id) => {
      // return a fresh clone to avoid cross-test mutation
      return JSON.parse(JSON.stringify(userObj));
    };
  });

  afterEach(() => {
    User.findById = originalFindById;
  });

  afterAll(() => {
    process.env.JWT_SECRET = OLD_SECRET;
  });

  test('GET /api/users/me/addresses returns addresses array', async () => {
    const res = await request(app)
      .get('/api/users/me/addresses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.addresses)).toBe(true);
  });

  test('POST /api/users/me/addresses adds first address as default', async () => {
    const body = { label: 'Home', street: '123 St', city: 'City', state: 'S', coordinates: [0, 0], isDefault: true };

    const res = await request(app)
      .post('/api/users/me/addresses')
      .send(body)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(Array.isArray(res.body.addresses)).toBe(true);
    expect(res.body.addresses.length).toBeGreaterThanOrEqual(1);
    expect(res.body.addresses[0].isDefault).toBeTruthy();
  });

  test('Adding second address with isDefault true moves default flag', async () => {
    // first add
    await request(app)
      .post('/api/users/me/addresses')
      .send({ label: 'A1', street: 'S1', city: 'C1', state: 'ST', coordinates: [1, 1], isDefault: true })
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    // second add should set the second as default
    const res2 = await request(app)
      .post('/api/users/me/addresses')
      .send({ label: 'A2', street: 'S2', city: 'C2', state: 'ST2', coordinates: [2, 2], isDefault: true })
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res2.body.addresses.some(a => a.isDefault)).toBeTruthy();
    const defaults = res2.body.addresses.filter(a => a.isDefault);
    expect(defaults.length).toBe(1);
  });

});
