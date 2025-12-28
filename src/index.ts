
import "dotenv/config";
import express from "express";
import { globalErrorHandler } from "./api/middlewares/global-error-handling-middleware";
import { loggerMiddleware } from "./api/middlewares/logger-middleware";
import solarUnitRouter from "./api/solar-units";
import usersRouter from "./api/users";
import anomaliesRouter from "./api/anomalies";
import energyGenerationRecordRouter from "./api/energy-generation-record";
import invoicesRouter from "./api/invoices";
import paymentRouter from "./api/payment";
import { connectDB } from "./infrastructure/db";
import cors from "cors";
import webhooksRouter from "./api/webhooks";
import { clerkMiddleware } from "@clerk/express";
import { handleStripeWebhook } from "./application/payment";
import { initializeScheduler } from "./infrastructure/scheduler";


const server = express();
server.use(cors({ origin: "http://localhost:5173" }));
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
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});