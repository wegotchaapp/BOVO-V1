import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

/**
 * Reshapes NestJS error responses into the `{ error: "<message>" }` envelope the
 * Bovogo mobile client reads (`apiClient` surfaces `data.error`). Scoped to the
 * mobile-api controllers only — the platform's default error shape is unchanged.
 */
@Catch()
export class MobileHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const m = (body as Record<string, unknown>).message;
        if (Array.isArray(m) && m.length > 0) message = String(m[0]);
        else if (typeof m === 'string') message = m;
        else if (typeof (body as Record<string, unknown>).error === 'string')
          message = String((body as Record<string, unknown>).error);
      }
    }

    res.status(status).json({ error: message });
  }
}
