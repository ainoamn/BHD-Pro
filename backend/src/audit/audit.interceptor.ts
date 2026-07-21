import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      method: string;
      url: string;
      originalUrl?: string;
      params: Record<string, string>;
      body: unknown;
      user?: { sub?: string; companyId?: string };
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    }>();

    const method = (req.method || '').toUpperCase();
    if (!WRITE_METHODS.has(method)) {
      return next.handle();
    }

    const path = (req.originalUrl || req.url || '').split('?')[0];
    // Skip health / auth noise
    if (
      path.includes('/health') ||
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/refresh')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const companyId = req.user?.companyId;
          if (!companyId) return;

          const entity = this.entityFromPath(path);
          const action = this.actionFromMethod(method, path);
          const entityId =
            req.params?.id ||
            req.params?.lineId ||
            (data && typeof data === 'object' && 'id' in data
              ? String((data as { id: unknown }).id)
              : null);

          const ua = req.headers['user-agent'];
          void this.audit.log({
            companyId,
            userId: req.user?.sub,
            action,
            entity,
            entityId,
            newValues: this.safeBody(req.body, data),
            ipAddress: req.ip || null,
            userAgent: Array.isArray(ua) ? ua[0] : ua || null,
          });
        },
      }),
    );
  }

  private entityFromPath(path: string): string {
    const clean = path.replace(/^\/api\/?/, '').replace(/^\//, '');
    const segment = clean.split('/').filter(Boolean)[0] || 'unknown';
    return segment;
  }

  private actionFromMethod(method: string, path: string): string {
    const lower = path.toLowerCase();
    if (lower.includes('lock') && !lower.includes('unlock')) return 'LOCK';
    if (lower.includes('unlock')) return 'UNLOCK';
    if (lower.includes('toggle')) return 'TOGGLE';
    if (lower.includes('adjust')) return 'ADJUST';
    if (lower.includes('depreciate')) return 'DEPRECIATE';
    if (lower.includes('payment')) return 'PAYMENT';
    if (lower.includes('send')) return 'SEND';
    if (method === 'POST') return 'CREATE';
    if (method === 'PUT' || method === 'PATCH') return 'UPDATE';
    if (method === 'DELETE') return 'DELETE';
    return method;
  }

  private safeBody(body: unknown, result: unknown) {
    const strip = (obj: unknown) => {
      if (!obj || typeof obj !== 'object') return obj;
      const clone = { ...(obj as Record<string, unknown>) };
      for (const key of Object.keys(clone)) {
        if (/password|secret|token|cvv|pin/i.test(key)) {
          clone[key] = '[redacted]';
        }
      }
      return clone;
    };
    return {
      request: strip(body),
      result:
        result && typeof result === 'object'
          ? {
              id: (result as { id?: string }).id,
              number: (result as { number?: string }).number,
              message: (result as { message?: string }).message,
            }
          : undefined,
    };
  }
}
