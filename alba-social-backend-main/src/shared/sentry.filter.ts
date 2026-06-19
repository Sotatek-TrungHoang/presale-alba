import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('SentryExceptionFilter');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let responseBody: any = {
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = (exceptionResponse as any).message || exception.message;
      responseBody = {
        statusCode: status,
        ...(typeof exceptionResponse === 'object' ? exceptionResponse : { message }),
        timestamp: new Date().toISOString(),
      };
    } else if (exception instanceof Error) {
      message = exception.message;
      responseBody.message = message;
    }

    // Capture non-HttpException errors in Sentry
    if (!(exception instanceof HttpException)) {
      Sentry.captureException(exception, {
        tags: {
          type: 'unhandled_exception',
        },
        contexts: {
          http: {
            method: request.method,
            url: request.url,
            statusCode: status,
          },
        },
      });

      this.logger.error(
        `Unhandled Exception: ${message}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    } else if (status >= 500) {
      // Also capture 5xx HTTP exceptions
      Sentry.captureException(exception, {
        tags: {
          type: 'http_exception',
          statusCode: status.toString(),
        },
        contexts: {
          http: {
            method: request.method,
            url: request.url,
            statusCode: status,
          },
        },
      });

      this.logger.error(
        `HTTP Exception (${status}): ${message}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, status);
  }
}
