
import "dotenv/config";
import express from "express";
import energyGenerationRecordRouter from "./api/energy-generation-record";
import { globalErrorHandler } from "./api/middlewares/global-error-handling-middleware";
import { loggerMiddleware } from "./api/middlewares/logger-middleware";
import solarUnitRouter from "./api/solar-units";
import { connectDB } from "./infrastructure/db";
import cors from "cors";
import webhooksRouter from "./api/webhooks";

const server = express();
server.use(express.json());
server.use(cors({ origin: "http://localhost:5173" }));

server.use(loggerMiddleware);

server.use("/api/solar-units", solarUnitRouter);
server.use("/api/energy-generation-records", energyGenerationRecordRouter);
server.use("/api/webhooks",webhooksRouter);


server.use(globalErrorHandler);

connectDB();

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});