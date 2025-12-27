import express from "express";
import {
  getAnomaliesForUser,
  getAllAnomalies,
  getAnomalyStatistics,
  resolveAnomaly,
  runAnomalyDetectionForUser
  

} from "../application/anomalies";
import { authenticationMiddleware } from "./middlewares/authentication-middleware";
import { authorizationMiddleware } from "./middlewares/authorization-middleware";

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


// Admin endpoints
// GET /api/anomalies?type=MECHANICAL&severity=CRITICAL&resolved=false&solarUnitId=<id>
// Requires admin role
anomaliesRouter
  .route("/")
  .get(authenticationMiddleware, authorizationMiddleware, getAllAnomalies);

export default anomaliesRouter;

