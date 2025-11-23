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
import { authorizationMiddleware } from "./middlewares/authorization-middleware";

const solarUnitRouter = express.Router();

solarUnitRouter.route("/").get(authenticationMiddleware,authorizationMiddleware, getAllSolarUnits).post(authenticationMiddleware,authorizationMiddleware,createSolarUnitValidator,createSolarUnit);

solarUnitRouter.route("/me").get(authenticationMiddleware, getSolarUnitforUser);

solarUnitRouter
  .route("/:id")
  .get(authenticationMiddleware,authorizationMiddleware, getSolarUnitById)
  .put(authenticationMiddleware,authorizationMiddleware,updateSolarUnit)
  .delete(authenticationMiddleware,authorizationMiddleware,deleteSolarUnit);

//solarUnitRouter.route("/users/:clerkUserId").get(getSolarUnitsByClerkUserId);
 
export default solarUnitRouter;