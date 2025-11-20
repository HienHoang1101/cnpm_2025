import request from 'supertest';
import app from '../index.js';
import jwt from 'jsonwebtoken';

// For ESM modules we mutate the imported model's static methods directly
import User from '../model/User.js';

describe('Auth Controller', () => {
  // No global jest.fn usage (works around ESM vm-modules).
  // Each test will assign plain async functions to the User static methods.

  test('POST /api/auth/register - success', async () => {
    const payload = { email: 'new@example.com', password: 'pass123', name: 'New', phone: '0123456789' };

    // No existing user (track the argument to assert later)
    let findOneArg = null;
    User.findOne = async (q) => {
      findOneArg = q;
      return null;
    };

    // Fake created user
    const fakeUser = {
      _id: 'u1',
      email: payload.email,
      name: payload.name,
      phone: payload.phone,
      role: 'customer',
      generateAuthToken: () => 'tok-abc',
      generateRefreshToken: () => 'rftok-xyz',
      save: async () => {},
      toObject: function () {
        return { _id: this._id, email: this.email, name: this.name, phone: this.phone };
      },
    };

    let createdArg = null;
    User.create = async (obj) => {
      createdArg = obj;
      return fakeUser;
    };

    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token', 'tok-abc');
    expect(res.body).toHaveProperty('refreshToken', 'rftok-xyz');
    expect(res.body.user).toMatchObject({ email: payload.email, name: payload.name });
    expect(findOneArg).toEqual({ email: payload.email });
  });

  test('POST /api/auth/login - success', async () => {
    const payload = { email: 'existing@example.com', password: 'secret' };

    const existingUser = {
      _id: 'u2',
      email: payload.email,
      name: 'Exists',
      phone: '0987654321',
      status: 'active',
      // capture compare arg
      comparePassword: async (pwd) => {
        return true;
      },
      generateAuthToken: () => 'tok-login',
      generateRefreshToken: () => 'rftok-login',
      save: async () => {},
      toObject: function () {
        return { _id: this._id, email: this.email, name: this.name, phone: this.phone };
      },
    };
    let compareArg = null;
    existingUser.comparePassword = async (pwd) => {
      compareArg = pwd;
      return true;
    };

    // User.findOne(...).select('+password') must resolve to the user
    User.findOne = (q) => ({ select: () => Promise.resolve(existingUser) });

    const res = await request(app).post('/api/auth/login').send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token', 'tok-login');
    expect(res.body.user).toMatchObject({ email: payload.email });
    expect(compareArg).toBe(payload.password);
  });

  test('POST /api/auth/refresh-token - success', async () => {
    // create a refresh token using the same default secret
    const secret = process.env.JWT_REFRESH_SECRET || 'jwt-refresh-secret-key-develop-only';
    const refreshToken = jwt.sign({ id: 'u-refresh' }, secret);

    const user = {
      _id: 'u-refresh',
      refreshToken,
      generateAuthToken: () => 'new-token',
      generateRefreshToken: () => 'new-refresh',
      save: async () => {},
    };

    User.findOne = async (q) => user;

    const res = await request(app).post('/api/auth/refresh-token').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token', 'new-token');
    expect(res.body).toHaveProperty('refreshToken', 'new-refresh');
  });

  test('POST /api/auth/forgot-password - success', async () => {
    const email = 'forgot@example.com';

    const user = {
      _id: 'u-forgot',
      email,
      save: async function () { return this; }
    };

    User.findOne = async (q) => (q.email === email ? user : null);

    const res = await request(app).post('/api/auth/forgot-password').send({ email });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('resetUrl');
  });

  test('POST /api/auth/reset-password/:token - success', async () => {
    const token = 'reset-token-123';
    const crypto = await import('crypto');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const user = {
      _id: 'u-reset',
      passwordResetToken: hashed,
      passwordResetExpires: Date.now() + 10000,
      save: async function () { return this; }
    };

    User.findOne = async (q) => user;

    const res = await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'newpass' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Password has been reset successfully');
  });
});
