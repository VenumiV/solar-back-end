import "dotenv/config";
import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { globalErrorHandler } from "./api/middlewares/global-error-handling-middleware";
import { loggerMiddleware } from "./api/middlewares/logger-middleware";
import solarUnitRouter from "./api/solar-units";
import usersRouter from "./api/users";
import anomaliesRouter from "./api/anomalies";
import energyGenerationRecordRouter from "./api/energy-generation-record";
import invoicesRouter from "./api/invoices";
import paymentRouter from "./api/payment";
import webhooksRouter from "./api/webhooks";
import { connectDB } from "./infrastructure/db";
import { handleStripeWebhook } from "./application/payment";
import { initializeScheduler } from "./infrastructure/scheduler";

const server = express();

// CORS Configuration - UPDATED
const allowedOrigins = [
  process.env.FRONTEND_URL || "https://fed-front-end-venumi.netlify.app",
  "http://localhost:5173"
].filter(Boolean);

server.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Handle preflight requests
//server.options('*', cors());

server.use(loggerMiddleware);

// Stripe webhook route MUST be before express.json() middleware
// It needs the raw request body for signature verification
server.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Other webhooks (Clerk)
server.use("/api/webhooks", webhooksRouter);

// Now apply JSON parsing for other routes
server.use(express.json());

// Clerk authentication middleware
server.use(clerkMiddleware());

// API routes
server.use("/api/solar-units", solarUnitRouter);
server.use("/api/energy-generation-records", energyGenerationRecordRouter);
server.use("/api/users", usersRouter);
server.use("/api/anomalies", anomaliesRouter);
server.use("/api/invoices", invoicesRouter);
server.use("/api/payments", paymentRouter);

server.use(globalErrorHandler);

connectDB().then(() => {
  // Initialize scheduler after DB connection
  initializeScheduler();
  console.log(`Database connected successfully`);
  console.log(`Allowed CORS origins:`, allowedOrigins);
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
});
