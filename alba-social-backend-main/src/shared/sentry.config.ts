import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export const initSentry = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const sentryDsn = process.env.SENTRY_DSN;

  if (!sentryDsn) {
    console.warn('⚠️ Sentry DSN not configured. Exception tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    profilesSampleRate: isProduction ? 0.1 : 1.0,
    enabled: isProduction || process.env.SENTRY_DEBUG === 'true',
    beforeSend(event, hint) {
      // Filter out certain errors if needed
      if (event.exception) {
        const error = hint.originalException;
        // Don't send 4xx errors from the exception filter
        if (error instanceof Error && error.message.includes('4')) {
          return null;
        }
      }
      return event;
    },
  });

  console.log('✓ Sentry initialized successfully');
};

export default Sentry;
