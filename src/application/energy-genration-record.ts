import { EnergyGenerationRecord } from "../infrastructure/entities/EnergyGenerationRecord";
import { NextFunction, Request, Response } from "express";

export const getAllEnergyGenerationRecordsBySolarUnitId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const energyGenerationRecords = await EnergyGenerationRecord.find({
      solarUnitId: req.params.id,
    });
    res.status(200).json(energyGenerationRecords);
  } catch (error) {
    next(error);
  }
};