import express from "express";

import {
  getAllSolarUnits,
  createSolarUnit,
  getSolarUnitById,
  updateSolarUnit,
  deleteSolarUnit,
  createSolarUnitValidator,
  getSolarUnitforUser,
} from "../application/solar-unit";
import { authenticationMiddleware } from "./middlewares/authentication-middleware";

const solarUnitRouter = express.Router();

solarUnitRouter.route("/").get(getAllSolarUnits).post(createSolarUnitValidator,createSolarUnit);

solarUnitRouter.route("/me").get(authenticationMiddleware, getSolarUnitforUser);

solarUnitRouter
  .route("/:id")
  .get(getSolarUnitById)
  .put(updateSolarUnit)
  .delete(deleteSolarUnit);

//solarUnitRouter.route("/users/:clerkUserId").get(getSolarUnitsByClerkUserId);
 
export default solarUnitRouter;