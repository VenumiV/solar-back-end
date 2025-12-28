import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    solarUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SolarUnit",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    billingPeriodStart: {
      type: Date,
      required: true,
    },
    billingPeriodEnd: {
      type: Date,
      required: true,
    },
    totalEnergyGenerated: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Invoice = mongoose.model("Invoice", invoiceSchema);

