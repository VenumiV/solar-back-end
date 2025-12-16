import { EnergyGenerationRecord } from "../infrastructure/entities/EnergyGenerationRecord";
import { NextFunction, Request, Response } from "express";
import { GetAllEnergyGenerationRecordsQueryDto, GetCapacityFactorQueryDto } from "../domain/dtos/solar-unit";
import { ValidationError, NotFoundError } from "../domain/errors/error";
import { SolarUnit } from "../infrastructure/entities/SolarUnit";
import mongoose from "mongoose";

export const getAllEnergyGenerationRecordsBySolarUnitId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const results = GetAllEnergyGenerationRecordsQueryDto.safeParse(req.query);
    if (!results.success) {
      throw new ValidationError(results.error.message);
    }

    const { groupBy, limit } = results.data;

    if (!groupBy) {
      const energyGenerationRecords = await EnergyGenerationRecord.find({
        solarUnitId: id,
      }).sort({ timestamp: -1 });
      res.status(200).json(energyGenerationRecords);
    }

    if (groupBy === "date") {
      const energyGenerationRecords = await EnergyGenerationRecord.aggregate([
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
              },
            },
            totalEnergy: { $sum: "$energyGenerated" },
          },
        },
        {
          $sort: { "_id.date": -1 },
        },
      ]);

       if (!limit) {
        res.status(200).json(energyGenerationRecords);
        return;
      }
      res.status(200).json(energyGenerationRecords.slice(0, parseInt(limit)));
  }
}catch (error) {
    next(error);
  }
};

export const getCapacityFactorBySolarUnitId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const results = GetCapacityFactorQueryDto.safeParse(req.query);
    if (!results.success) {
      throw new ValidationError(results.error.message);
    }

    const { days } = results.data;
    const daysToCalculate = days ? parseInt(days) : 30; // Default to 30 days

    // Get solar unit to access capacity
    const solarUnit = await SolarUnit.findById(id);
    if (!solarUnit) {
      throw new NotFoundError("Solar unit not found");
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToCalculate);

    // Get all energy generation records in the date range
    const records = await EnergyGenerationRecord.find({
      solarUnitId: id,
      timestamp: { $gte: startDate, $lte: endDate },
    });

    // Calculate actual energy generated (in kWh)
    const actualEnergyGenerated = records.reduce(
      (sum, record) => sum + (record.energyGenerated || 0),
      0
    );

    // Calculate theoretical maximum energy
    // Solar panels only generate during daylight hours (8 AM - 5 PM = 10 hours per day)
    // Capacity is in kW, so theoretical max = capacity (kW) × daylight hours per day × days
    const daylightHoursPerDay = 8; // 9 AM to 4 PM (inclusive) = 8 hours
    const hoursInPeriod = daysToCalculate * daylightHoursPerDay;
    const theoreticalMaximum = solarUnit.capacity * hoursInPeriod; // in kWh

    // Calculate capacity factor as percentage
    const capacityFactor = theoreticalMaximum > 0
      ? (actualEnergyGenerated / theoreticalMaximum) * 100
      : 0;

    // Also calculate daily capacity factors for the chart
    const dailyCapacityFactors = await EnergyGenerationRecord.aggregate([
      {
        $match: {
          solarUnitId: new mongoose.Types.ObjectId(id),
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
            },
          },
          totalEnergy: { $sum: "$energyGenerated" },
        },
      },
      {
        $sort: { "_id.date": -1 },
      },
      {
        $limit: daysToCalculate,
      },
    ]);

    // Calculate daily capacity factors
    const dailyData = dailyCapacityFactors.map((day) => {
      // Solar panels only generate during daylight hours (8 AM - 5 PM = 10 hours per day)
      const daylightHoursPerDay = 10;
      const dailyTheoretical = solarUnit.capacity * daylightHoursPerDay;
      const dailyCapacityFactor = dailyTheoretical > 0
        ? (day.totalEnergy / dailyTheoretical) * 100
        : 0;
      
      return {
        date: day._id.date,
        capacityFactor: parseFloat(dailyCapacityFactor.toFixed(2)),
        energyGenerated: day.totalEnergy,
      };
    });

    res.status(200).json({
      overallCapacityFactor: parseFloat(capacityFactor.toFixed(2)),
      actualEnergyGenerated,
      theoreticalMaximum,
      periodDays: daysToCalculate,
      dailyData: dailyData.reverse(), // Reverse to show oldest to newest
    });
  } catch (error) {
    next(error);
  }
};