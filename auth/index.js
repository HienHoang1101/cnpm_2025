import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import logger, { pinoHttp } from './utils/logger.js';
import requestIdMiddleware from './utils/requestId.js';
import client from 'prom-client';
import dotenv from "dotenv";

dotenv.config();
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const mod = await import('../shared-tracing/index.js');
      const init = mod.initTracing || mod.default;
      if (typeof init === 'function') await init(process.env.SERVICE_NAME || 'auth-service');
    } catch (e) {
      console.error('Tracing init failed', e);
    }
  })();
}
const app = express();

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import seedAdminUser from "./utils/seedAdmin.js";

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
// Request id middleware (sets x-request-id and attaches `req.log` child)
app.use(requestIdMiddleware);
// HTTP request logging (structured)
app.use(pinoHttp);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Prometheus metrics
const register = client.register;
// avoid multiple collections during hot-reload/tests
if (!global.__promClientInitialized) {
  client.collectDefaultMetrics({ register });
  global.__promClientInitialized = true;
}

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 1, 2, 5]
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route && req.route.path ? req.route.path : req.path;
    end({ method: req.method, route, code: res.statusCode });
  });
  next();
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

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "auth-service" });
});

app.get('/ready', (req, res) => {
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const readyState = mongoose.connection.readyState;
  if (readyState === 1) {
    return res.status(200).json({ status: 'ready', mongo: 'connected' });
  }
  return res.status(503).json({ status: 'not_ready', mongo: readyState });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error({ err, url: req.originalUrl }, 'Unhandled error');
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "production" ? "Server error" : err.message,
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

const PORT = process.env.PORT || 5001;

if (process.env.NODE_ENV !== 'test') {
  if (process.env.MONGO_URI) {
    mongoose
      .connect(process.env.MONGO_URI)
      .then(async () => {
        if (process.env.AUTO_SEED_ADMIN === "true") {
          try {
            await seedAdminUser();
            logger.info('Admin user check completed');
          } catch (error) {
            logger.error({ err: error }, 'Error checking admin user');
          }
        }
        app.listen(PORT, () => {
          logger.info({ port: PORT }, 'Auth service running');
        });
      })
      .catch((err) => {
        console.error("MongoDB connection error:", err);
        // don't exit; start server to allow health checks in local/dev
        app.listen(PORT, () => {
          logger.warn('Auth service started without MongoDB connection', { err: err.message });
        });
      });
  } else {
    logger.warn('MONGO_URI not set — starting auth service without DB connection');
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Auth service running (no DB)');
    });
  }
} else {
  logger.info('Auth service running in test mode - skipping DB connect');
}

export default app;
