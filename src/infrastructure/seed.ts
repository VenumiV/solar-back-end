import mongoose from "mongoose";
import { SolarUnit } from "./entities/SolarUnit";
import dotenv from "dotenv";
import { connectDB } from "./db";
import { Invoice } from "./entities/Invoice";

dotenv.config();

async function seed() {
  try {
    // Connect to DB
    await connectDB();  

    // Clear existing data
    await SolarUnit.deleteMany({});
    await Invoice.deleteMany({});

    // Create three solar units
    const solarUnit1 = await SolarUnit.create({  
      serialNumber: "SU-0001",
      installationDate: new Date("2025-08-01"),
      capacity: 5000,
      status: "ACTIVE",
    });

    const solarUnit2 = await SolarUnit.create({  
      serialNumber: "SU-0002",
      installationDate: new Date("2025-07-15"),
      capacity: 7500,
      status: "ACTIVE",
    });

    const solarUnit3 = await SolarUnit.create({  
      serialNumber: "SU-0003",
      installationDate: new Date("2025-06-20"),
      capacity: 6000,
      status: "MAINTENANCE",
    });

    // Create invoices for each solar unit
    const invoice1 = await Invoice.create({
      solarUnitId: solarUnit1._id,
      userId: "693e8509d67828d3e1740f4c", // Add a valid userId
      billingPeriodStart: new Date("2025-08-01"),
      billingPeriodEnd: new Date("2025-08-31"),
      totalEnergyGenerated: 450,
      paymentStatus: "PENDING",
    });

    const invoice2 = await Invoice.create({
      solarUnitId: solarUnit2._id,
      userId: "695146ca37e7b39928c1af18",
      billingPeriodStart: new Date("2025-07-15"),
      billingPeriodEnd: new Date("2025-08-15"),
      totalEnergyGenerated: 680,
      paymentStatus: "PAID",
      paidAt: new Date("2025-08-20"),
    });

    const invoice3 = await Invoice.create({
      solarUnitId: solarUnit3._id,
     userId: "6954dbbc8219c4f040ec00e0",
      billingPeriodStart: new Date("2025-06-20"),
      billingPeriodEnd: new Date("2025-07-20"),
      totalEnergyGenerated: 520,
      paymentStatus: "PENDING",
    });

    console.log("✅ Database seeded successfully");
    console.log("Solar Units created:");
    console.log(`  - ${solarUnit1.serialNumber} (Capacity: ${solarUnit1.capacity}W)`);
    console.log(`  - ${solarUnit2.serialNumber} (Capacity: ${solarUnit2.capacity}W)`);
    console.log(`  - ${solarUnit3.serialNumber} (Capacity: ${solarUnit3.capacity}W)`);
    console.log(`\nInvoices created: ${[invoice1, invoice2, invoice3].length}`);

  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();