import jwt from 'jsonwebtoken';
import { protect, authorize } from '../middleware/auth.js';
import User from '../model/User.js';

describe('Auth Middleware', () => {
  const SECRET = 'test-jwt-secret-mw';

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    // default stub
    User.findById = async () => null;
  });

  const makeRes = () => {
    const res = {};
    res._status = null;
    res._json = null;
    res.status = (code) => { res._status = code; return res; };
    res.json = (obj) => { res._json = obj; return res; };
    return res;
  };

  const makeNext = () => {
    const n = { called: false };
    n.fn = () => { n.called = true; };
    return n;
  };

  test('protect - missing token returns 401', async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = makeNext();

    await protect(req, res, next.fn);

    expect(res._status).toBe(401);
    expect(res._json).toBeDefined();
    expect(next.called).toBe(false);
  });

  test('protect - invalid token returns 401', async () => {
    const req = { headers: { authorization: 'Bearer invalid.token' } };
    const res = makeRes();
    const next = makeNext();

    await protect(req, res, next.fn);

    expect(res._status).toBe(401);
    expect(next.called).toBe(false);
  });

  test('protect - user not found returns 401', async () => {
    const token = jwt.sign({ id: 'no-user' }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = makeNext();

    User.findById = async () => null;

    await protect(req, res, next.fn);

    expect(res._status).toBe(401);
    expect(next.called).toBe(false);
  });

  test('protect - inactive user returns 403', async () => {
    const user = { _id: 'u-inactive', status: 'suspended', role: 'customer' };
    const token = jwt.sign({ id: user._id }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = makeNext();

    User.findById = async (id) => (id === user._id ? user : null);

    await protect(req, res, next.fn);

    expect(res._status).toBe(403);
    expect(res._json).toEqual(expect.objectContaining({ success: false }));
    expect(next.called).toBe(false);
  });

  test('protect - valid token sets req.user and calls next', async () => {
    const user = { _id: 'u-active', status: 'active', role: 'admin' };
    const token = jwt.sign({ id: user._id, role: user.role }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = makeNext();

    User.findById = async (id) => (id === user._id ? user : null);

    await protect(req, res, next.fn);

    expect(next.called).toBe(true);
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('admin');
  });

  test('authorize - denies when role not allowed', () => {
    const req = { user: { role: 'customer' } };
    const res = makeRes();
    const next = makeNext();

    const middleware = authorize('admin');
    middleware(req, res, next.fn);

    expect(res._status).toBe(403);
    expect(next.called).toBe(false);
  });

  test('authorize - allows when role is allowed', () => {
    const req = { user: { role: 'admin' } };
    const res = makeRes();
    const next = makeNext();

    const middleware = authorize('admin');
    middleware(req, res, next.fn);

    expect(next.called).toBe(true);
  });
});
