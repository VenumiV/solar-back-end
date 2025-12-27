import { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { NotFoundError } from "../../../domain/errors/error";
import { User } from "../../../infrastructure/entities/User";
import { SolarUnit } from "../../../infrastructure/entities/SolarUnit";
import { EnergyGenerationRecord } from "../../../infrastructure/entities/EnergyGenerationRecord";
import { detectAllAnomalies } from "../../../application/anomaly-detection";
import { z } from "zod";

export const DataAPIEnergyGenerationRecordDto = z.object({
    _id: z.string(),
    serialNumber: z.string(),
    energyGenerated: z.number(),
    timestamp: z.string(),
    intervalHours: z.number(),
    __v: z.number(),
});

/**
 * Synchronizes energy generation records from the data API
 * Fetches latest records and merges new data with existing records
 */
export const syncMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth = getAuth(req);
    const user = await User.findOne({ clerkUserId: auth.userId });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    let solarUnit = await SolarUnit.findOne({ userId: user._id });
    if (!solarUnit) {
      // Fallback: try to reuse an existing solar unit (e.g. seeded) and attach to user
      const unassignedSolarUnit = await SolarUnit.findOne({
        userId: { $exists: false },
      });
      if (unassignedSolarUnit) {
        unassignedSolarUnit.userId = user._id;
        await unassignedSolarUnit.save();
        solarUnit = unassignedSolarUnit;
      } else {
        throw new NotFoundError("Solar unit not found");
      }
    }

    // Fetch latest records from data API
    const dataAPIResponse = await fetch(
      `http://localhost:8001/api/energy-generation-records/solar-unit/${solarUnit.serialNumber}`
    );
    if (!dataAPIResponse.ok) {
      throw new Error("Failed to fetch energy generation records from data API");
    }

    const latestEnergyGenerationRecords = DataAPIEnergyGenerationRecordDto.array().parse(
      await dataAPIResponse.json()
    );

    // Get latest synced timestamp to only fetch new data
    const lastSyncedRecord = await EnergyGenerationRecord.findOne({
      solarUnitId: solarUnit._id,
    }).sort({ timestamp: -1 });

    // Filter records that are new (not yet in database)
    const newRecords = latestEnergyGenerationRecords.filter((apiRecord) => {
      if (!lastSyncedRecord) return true; // First sync, add all
      return new Date(apiRecord.timestamp) > lastSyncedRecord.timestamp;
    });

    if (newRecords.length > 0) {
      // Transform API records to match schema
      const recordsToInsert = newRecords.map((record) => ({
        solarUnitId: solarUnit._id,
        energyGenerated: record.energyGenerated,
        timestamp: new Date(record.timestamp),
        intervalHours: record.intervalHours,
      }));

      await EnergyGenerationRecord.insertMany(recordsToInsert);
      console.log(`Synced ${recordsToInsert.length} new energy generation records`);
    } else {
      console.log("No new records to sync");
    }

    // Always run anomaly detection after sync (even if no new records)
    // This ensures anomalies are detected for all existing data
    try {
      console.log(`Running anomaly detection for solar unit ${solarUnit.serialNumber}...`);
      await detectAllAnomalies(solarUnit._id.toString());
      console.log(`Anomaly detection completed for solar unit ${solarUnit.serialNumber}`);
    } catch (detectionError) {
      console.error(`Error running anomaly detection:`, detectionError);
      // Don't fail the request if detection fails, just log it
    }

    next();
  } catch (error) {
    console.error("Sync middleware error:", error);
    next(error);
  }
};