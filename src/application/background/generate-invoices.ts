import { Invoice } from "../../infrastructure/entities/Invoice";
import { SolarUnit } from "../../infrastructure/entities/SolarUnit";
import { EnergyGenerationRecord } from "../../infrastructure/entities/EnergyGenerationRecord";
import { User } from "../../infrastructure/entities/User";

/**
 * Generates invoices for all active solar units
 * Creates monthly invoices based on installation date
 * Only creates invoices for billing periods that haven't been invoiced yet
 */
export const generateInvoices = async () => {
  try {
    console.log(`[${new Date().toISOString()}] Starting invoice generation...`);

    // Get all active solar units
    const activeSolarUnits = await SolarUnit.find({ status: "ACTIVE" });

    for (const solarUnit of activeSolarUnits) {
      if (!solarUnit.userId) {
        console.log(`Skipping solar unit ${solarUnit._id} - no user assigned`);
        continue;
      }

      // Get user to verify they exist
      const user = await User.findById(solarUnit.userId);
      if (!user) {
        console.log(`Skipping solar unit ${solarUnit._id} - user not found`);
        continue;
      }

      // Calculate billing periods from installation date
      const installationDate = new Date(solarUnit.installationDate);
      const now = new Date();
      
      // Start from the month after installation
      let currentPeriodStart = new Date(
        installationDate.getFullYear(),
        installationDate.getMonth() + 1,
        1
      );

      // Generate invoices for each month up to the previous month
      // (Don't invoice the current month until it's complete)
      while (currentPeriodStart < now) {
        const currentPeriodEnd = new Date(
          currentPeriodStart.getFullYear(),
          currentPeriodStart.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );

        // Check if invoice already exists for this period
        const existingInvoice = await Invoice.findOne({
          solarUnitId: solarUnit._id,
          billingPeriodStart: currentPeriodStart,
          billingPeriodEnd: currentPeriodEnd,
        });

        if (existingInvoice) {
          console.log(
            `Invoice already exists for solar unit ${solarUnit._id} for period ${currentPeriodStart.toISOString()} - ${currentPeriodEnd.toISOString()}`
          );
          // Move to next month
          currentPeriodStart = new Date(
            currentPeriodStart.getFullYear(),
            currentPeriodStart.getMonth() + 1,
            1
          );
          continue;
        }

        // Sum energy generation records for this billing period
        const energyRecords = await EnergyGenerationRecord.find({
          solarUnitId: solarUnit._id,
          timestamp: {
            $gte: currentPeriodStart,
            $lte: currentPeriodEnd,
          },
        });

        const totalEnergyGenerated = energyRecords.reduce(
          (sum, record) => sum + record.energyGenerated,
          0
        );

        // Only create invoice if there's energy generated
        if (totalEnergyGenerated > 0) {
          await Invoice.create({
            solarUnitId: solarUnit._id,
            userId: solarUnit.userId,
            billingPeriodStart: currentPeriodStart,
            billingPeriodEnd: currentPeriodEnd,
            totalEnergyGenerated: Math.round(totalEnergyGenerated * 100) / 100, // Round to 2 decimal places
            paymentStatus: "PENDING",
          });

          console.log(
            `Created invoice for solar unit ${solarUnit._id} for period ${currentPeriodStart.toISOString()} - ${currentPeriodEnd.toISOString()} with ${totalEnergyGenerated} kWh`
          );
        } else {
          console.log(
            `No energy generated for solar unit ${solarUnit._id} in period ${currentPeriodStart.toISOString()} - ${currentPeriodEnd.toISOString()}, skipping invoice`
          );
        }

        // Move to next month
        currentPeriodStart = new Date(
          currentPeriodStart.getFullYear(),
          currentPeriodStart.getMonth() + 1,
          1
        );
      }
    }

    console.log(`[${new Date().toISOString()}] Invoice generation completed successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Invoice generation failed:`, error);
    throw error;
  }
};

