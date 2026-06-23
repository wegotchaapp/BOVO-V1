import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PinoLogger } from 'nestjs-pino';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: PinoLogger,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.auditService.log({
            actor_id: request.user?.sub || undefined,
            entity_type: this.extractEntityType(request.url),
            entity_id: this.extractEntityId(request.url) || undefined,
            event_type: `${method}_${this.extractResourceName(request.url)}`,
            payload: {
              method,
              url: request.url,
              statusCode: context.switchToHttp().getResponse().statusCode,
              duration_ms: Date.now() - startTime,
            },
            ip_address: request.ip,
            user_agent: request.headers['user-agent'],
          }).catch((err) => {
            this.logger.warn({ err }, 'Failed to write audit log');
          });
        },
        error: (error) => {
          this.auditService.log({
            actor_id: request.user?.sub || undefined,
            entity_type: this.extractEntityType(request.url),
            entity_id: this.extractEntityId(request.url) || undefined,
            event_type: `${method}_${this.extractResourceName(request.url)}_error`,
            payload: {
              method,
              url: request.url,
              error: error.message,
              duration_ms: Date.now() - startTime,
            },
            ip_address: request.ip,
            user_agent: request.headers['user-agent'],
          }).catch((err) => {
            this.logger.warn({ err }, 'Failed to write audit log');
          });
        },
      }),
    );
  }

  private extractEntityType(url: string): string {
    const parts = url.split('/').filter(Boolean);
    return parts[0] || 'unknown';
  }

  private extractResourceName(url: string): string {
    const parts = url.split('/').filter(Boolean);
    return parts[0] || 'unknown';
  }

  private extractEntityId(url: string): string | null {
    const parts = url.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[1].match(/^[0-9a-f-]{36}$/i)) {
      return parts[1];
    }
    return null;
  }
}
