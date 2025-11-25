import { NextFunction, Request, Response } from "express";
import { SolarUnit } from "../infrastructure/entities/SolarUnit";
import { User } from "../infrastructure/entities/User";

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const solarUnits = await User.find();
    res.status(200).json(solarUnits);
  } catch (error) {
    next(error);
  }
};
