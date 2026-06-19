import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

const logger = new Logger('Notifications');

/**
 * Reports a failure from a fire-and-forget notification send path.
 * Logs locally and captures to Sentry so the delivery gap is visible.
 */
export function reportNotificationFailure(
  context: string,
  error: unknown,
): void {
  logger.error(
    `${context}: ${error instanceof Error ? error.message : String(error)}`,
    error instanceof Error ? error.stack : undefined,
  );
  Sentry.captureException(error, {
    tags: { feature: 'notifications' },
    extra: { context },
  });
}
