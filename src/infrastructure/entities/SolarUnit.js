import mongoose from "mongoose";

const solarUnitSchema = new mongoose.Schema({
  serialNumber: {
    type: String,
    required: true,
    unique: true,
  },
  installationDate: {
    type: Date,
    required: true,
  },
  capacity: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"],
  },
});

export const SolarUnit = mongoose.model("SolarUnit", solarUnitSchema);