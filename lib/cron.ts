import cron from 'node-cron';
import { pinoLogger } from './pino-logger';

export function initCronJobs() {
  pinoLogger.info('Initializing background cron jobs...');

  // Example task: Runs every hour
  cron.schedule('0 * * * *', () => {
    pinoLogger.info('Cron Job [Hourly]: Running system health checks & log cleanup...');
  });

  // Example task: Runs every midnight (00:00)
  cron.schedule('0 0 * * *', () => {
    pinoLogger.info('Cron Job [Daily]: Running database optimization & backup hooks...');
  });

  pinoLogger.info('Background cron jobs registered successfully.');
}
