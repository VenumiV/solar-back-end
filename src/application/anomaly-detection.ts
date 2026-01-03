import { EnergyGenerationRecord } from "../infrastructure/entities/EnergyGenerationRecord";
import { SolarUnit } from "../infrastructure/entities/SolarUnit";
import { Anomaly } from "../infrastructure/entities/Anomaly";
import mongoose from "mongoose";

/**
 * Anomaly Detection System for Solar Energy Generation
 * 
 * Detects 4+ types of anomalies:
 * 1. MECHANICAL - Equipment failure or degradation
 * 2. TEMPERATURE - Temperature-related performance issues
 * 3. SHADING - Obstruction or shading issues
 * 4. SENSOR_ERROR - Sensor malfunction or data errors
 * 5. BELOW_AVERAGE - Performance below expected average
 */

interface DetectionResult {
  anomalyType: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  description: string;
  affectedStartDate: Date;
  affectedEndDate: Date;
  metadata: Record<string, any>;
}

/**
 * 1. MECHANICAL Anomaly Detection
 * Detects sudden drops or zero production indicating equipment failure
 */
export async function detectMechanicalAnomalies(
  solarUnitId: string,
  records: any[]
): Promise<DetectionResult[]> {
  const anomalies: DetectionResult[] = [];
  
  if (records.length < 2) return anomalies;

  // Calculate average production
  const avgProduction = records.reduce((sum, r) => sum + (r.totalEnergy || 0), 0) / records.length;
  
  // Check for sudden drops (>70% decrease) or zero production
  for (let i = 1; i < records.length; i++) {
    const prevEnergy = records[i - 1].totalEnergy || 0;
    const currEnergy = records[i].totalEnergy || 0;
    
    if (currEnergy === 0 && prevEnergy > avgProduction * 0.3) {
      anomalies.push({
        anomalyType: "MECHANICAL",
        severity: "CRITICAL",
        description: `Complete production failure detected. Previous day: ${prevEnergy.toFixed(2)} kWh, Current: 0 kWh. Possible equipment malfunction.`,
        affectedStartDate: new Date(records[i]._id.date),
        affectedEndDate: new Date(records[i]._id.date),
        metadata: {
          previousEnergy: prevEnergy,
          currentEnergy: currEnergy,
          dropPercentage: 100,
        },
      });
    } else if (prevEnergy > 0 && currEnergy < prevEnergy * 0.3 && currEnergy < avgProduction * 0.5) {
      const dropPercent = ((prevEnergy - currEnergy) / prevEnergy) * 100;
      anomalies.push({
        anomalyType: "MECHANICAL",
        severity: dropPercent > 80 ? "CRITICAL" : "WARNING",
        description: `Significant production drop detected: ${dropPercent.toFixed(1)}% decrease from ${prevEnergy.toFixed(2)} kWh to ${currEnergy.toFixed(2)} kWh. Possible mechanical issue.`,
        affectedStartDate: new Date(records[i]._id.date),
        affectedEndDate: new Date(records[i]._id.date),
        metadata: {
          previousEnergy: prevEnergy,
          currentEnergy: currEnergy,
          dropPercentage: dropPercent,
        },
      });
    }
  }

  return anomalies;
}

/**
 * 2. TEMPERATURE Anomaly Detection
 * Detects performance degradation due to high temperatures
 * Solar panels lose efficiency at high temperatures (typically >25°C)
 */
export async function detectTemperatureAnomalies(
  solarUnitId: string,
  records: any[]
): Promise<DetectionResult[]> {
  const anomalies: DetectionResult[] = [];
  
  if (records.length < 7) return anomalies;

  // Get solar unit capacity for comparison
  const solarUnit = await SolarUnit.findById(solarUnitId);
  if (!solarUnit) return anomalies;

  const capacity = solarUnit.capacity; // in kW
  const expectedDailyEnergy = capacity * 8; // 8 daylight hours * capacity

  // Check for consistent underperformance during peak hours
  // If production is consistently below 60% of expected during peak season
  const recentRecords = records.slice(-7); // Last 7 days
  const avgRecentProduction = recentRecords.reduce((sum, r) => sum + (r.totalEnergy || 0), 0) / recentRecords.length;
  const expectedProduction = expectedDailyEnergy * 0.6; // 60% of expected

  if (avgRecentProduction < expectedProduction && avgRecentProduction > 0) {
    const efficiencyPercent = (avgRecentProduction / expectedDailyEnergy) * 100;
    anomalies.push({
      anomalyType: "TEMPERATURE",
      severity: efficiencyPercent < 40 ? "WARNING" : "INFO",
      description: `Consistent underperformance detected. Average production: ${avgRecentProduction.toFixed(2)} kWh (${efficiencyPercent.toFixed(1)}% of expected ${expectedDailyEnergy.toFixed(2)} kWh). Possible temperature-related efficiency loss.`,
      affectedStartDate: new Date(recentRecords[0]._id.date),
      affectedEndDate: new Date(recentRecords[recentRecords.length - 1]._id.date),
      metadata: {
        averageProduction: avgRecentProduction,
        expectedProduction: expectedDailyEnergy,
        efficiencyPercent: efficiencyPercent,
        daysAnalyzed: recentRecords.length,
      },
    });
  }

  return anomalies;
}

