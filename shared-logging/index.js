import pino from 'pino';
import expressPino from 'express-pino-logger';
import { randomUUID } from 'crypto';

const serviceName = process.env.SERVICE_NAME || 'unknown-service';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { pid: false, service: serviceName, env: process.env.NODE_ENV || 'development' },
});

const pinoHttp = expressPino({ logger });

async function getActiveTraceId() {
  try {
    const { trace, context } = await import('@opentelemetry/api');
    const span = trace.getSpan(context.active());
    if (span) {
      const sc = span.spanContext();
      return sc.traceId;
    }
  } catch (e) {
    // tracing not available or no active span
  }
  return undefined;
}

async function requestIdMiddleware(req, res, next) {
  const headerId = req.headers['x-request-id'] || req.headers['x_request_id'];
  const id = headerId || randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  try {
    const traceId = await getActiveTraceId();
    const extra = { req_id: id, service: serviceName };
    if (traceId) extra.trace_id = traceId;
    req.log = logger.child(extra);
  } catch (e) {
    req.log = logger;
  }
  next();
}

export default logger;
export { pinoHttp, requestIdMiddleware };
