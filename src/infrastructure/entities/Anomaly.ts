import mongoose from "mongoose";

const anomalySchema = new mongoose.Schema({
  solarUnitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SolarUnit",
    required: true,
  },
  anomalyType: {
    type: String,
    required: true,
    enum: ["MECHANICAL", "TEMPERATURE", "SHADING", "SENSOR_ERROR"]
  },
  severity: {
    type: String,
    required: true,
    enum: ["CRITICAL", "WARNING", "INFO"],
    default: "WARNING",
  },
  detectionTimestamp: {
    type: Date,
    default: Date.now,
  },
  affectedStartDate: {
    type: Date,
    required: true,
  },
  affectedEndDate: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  resolved: {
    type: Boolean,
    default: false,
  },
  resolvedAt: {
    type: Date,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
});

// Index for efficient queries
anomalySchema.index({ solarUnitId: 1, detectionTimestamp: -1 });
anomalySchema.index({ resolved: 1 });
anomalySchema.index({ severity: 1 });
anomalySchema.index({ anomalyType: 1 });

export const Anomaly = mongoose.model("Anomaly", anomalySchema);

