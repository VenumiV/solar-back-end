import { Anomaly } from "../infrastructure/entities/Anomaly";
import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../domain/errors/error";
import { getAuth } from "@clerk/express";
import { User } from "../infrastructure/entities/User";
import { SolarUnit } from "../infrastructure/entities/SolarUnit";
import { detectAllAnomalies } from "./anomaly-detection";
/**
 * Get anomalies for a user's solar unit(s)
 */
export const getAnomaliesForUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;
    
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Get user's solar units
    const solarUnits = await SolarUnit.find({ userId: user._id });
    const solarUnitIds = solarUnits.map(su => su._id);

    // Query parameters
    const { type, severity, resolved } = req.query;

    const query: any = { solarUnitId: { $in: solarUnitIds } };
    
    if (type) {
      query.anomalyType = type;
    }
    if (severity) {
      query.severity = severity;
    }
    if (resolved !== undefined) {
      query.resolved = resolved === "true";
    }

    const anomalies = await Anomaly.find(query)
      .populate("solarUnitId", "serialNumber capacity")
      .sort({ detectionTimestamp: -1 });

    res.status(200).json(anomalies);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all anomalies (admin only)
 */
export const getAllAnomalies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type, severity, resolved, solarUnitId } = req.query;

    const query: any = {};
    
    if (type) {
      query.anomalyType = type;
    }
    if (severity) {
      query.severity = severity;
    }
    if (resolved !== undefined) {
      query.resolved = resolved === "true";
    }
    if (solarUnitId) {
      query.solarUnitId = solarUnitId;
    }

    const anomalies = await Anomaly.find(query)
      .populate("solarUnitId", "serialNumber capacity")
      .sort({ detectionTimestamp: -1 });

    res.status(200).json(anomalies);
  } catch (error) {
    next(error);
  }
};

/**
 * Get anomaly statistics (for pie chart)
 */
export const getAnomalyStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;
    
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Get user's solar units
    const solarUnits = await SolarUnit.find({ userId: user._id });
    const solarUnitIds = solarUnits.map(su => su._id);

    const { resolved } = req.query;
    const query: any = { solarUnitId: { $in: solarUnitIds } };
    
    if (resolved !== undefined) {
      query.resolved = resolved === "true";
    }

    // Get all anomalies
    const anomalies = await Anomaly.find(query);

    // Calculate statistics by type
    const statsByType: Record<string, number> = {};
    let total = 0;

    anomalies.forEach((anomaly) => {
      const type = anomaly.anomalyType;
      statsByType[type] = (statsByType[type] || 0) + 1;
      total++;
    });

    // Convert to percentage and format for pie chart
    const pieChartData = Object.entries(statsByType).map(([type, count]) => ({
      name: getAnomalyTypeDisplayName(type),
      value: count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(1) : "0",
    }));

    res.status(200).json({
      total,
      byType: statsByType,
      pieChartData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve an anomaly
 */
export const resolveAnomaly = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const anomaly = await Anomaly.findById(id);
    if (!anomaly) {
      throw new NotFoundError("Anomaly not found");
    }

    anomaly.resolved = true;
    anomaly.resolvedAt = new Date();
    await anomaly.save();

    res.status(200).json(anomaly);
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to get display names for anomaly types
 */
function getAnomalyTypeDisplayName(type: string): string {
  const displayNames: Record<string, string> = {
    MECHANICAL: "Mechanical",
    TEMPERATURE: "Temperature",
    SHADING: "Shading",
    SENSOR_ERROR: "Sensor Error",
    BELOW_AVERAGE: "Below Average",
  };
  return displayNames[type] || type;
}

export const runAnomalyDetectionForUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;

    const user = await User.findOne({ clerkUserId });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const solarUnits = await SolarUnit.find({ userId: user._id });
    if (solarUnits.length === 0) {
      return res.status(200).json({ message: "No solar units for this user" });
    }

    let totalCreated = 0;

    for (const su of solarUnits) {
      await detectAllAnomalies(su._id.toString());
      // optional: count how many anomalies exist now for this unit
      const count = await Anomaly.countDocuments({ solarUnitId: su._id });
      totalCreated += count;
    }

    res.status(200).json({
      message: "Anomaly detection run successfully",
      solarUnits: solarUnits.map((su) => su._id),
      totalAnomalies: totalCreated,
    });
  } catch (error) {
    next(error);
  }
};