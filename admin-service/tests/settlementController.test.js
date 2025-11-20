process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
let addOrderToSettlement, getAllSettlements, processWeeklySettlements;

// Mock the Settlement model and utils
const mockFindOneAndUpdate = jest.fn();
const mockFind = jest.fn();
const mockFindByIdAndUpdate = jest.fn();

jest.unstable_mockModule('../model/restaurantSettlement.js', () => ({
  default: {
    findOneAndUpdate: mockFindOneAndUpdate,
    find: mockFind,
    findByIdAndUpdate: mockFindByIdAndUpdate,
  },
}));

const mockBankTransfer = jest.fn();
jest.unstable_mockModule('../utils/bankTransfer.js', () => ({
  bankTransfer: mockBankTransfer,
}));

const mockCreateNotification = jest.fn();
jest.unstable_mockModule('../utils/notificationHelper.js', () => ({
  createNotification: mockCreateNotification,
}));

// Import controller after mocks are registered
beforeAll(async () => {
  const module = await import('../controllers/settlementController.js');
  addOrderToSettlement = module.addOrderToSettlement;
  getAllSettlements = module.getAllSettlements;
  processWeeklySettlements = module.processWeeklySettlements;
});

// Helper to create mock req/res
function makeReq(body = {}) {
  return { body };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('settlementController', () => {
  beforeEach(() => {
    mockFindOneAndUpdate.mockReset();
    mockFind.mockReset();
    mockFindByIdAndUpdate.mockReset();
    mockBankTransfer.mockReset();
    mockCreateNotification.mockReset();
  });

  test('addOrderToSettlement - success', async () => {
    const fakeSettlement = { _id: 's1', restaurantId: 'r1' };
    mockFindOneAndUpdate.mockResolvedValue(fakeSettlement);

    const req = makeReq({
      restaurantId: 'r1',
      restaurantName: 'R1',
      orderId: 'o1',
      subtotal: 10,
      platformFee: 1,
      weekEnding: new Date().toISOString(),
    });
    const res = makeRes();

    await addOrderToSettlement(req, res);

    expect(mockFindOneAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeSettlement);
  });

  test('getAllSettlements - success', async () => {
    const settlements = [{ _id: 's1' }];
    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(settlements),
      }),
    });

    const req = makeReq();
    const res = makeRes();

    await getAllSettlements(req, res);

    expect(mockFind).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      settlements,
    }));
  });

  test('processWeeklySettlements - processes pending settlements', async () => {
    // Prepare one pending settlement
    const now = new Date();
    const pending = [
      {
        _id: 's1',
        restaurantId: 'r1',
        amountDue: 100,
        weekEnding: now,
        toISOString() { return now.toISOString(); },
      },
    ];

    mockFind.mockResolvedValueOnce(pending);
    mockBankTransfer.mockResolvedValue({ reference: 'tx123' });
    mockFindByIdAndUpdate.mockResolvedValue({ _id: 's1', status: 'PAID' });
    mockCreateNotification.mockResolvedValue(true);

    const req = makeReq();
    const res = makeRes();

    await processWeeklySettlements(req, res);

    expect(mockFind).toHaveBeenCalled();
    expect(mockBankTransfer).toHaveBeenCalledWith('r1', 100, expect.any(String));
    expect(mockFindByIdAndUpdate).toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      processed: expect.any(Number),
    }));
  });
});
