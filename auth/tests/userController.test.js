import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index.js';
import User from '../model/User.js';

describe('User Controller', () => {
  const SECRET = 'test-jwt-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;

    // default safe stubs
    User.find = (q) => ({ select: () => Promise.resolve([]) });
    User.findById = async () => null;
    User.findByIdAndUpdate = async () => null;
  });

  const authHeaderFor = (user) => {
    const token = jwt.sign({ id: user._id, role: user.role }, SECRET);
    return `Bearer ${token}`;
  };

  test('GET /api/users - returns users list', async () => {
    const users = [
      { _id: 'u1', email: 'a@example.com', name: 'A' },
      { _id: 'u2', email: 'b@example.com', name: 'B' },
    ];

    // make requester an admin
    const admin = { _id: 'admin1', role: 'admin', status: 'active' };
    User.findById = async (id) => (id === admin._id ? admin : null);

    // mock the list query (return object with select())
    User.find = (q) => ({ select: () => Promise.resolve(users) });

    const res = await request(app).get('/api/users').set('Authorization', authHeaderFor(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.count).toBe(2);
    expect(res.body.users).toHaveLength(2);
  });

  test('GET /api/users/pending-approval - returns pending users', async () => {
    const pending = [{ _id: 'p1', status: 'pending_approval' }];
    const admin = { _id: 'admin2', role: 'admin', status: 'active' };
    User.findById = async (id) => (id === admin._id ? admin : null);
    User.find = (q) => ({ select: () => Promise.resolve(pending) });

    const res = await request(app).get('/api/users/pending-approval').set('Authorization', authHeaderFor(admin));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });

  test('GET /api/users/drivers - returns drivers', async () => {
    const drivers = [{ _id: 'd1', role: 'delivery' }];
    const admin = { _id: 'admin3', role: 'admin', status: 'active' };
    User.findById = async (id) => (id === admin._id ? admin : null);
    User.find = (q) => ({ select: () => Promise.resolve(drivers) });

    const res = await request(app).get('/api/users/drivers').set('Authorization', authHeaderFor(admin));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.drivers[0].role).toBe('delivery');
  });

  test('PUT /api/users/:id/approve - approves pending user', async () => {
    const admin = { _id: 'admin-approve', role: 'admin', status: 'active' };
    const user = { _id: 'u-approve', status: 'pending_approval', save: async () => {} };
    User.findById = async (id) => (id === 'u-approve' ? user : id === admin._id ? admin : null);

    const res = await request(app).put('/api/users/u-approve/approve').set('Authorization', authHeaderFor(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'User approved successfully');
    expect(user.status).toBe('active');
  });

  test('DELETE /api/users/:id - deletes user', async () => {
    const admin = { _id: 'admin-del', role: 'admin', status: 'active' };
    const user = { _id: 'u-del', deleteOne: async () => {} };
    User.findById = async (id) => (id === 'u-del' ? user : id === admin._id ? admin : null);

    const res = await request(app).delete('/api/users/u-del').set('Authorization', authHeaderFor(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'User deleted successfully');
  });

  test('PUT /api/users/:id/status - updates status', async () => {
    const admin = { _id: 'admin-stat', role: 'admin', status: 'active' };
    const user = { _id: 'u-stat', name: 'S', email: 's@example', role: 'customer', status: 'inactive', save: async () => {} };
    User.findById = async (id) => (id === 'u-stat' ? user : id === admin._id ? admin : null);

    const res = await request(app).put('/api/users/u-stat/status').set('Authorization', authHeaderFor(admin)).send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('active');
  });
});
