import express from "express";
import {
  getAllSolarUnits,
  createSolarUnit,
  getSolarUnitById,
  updateSolarUnit,
  deleteSolarUnit,
  createSolarUnitValidator,
  getSolarUnitsByClerkUserId,
} from "../application/solar-unit";

const solarUnitRouter = express.Router();

solarUnitRouter.route("/").get(getAllSolarUnits).post(createSolarUnitValidator,createSolarUnit);
solarUnitRouter
  .route("/:id")
  .get(getSolarUnitById)
  .put(updateSolarUnit)
  .delete(deleteSolarUnit);
  solarUnitRouter.route("/users/:clerkUserId").get(getSolarUnitsByClerkUserId);

export default solarUnitRouter;