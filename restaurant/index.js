import express from "express";
import cors from "cors";
import BodyParser from "body-parser";
import mongoose from "mongoose";
import { MONGOURL, PORT } from "./config.js";
import dotenv from "dotenv";
import Owner from "./Routes/ResturantOwnerRoute.js";
import Admin from "./routes/branchAdminRoute.js";
import logger, { pinoHttp, requestIdMiddleware } from './utils/logger.js';
import client from 'prom-client';

const app = express();
dotenv.config();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Request id and structured HTTP logging
app.use(requestIdMiddleware);
app.use(pinoHttp);

global.gConfig = {
  orders_url: process.env.ORDERS_SERVICE_URL || "http://localhost:5002", // Adjust port as needed
  notification_url: process.env.NOTIFICATION_SERVICE_URL,
};

app.use(express.json());
app.use(BodyParser.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api", Owner);
app.use("/api/branch", Admin);

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'restaurant-service' });
});

app.get('/ready', (req, res) => {
  const readyState = mongoose.connection.readyState;
  if (readyState === 1) return res.status(200).json({ status: 'ready', mongo: 'connected' });
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

const startServer = async () => {
  try {
    if (process.env.NODE_ENV !== 'test') {
      await mongoose.connect(MONGOURL);
      logger.info('✅ Database Connected Successfully');

      const server = app.listen(PORT, () => {
        logger.info({ port: PORT }, `Server is Running on Port ${PORT}`);
      });
    } else {
      logger.info('Restaurant service running in test mode - skipping DB connect');
    }
  } catch (error) {
    logger.error({ err: error }, 'Error connecting to the database');
  }
};
startServer();
export default app;
