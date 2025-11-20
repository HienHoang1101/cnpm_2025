import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import RestaurantSettlement from "./routes/restaurantPaymentRoutes.js";
import { processWeeklySettlements } from "./controllers/settlementController.js";
import cron from "node-cron";
import logger, { pinoHttp, requestIdMiddleware } from './utils/logger.js';
import client from 'prom-client';

dotenv.config();

// Initialize Express
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

global.gConfig = {
  auth_url: process.env.AUTH_SERVICE_URL,
  restaurant_url: process.env.RESTAURANT_SERVICE_URL,
  notification_url: process.env.NOTIFICATION_SERVICE_URL,
  order_url: process.env.ORDER_SERVICE_URL,
};

// Run every Sunday at 11:30 PM
if (process.env.NODE_ENV !== 'test') {
  cron.schedule(
    "30 23 * * 0",
    async () => {
      try {
        logger.info('Auto-processing weekly settlements...');
        await processWeeklySettlements();
      } catch (error) {
        logger.error({ err: error }, 'Auto-settlement failed');
      }
    },
    {
      timezone: "Asia/Colombo",
      name: "WeeklySettlements",
    }
  );
}

// Routes
app.use("/api/settlements", RestaurantSettlement);

// Health and metrics
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'admin-service' }));

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

// Database Connection
if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => logger.info('Connected to MongoDB'))
    .catch((err) => logger.error({ err }, 'MongoDB connection error'));
} else {
  logger.info('Admin service running in test mode - skipping DB connect');
}

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, `Server is running on http://localhost:${PORT}`);
  });
}

export default app;
