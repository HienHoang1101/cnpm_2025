import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../model/User.js';

describe('User model utilities', () => {
  const plain = 'P@ssw0rd123';

  test('comparePassword returns true for correct password', async () => {
    const hashed = await bcrypt.hash(plain, 8);
    const user = new User({ email: 't@example.com', name: 'T', phone: '012345', password: 'hidden' });
    // simulate stored hashed password
    user.password = hashed;

    const ok = await user.comparePassword(plain);
    expect(ok).toBe(true);
  });

  test('generateAuthToken contains id and role and is verifiable', () => {
    // ensure deterministic secret for test
    process.env.JWT_SECRET = 'test-jwt-secret';
    const user = new User({ _id: '507f1f77bcf86cd799439011', role: 'customer' });
    const token = user.generateAuthToken();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded).toHaveProperty('id');
    expect(decoded).toHaveProperty('role', 'customer');
  });

  test('generateRefreshToken is verifiable and contains id', () => {
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    const user = new User({ _id: '507f1f77bcf86cd799439011' });
    const token = user.generateRefreshToken();
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    expect(decoded).toHaveProperty('id');
  });
});
