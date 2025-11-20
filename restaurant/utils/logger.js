let logger;
let pinoHttp;
let requestIdMiddleware;

if (process.env.NODE_ENV === 'test') {
  const noop = () => {};
  const mockLogger = { info: noop, warn: noop, error: noop, debug: noop, child: () => mockLogger };
  logger = mockLogger;
  pinoHttp = (req, res, next) => next();
  requestIdMiddleware = (req, res, next) => {
    req.id = req.headers['x-request-id'] || 'test-req-id';
    res.setHeader('x-request-id', req.id);
    req.log = mockLogger;
    next();
  };
} else {
  const shared = await import('../../shared-logging/index.js');
  logger = shared.default;
  pinoHttp = shared.pinoHttp;
  requestIdMiddleware = shared.requestIdMiddleware;
}

export default logger;
export { pinoHttp, requestIdMiddleware };
