import cron from 'node-cron';
import { syncEnergyGenerationRecords } from '../application/background/sync-energy-generation-records';
import { runAnomalyDetection } from '../application/background/detect-anomalies';
import { generateInvoices } from '../application/background/generate-invoices';

export const initializeScheduler = () => {
  // Run daily at 00:00 (midnight) - cron expression: '0 0 * * *'
  const schedule = process.env.SYNC_CRON_SCHEDULE || '0 0 * * *';

  cron.schedule(schedule, async () => {
    console.log(`[${new Date().toISOString()}] Starting daily energy generation records sync...`);
    try {
      await syncEnergyGenerationRecords();
      console.log(`[${new Date().toISOString()}] Daily sync completed successfully`);
      
      // Run anomaly detection after syncing data
      console.log(`[${new Date().toISOString()}] Starting anomaly detection...`);
      await runAnomalyDetection();
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Daily sync failed:`, error);
    }
  });

  // Run monthly on the 1st day at 00:00 - cron expression: '0 0 1 * *'
  const invoiceSchedule = process.env.INVOICE_CRON_SCHEDULE || '0 0 1 * *';

  cron.schedule(invoiceSchedule, async () => {
    console.log(`[${new Date().toISOString()}] Starting monthly invoice generation...`);
    try {
      await generateInvoices();
      console.log(`[${new Date().toISOString()}] Monthly invoice generation completed successfully`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Monthly invoice generation failed:`, error);
    }
  });

  console.log(`[Scheduler] Energy generation records sync scheduled for: ${schedule}`);
  console.log(`[Scheduler] Invoice generation scheduled for: ${invoiceSchedule}`);
};