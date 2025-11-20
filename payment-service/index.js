import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import logger, { pinoHttp, requestIdMiddleware } from './utils/logger.js';
import client from 'prom-client';

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const mod = await import('../shared-tracing/index.js');
      const init = mod.initTracing || mod.default;
      if (typeof init === 'function') await init(process.env.SERVICE_NAME || 'payment-service');
    } catch (e) {
      console.error('Tracing init failed', e);
    }
  })();
}
import mongoose from "mongoose";
import paymentRoutes from "./routes/paymentRoutes.js";

dotenv.config();

// Initialize Express
const app = express();

// Apply CORS globally
app.use(cors());
// Request id and structured HTTP logging
app.use(requestIdMiddleware);
app.use(pinoHttp);

// Prometheus metrics
const register = client.register;
if (!global.__promClientInitialized) {
  client.collectDefaultMetrics({ register });
  global.__promClientInitialized = true;
}
const httpRequestCounter =
  register.getSingleMetric('http_requests_total') ||
  new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'code'],
  });

app.use((req, res, next) => {
  res.on('finish', () => {
    const route = req.route && req.route.path ? req.route.path : req.path;
    httpRequestCounter.inc({ method: req.method, route, code: res.statusCode });
  });
  next();
});

// Important: Only apply json parsing to non-webhook routes
app.use((req, res, next) => {
  if (req.originalUrl === "/api/payment/webhook") {
    next(); // Skip body parsing for webhook route
  } else {
    express.json()(req, res, next); // Apply JSON parsing to other routes
  }
});

global.gConfig = {
  auth_url: process.env.AUTH_SERVICE_URL,
  restaurant_url: process.env.RESTAURANT_SERVICE_URL,
  notification_url: process.env.NOTIFICATION_SERVICE_URL,
  order_url: process.env.ORDER_SERVICE_URL,
};

// Database Connection
if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => logger.info('Connected to MongoDB'))
    .catch((err) => logger.error({ err }, 'MongoDB connection error'));
} else {
  logger.info('Payment service running in test mode - skipping DB connect');
}

// Routes
app.use("/api/payment", paymentRoutes);

// Health and metrics endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'payment-service' });
});

app.get('/ready', (req, res) => {
  const readyState = mongoose.connection.readyState;
  if (readyState === 1) return res.status(200).json({ status: 'ready', mongo: 'connected' });
  return res.status(503).json({ status: 'not_ready', mongo: readyState });
});

app.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.status(200).send(metrics);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Start Server
const PORT = process.env.PORT || 5004;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Payment service running');
  });
} else {
  logger.info('Payment service running in test mode - app exported');
}

export default app;
