import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { startRegistrationConsumer } from "./consumers/notificationConsumer.js";
import logger, { pinoHttp, requestIdMiddleware } from './utils/logger.js';

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const mod = await import('../shared-tracing/index.js');
      const init = mod.initTracing || mod.default;
      if (typeof init === 'function') await init(process.env.SERVICE_NAME || 'notification-service');
    } catch (e) {
      console.error('Tracing init failed', e);
    }
  })();
}
import client from 'prom-client';

// Load environment variables
dotenv.config();

const app = express();

// Connect to MongoDB
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Middleware
// Request id and structured HTTP logging
app.use(requestIdMiddleware);
app.use(pinoHttp);

app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

global.gConfig = {
  auth_url: process.env.AUTH_SERVICE_URL,
  restaurant_url: process.env.RESTAURANT_SERVICE_URL,
  notification_url: process.env.NOTIFICATION_SERVICE_URL,
  order_url: process.env.ORDER_SERVICE_URL,
};

// Routes
app.use("/api/notifications", notificationRoutes);

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'notification-service' });
});

// Readiness endpoint
app.get('/ready', (req, res) => {
  // Simple readiness: if we have DB connection or in test mode, return ready
  res.status(200).json({ status: 'ready', service: 'notification-service' });
});

// Prometheus metrics (collect default metrics once)
const register = client.register;
if (!global.__promClientInitialized) {
  client.collectDefaultMetrics({ register });
  global.__promClientInitialized = true;
}

app.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.status(200).send(metrics);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Start Kafka consumer
if (process.env.NODE_ENV !== 'test') {
  startRegistrationConsumer();
}

// Start server (unless running tests)
const PORT = process.env.PORT || 5007;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server running');
  });
} else {
  logger.info('Notification service running in test mode - skipping DB connect and consumer');
}

export default app;