/**
 * 3. SHADING Anomaly Detection
 * Detects partial shading or obstruction issues
 * Characterized by consistent but reduced production
 */
export async function detectShadingAnomalies(
  solarUnitId: string,
  records: any[]
): Promise<DetectionResult[]> {
  const anomalies: DetectionResult[] = [];
  
  if (records.length < 5) return anomalies;

  // Calculate baseline (average of top 3 days)
  const sortedByEnergy = [...records]
    .map(r => r.totalEnergy || 0)
    .sort((a, b) => b - a);
  
  const top3Avg = sortedByEnergy.slice(0, 3).reduce((sum, val) => sum + val, 0) / 3;
  const overallAvg = sortedByEnergy.reduce((sum, val) => sum + val, 0) / sortedByEnergy.length;

  // If overall average is significantly below top 3 average, possible shading
  if (top3Avg > 0 && overallAvg < top3Avg * 0.7) {
    const reductionPercent = ((top3Avg - overallAvg) / top3Avg) * 100;
    
    // Find consecutive days with low production
    const lowProductionDays = records.filter(r => {
      const energy = r.totalEnergy || 0;
      return energy < top3Avg * 0.75;
    });

    if (lowProductionDays.length >= 3) {
      anomalies.push({
        anomalyType: "SHADING",
        severity: reductionPercent > 40 ? "WARNING" : "INFO",
        description: `Possible shading or obstruction detected. Production consistently ${reductionPercent.toFixed(1)}% below peak performance. Peak: ${top3Avg.toFixed(2)} kWh, Average: ${overallAvg.toFixed(2)} kWh.`,
        affectedStartDate: new Date(lowProductionDays[0]._id.date),
        affectedEndDate: new Date(lowProductionDays[lowProductionDays.length - 1]._id.date),
        metadata: {
          peakProduction: top3Avg,
          averageProduction: overallAvg,
          reductionPercent: reductionPercent,
          affectedDays: lowProductionDays.length,
        },
      });
    }
  }

  return anomalies;
}

/**
 * 4. SENSOR_ERROR Anomaly Detection
 * Detects sensor malfunctions: impossible values, negative readings, or extreme outliers
 */
