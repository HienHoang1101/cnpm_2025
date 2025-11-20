import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import logger, { pinoHttp, requestIdMiddleware } from "./utils/logger.js";

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const mod = await import('../shared-tracing/index.js');
      const init = mod.initTracing || mod.default;
      if (typeof init === 'function') await init(process.env.SERVICE_NAME || 'order-service');
    } catch (e) {
      console.error('Tracing init failed', e);
    }
  })();
}
import client from 'prom-client';
import cookieParser from "cookie-parser";
import http from "http";
import orderRoutes from "./routes/orderRoute.js";
import cartRoutes from "./routes/cartRoute.js";
import { setupWebSocket } from "./websocket.js";

dotenv.config();
const app = express();

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Middleware
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
// Request ID and structured HTTP logging
app.use(requestIdMiddleware);
app.use(pinoHttp);
app.use(express.json());
app.use(cookieParser());

// Set global configuration for service URLs
global.gConfig = {
  auth_url: process.env.AUTH_SERVICE_URL,
  restaurant_url: process.env.RESTAURANT_SERVICE_URL,
  notification_url: process.env.NOTIFICATION_SERVICE_URL,
  admin_url: process.env.ADMIN_SERVICE_URL,
};

// Routes
app.use("/api/orders/", orderRoutes);
app.use("/api/cart", cartRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "Order Service" });
});

app.get('/ready', (req, res) => {
  const readyState = mongoose.connection.readyState;
  if (readyState === 1) {
    return res.status(200).json({ status: 'ready', mongo: 'connected' });
  }
  return res.status(503).json({ status: 'not_ready', mongo: readyState });
});

// Prometheus metrics
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

const PORT = process.env.PORT || 5002;
if (process.env.NODE_ENV !== 'test') {
  if (process.env.MONGODB_URI) {
    mongoose
      .connect(process.env.MONGODB_URI)
      .then(() => {
        // Initialize and setup WebSocket server
        const wss = setupWebSocket(server);

        // Start HTTP server instead of Express app directly
        server.listen(PORT, () => {
          logger.info({ port: PORT }, 'Order Service is running');
          logger.info({ ws: `ws://localhost:${PORT}/ws/orders/:id` }, 'WebSocket server running');
        });
      })
      .catch((err) => {
        logger.error({ err }, 'MongoDB connection error');
        // don't exit; start server to allow health checks in local/dev
        server.listen(PORT, () => {
          logger.warn('Order service started without MongoDB connection', { err: err.message });
        });
      });
  } else {
    logger.warn('MONGODB_URI not set — starting order service without DB connection');
    const wss = setupWebSocket(server);
    server.listen(PORT, () => {
      logger.info({ port: PORT }, 'Order service running (no DB)');
      logger.info({ ws: `ws://localhost:${PORT}/ws/orders/:id` }, 'WebSocket server running');
    });
  }
} else {
  logger.info('Order service running in test mode - skipping DB connect');
}

export default app;
