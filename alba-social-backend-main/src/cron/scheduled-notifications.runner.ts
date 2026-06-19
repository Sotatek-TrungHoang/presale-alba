import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { initSentry } from '../shared/sentry.config';
import { CronModule } from './cron.module';
import { ScheduledNotificationsService } from './scheduled-notifications.service';

// Mirror main.ts: initialise Sentry before anything else so job failures are
// captured.
initSentry();

/**
 * Standalone entrypoint for scheduled notification jobs. Designed to be run as
 * a Railway cron service: Railway runs this command on a schedule, the process
 * does its work and then exits (0 on success, 1 on failure).
 *
 * Usage:
 *   node dist/cron/scheduled-notifications.runner.js <job-name>
 *
 * The job name can also be supplied via the CRON_JOB env var, which is handy
 * when a Railway service has a fixed start command but a configurable env. A
 * job name is required: if none is given the process exits non-zero without
 * running anything, so a misconfigured cron service fails loudly.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('CronRunner');
  const jobName = process.argv[2] || process.env.CRON_JOB;

  if (!jobName) {
    logger.error(
      'No job name provided. Pass it as an argument or set CRON_JOB. ' +
        'Example: node dist/cron/scheduled-notifications.runner.js games-nearby-weekly',
    );
    process.exitCode = 1;
    return;
  }

  // createApplicationContext boots the DI container without starting an HTTP
  // server — exactly what a one-shot cron process needs.
  const app = await NestFactory.createApplicationContext(CronModule, {
    // Keep cron logs focused; bump this up if you need to debug wiring.
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(ScheduledNotificationsService);
    await service.runJob(jobName);
    process.exitCode = 0;
  } catch (error) {
    logger.error(
      `Cron job "${jobName}" failed`,
      error instanceof Error ? error.stack : String(error),
    );
    Sentry.captureException(error);
    process.exitCode = 1;
  } finally {
    await app.close();
    // Give Sentry a moment to flush buffered events before the process exits.
    await Sentry.flush(2000).catch(() => undefined);
  }
}

bootstrap().catch((error) => {
  // Catch failures from bootstrapping itself (e.g. DI/connection errors).
  // eslint-disable-next-line no-console
  console.error('Fatal error in cron runner:', error);
  Sentry.captureException(error);
  process.exit(1);
});
