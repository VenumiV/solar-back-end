import express from "express";
import {
  getAnomaliesForUser,
  getAllAnomalies,
  getAnomalyStatistics,
  resolveAnomaly,
  runAnomalyDetectionForUser
  

} from "../application/anomalies";
import { authenticationMiddleware } from "./middlewares/authentication-middleware";

const anomaliesRouter = express.Router();

// User endpoints
anomaliesRouter
  .route("/me")
  .get(authenticationMiddleware, getAnomaliesForUser);

anomaliesRouter
  .route("/me/statistics")
  .get(authenticationMiddleware, getAnomalyStatistics);

anomaliesRouter
  .route("/me/run-detection")
  .post(authenticationMiddleware, runAnomalyDetectionForUser);

anomaliesRouter
  .route("/:id/resolve")
  .patch(authenticationMiddleware, resolveAnomaly);
anomaliesRouter
  .route("/:id/resolve")
  .patch(authenticationMiddleware, resolveAnomaly);

// Admin endpoints
anomaliesRouter
  .route("/")
  .get(authenticationMiddleware, getAllAnomalies);

export default anomaliesRouter;

