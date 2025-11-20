import requestIdMiddleware from '../utils/requestId.js';
import loggerDefault, { pinoHttp, requestIdMiddleware as loggerRequestId } from '../utils/logger.js';

describe('Utils middlewares and logger', () => {
  test('requestId middleware sets id from header and sets response header', () => {
    const req = { headers: { 'x-request-id': 'abc-123' } };
    const res = { headers: {}, setHeader: (k, v) => { res.headers[k] = v; } };
    let called = false;
    const next = () => { called = true; };

    requestIdMiddleware(req, res, next);

    expect(called).toBe(true);
    expect(req.id).toBe('abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  test('logger.requestIdMiddleware attaches logger and id', () => {
    const req = { headers: {} };
    const res = { headers: {}, setHeader: (k, v) => { res.headers[k] = v; } };
    let called = false;
    const next = () => { called = true; };

    loggerRequestId(req, res, next);

    expect(called).toBe(true);
    expect(req.id).toBeDefined();
    expect(req.log).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  test('pinoHttp is a passthrough middleware', () => {
    let called = false;
    const next = () => { called = true; };
    pinoHttp({}, {}, next);
    expect(called).toBe(true);
  });

  test('default logger has expected methods', () => {
    expect(typeof loggerDefault.info).toBe('function');
    expect(typeof loggerDefault.error).toBe('function');
    expect(typeof loggerDefault.child).toBe('function');
  });
});
