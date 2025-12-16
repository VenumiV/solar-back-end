import { SolarUnit } from "../../infrastructure/entities/SolarUnit";
import { detectAllAnomalies } from "../anomaly-detection";

/**
 * Background job to detect anomalies for all solar units
 * Runs after energy generation records are synced
 */
export const runAnomalyDetection = async () => {
  try {
    console.log(`[${new Date().toISOString()}] Starting anomaly detection for all solar units...`);
    
    const solarUnits = await SolarUnit.find({ status: "ACTIVE" });
    
    for (const solarUnit of solarUnits) {
      await detectAllAnomalies(solarUnit._id.toString());
    }
    
    console.log(`[${new Date().toISOString()}] Anomaly detection completed for ${solarUnits.length} solar units`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Anomaly detection failed:`, error);
  }
};

