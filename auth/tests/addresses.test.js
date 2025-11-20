import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../index.js';
import User from '../model/User.js';

describe('User addresses flow (ESM)', () => {
	const OLD_SECRET = process.env.JWT_SECRET;
	let token;
	let originalFindById;

	beforeAll(() => {
		process.env.JWT_SECRET = 'test-secret';
		token = jwt.sign({ id: 'user1' }, process.env.JWT_SECRET, { expiresIn: '1h' });
	});

	beforeEach(() => {
		originalFindById = User.findById;
		const userObj = {
			_id: 'user1',
			name: 'Test User',
			email: 't@example.com',
			addresses: [],
			status: 'active',
			role: 'customer',
			save: async function () { return this; },
		};

		// Keep a single in-memory user instance so modifications persist across calls
		let idCounter = 1;
		let currentUser = { ...userObj };
		// Override save so subdocuments get an _id when saved, to emulate mongoose behavior
		currentUser.save = async function () {
			this.addresses = this.addresses.map((addr) => {
				if (!addr._id) {
					addr._id = `addr-${Date.now()}-${idCounter++}`;
				}
				return addr;
			});
			return this;
		};
		User.findById = async (id) => currentUser;
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

		// Controller returns the created address in `address`, not full addresses array
		expect(res.body.address).toBeDefined();
		expect(res.body.address.isDefault).toBeTruthy();

		// Fetch addresses list to ensure it's persisted on the mocked user
		const list = await request(app)
			.get('/api/users/me/addresses')
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		expect(Array.isArray(list.body.addresses)).toBe(true);
		expect(list.body.addresses.length).toBeGreaterThanOrEqual(1);
		expect(list.body.addresses[0].isDefault).toBeTruthy();
	});

	test('Adding second address with isDefault true moves default flag', async () => {
		await request(app)
			.post('/api/users/me/addresses')
			.send({ label: 'A1', street: 'S1', city: 'C1', state: 'ST', coordinates: [1, 1], isDefault: true })
			.set('Authorization', `Bearer ${token}`)
			.expect(201);

		await request(app)
			.post('/api/users/me/addresses')
			.send({ label: 'A2', street: 'S2', city: 'C2', state: 'ST2', coordinates: [2, 2], isDefault: true })
			.set('Authorization', `Bearer ${token}`)
			.expect(201);

		// Fetch addresses to inspect default flags
		const resList = await request(app)
			.get('/api/users/me/addresses')
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		expect(resList.body.addresses.some(a => a.isDefault)).toBeTruthy();
		const defaults = resList.body.addresses.filter(a => a.isDefault);
		expect(defaults.length).toBe(1);
	});

	test('PUT /api/users/me/addresses/:addressId updates address and default flag', async () => {
		// ensure we have at least one address
		const addRes = await request(app)
			.post('/api/users/me/addresses')
			.send({ label: 'U1', street: 'SU', city: 'CU', state: 'STU', coordinates: [9, 9], isDefault: false })
			.set('Authorization', `Bearer ${token}`)
			.expect(201);

		// get addresses to find id
		const list = await request(app)
			.get('/api/users/me/addresses')
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		expect(list.body.addresses.length).toBeGreaterThanOrEqual(1);
		const addrId = list.body.addresses[0]._id;

		const upd = { label: 'Updated Label', isDefault: true };
		const res = await request(app)
			.put(`/api/users/me/addresses/${addrId}`)
			.send(upd)
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		expect(res.body.address).toBeDefined();
		expect(res.body.address.label).toBe('Updated Label');
		expect(res.body.address.isDefault).toBeTruthy();
	});

	test('PUT /api/users/me/addresses/:addressId/default sets only one default', async () => {
		// add two addresses
		await request(app)
			.post('/api/users/me/addresses')
			.send({ label: 'D1', street: 'S1', city: 'C1', state: 'ST1', coordinates: [1, 1], isDefault: false })
			.set('Authorization', `Bearer ${token}`)
			.expect(201);
		await request(app)
			.post('/api/users/me/addresses')
			.send({ label: 'D2', street: 'S2', city: 'C2', state: 'ST2', coordinates: [2, 2], isDefault: false })
			.set('Authorization', `Bearer ${token}`)
			.expect(201);

		const list = await request(app)
			.get('/api/users/me/addresses')
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		expect(list.body.addresses.length).toBeGreaterThanOrEqual(2);
		const targetId = list.body.addresses[1]._id;

		const res = await request(app)
			.put(`/api/users/me/addresses/${targetId}/default`)
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		expect(res.body.address).toBeDefined();
		expect(res.body.address.isDefault).toBeTruthy();

		const after = await request(app)
			.get('/api/users/me/addresses')
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		const defaults = after.body.addresses.filter(a => a.isDefault);
		expect(defaults.length).toBe(1);
	});

	test('DELETE /api/users/me/addresses/:addressId removes address and reassigns default', async () => {
		// ensure at least one default and another address
		await request(app)
			.post('/api/users/me/addresses')
			.send({ label: 'R1', street: 'RS1', city: 'RC1', state: 'RST1', coordinates: [3, 3], isDefault: true })
			.set('Authorization', `Bearer ${token}`)
			.expect(201);
		await request(app)
			.post('/api/users/me/addresses')
			.send({ label: 'R2', street: 'RS2', city: 'RC2', state: 'RST2', coordinates: [4, 4], isDefault: false })
			.set('Authorization', `Bearer ${token}`)
			.expect(201);

		const list = await request(app)
			.get('/api/users/me/addresses')
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		const defaultAddr = list.body.addresses.find(a => a.isDefault);
		expect(defaultAddr).toBeDefined();

		const res = await request(app)
			.delete(`/api/users/me/addresses/${defaultAddr._id}`)
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		expect(res.body.success).toBe(true);

		const after = await request(app)
			.get('/api/users/me/addresses')
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		// If there are remaining addresses, one should be default
		if (after.body.addresses.length > 0) {
			const defs = after.body.addresses.filter(a => a.isDefault);
			expect(defs.length).toBe(1);
		}
	});

});