export async function detectSensorErrors(
  solarUnitId: string,
  records: any[]
): Promise<DetectionResult[]> {
  const anomalies: DetectionResult[] = [];
  
  if (records.length < 3) return anomalies;

  const solarUnit = await SolarUnit.findById(solarUnitId);
  if (!solarUnit) return anomalies;

  const capacity = solarUnit.capacity; // in kW
  const maxPossibleDailyEnergy = capacity * 10; // Maximum possible (10 hours at 100%)

  // Check for impossible values
  for (const record of records) {
    const energy = record.totalEnergy || 0;
    const date = new Date(record._id.date);

    // Negative energy (impossible)
    if (energy < 0) {
      anomalies.push({
        anomalyType: "SENSOR_ERROR",
        severity: "CRITICAL",
        description: `Invalid sensor reading detected: ${energy} kWh (negative value). Sensor malfunction likely.`,
        affectedStartDate: date,
        affectedEndDate: date,
        metadata: {
          invalidValue: energy,
          errorType: "NEGATIVE_VALUE",
        },
      });
    }
    // Impossible high value (exceeds theoretical maximum)
    else if (energy > maxPossibleDailyEnergy * 1.2) {
      anomalies.push({
        anomalyType: "SENSOR_ERROR",
        severity: "CRITICAL",
        description: `Impossible sensor reading detected: ${energy.toFixed(2)} kWh exceeds theoretical maximum of ${maxPossibleDailyEnergy.toFixed(2)} kWh by ${((energy / maxPossibleDailyEnergy - 1) * 100).toFixed(1)}%.`,
        affectedStartDate: date,
        affectedEndDate: date,
        metadata: {
          invalidValue: energy,
          theoreticalMax: maxPossibleDailyEnergy,
          errorType: "EXCEEDS_MAXIMUM",
        },
      });
    }
  }

  // Check for extreme outliers using IQR method
  const energies = records.map(r => r.totalEnergy || 0).sort((a, b) => a - b);
  const q1 = energies[Math.floor(energies.length * 0.25)];
  const q3 = energies[Math.floor(energies.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  for (const record of records) {
    const energy = record.totalEnergy || 0;
    if (energy < lowerBound || energy > upperBound) {
      const date = new Date(record._id.date);
      anomalies.push({
        anomalyType: "SENSOR_ERROR",
        severity: "WARNING",
        description: `Outlier reading detected: ${energy.toFixed(2)} kWh. Expected range: ${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)} kWh. Possible sensor error.`,
        affectedStartDate: date,
        affectedEndDate: date,
        metadata: {
          outlierValue: energy,
          expectedRange: { lower: lowerBound, upper: upperBound },
          errorType: "STATISTICAL_OUTLIER",
        },
      });
    }
  }

  return anomalies;
}

/**
 * 5. BELOW_AVERAGE Anomaly Detection (existing method)
 * Detects days significantly below the window average
 */
/*export async function detectBelowAverageAnomalies(
  solarUnitId: string,
  records: any[],
  thresholdPercent: number = 40
): Promise<DetectionResult[]> {
  const anomalies: DetectionResult[] = [];
  
  if (records.length === 0) return anomalies;

  const totalEnergy = records.reduce((sum, record) => sum + (record.totalEnergy || 0), 0);
  const averageEnergy = totalEnergy / records.length;

  for (const record of records) {
    const energy = record.totalEnergy || 0;
    const deviationPercent = ((averageEnergy - energy) / averageEnergy) * 100;

    if (deviationPercent > thresholdPercent && energy > 0) {
      anomalies.push({
        anomalyType: "BELOW_AVERAGE",
        severity: deviationPercent > 60 ? "WARNING" : "INFO",
        description: `Production ${deviationPercent.toFixed(1)}% below window average. Actual: ${energy.toFixed(2)} kWh, Average: ${averageEnergy.toFixed(2)} kWh.`,
        affectedStartDate: new Date(record._id.date),
        affectedEndDate: new Date(record._id.date),
        metadata: {
          actualEnergy: energy,
          averageEnergy: averageEnergy,
          deviationPercent: deviationPercent,
        },
      });
    }
  }

  return anomalies;
}
*/
/**
 * Main detection function - runs all detection algorithms
 */
export async function detectAllAnomalies(solarUnitId: string): Promise<void> {
  try {
    // Get ALL grouped data for this solar unit 
    const records = await EnergyGenerationRecord.aggregate([
      {
        $match: {
          solarUnitId: new mongoose.Types.ObjectId(solarUnitId),
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
        $sort: { "_id.date": 1 },
      },
    ]);

    if (records.length === 0) {
      console.log(`No energy generation records found for solar unit ${solarUnitId}`);
      return;
    }

    console.log(`Processing ${records.length} daily records for anomaly detection (solar unit ${solarUnitId})`);

    // Run all detection algorithms
    const [
      mechanicalAnomalies,
      temperatureAnomalies,
      shadingAnomalies,
      sensorErrors,
     // belowAverageAnomalies,
    ] = await Promise.all([
      detectMechanicalAnomalies(solarUnitId, records),
      detectTemperatureAnomalies(solarUnitId, records),
      detectShadingAnomalies(solarUnitId, records),
      detectSensorErrors(solarUnitId, records),
      //detectBelowAverageAnomalies(solarUnitId, records),
    ]);

    // Combine all anomalies
    const allAnomalies = [
      ...mechanicalAnomalies,
      ...temperatureAnomalies,
      ...shadingAnomalies,
      ...sensorErrors,
     // ...belowAverageAnomalies,
    ];

    // Save anomalies to database (avoid duplicates)
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const anomaly of allAnomalies) {
      // Check if similar anomaly already exists
      const existing = await Anomaly.findOne({
        solarUnitId,
        anomalyType: anomaly.anomalyType,
        affectedStartDate: anomaly.affectedStartDate,
        resolved: false,
      });

      if (!existing) {
        await Anomaly.create({
          solarUnitId,
          ...anomaly,
        });
        createdCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`Anomaly detection complete: ${createdCount} new anomalies created, ${skippedCount} duplicates skipped (total detected: ${allAnomalies.length})`);
  } catch (error) {
    console.error(`Error detecting anomalies for solar unit ${solarUnitId}:`, error);
  }
}

