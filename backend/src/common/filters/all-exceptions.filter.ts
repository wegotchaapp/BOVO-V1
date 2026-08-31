import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';
    const message = this.messageFrom(exceptionResponse);

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(process.env.NODE_ENV !== 'production' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    };

    this.logger.error(
      {
        error: exception,
        status,
        path: request.url,
        method: request.method,
      },
      'Request failed',
    );

    response.status(status).json(errorResponse);
  }

  private messageFrom(response: string | object): string | string[] {
    if (typeof response === 'string') return response;
    if (
      'message' in response &&
      (typeof response.message === 'string' || Array.isArray(response.message))
    ) {
      return response.message;
    }
    return 'Internal server error';
  }
}
