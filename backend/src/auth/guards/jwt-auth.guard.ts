import {
  ForbiddenException,
  Injectable,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { enforceModulePermission } from '../../common/guards/module-permission.guard';

export function assertTenantContext(req: {
  user?: { companyId?: string };
  headers?: Record<string, string | string[] | undefined>;
}) {
  const raw = req.headers?.['x-company-id'];
  const requested = Array.isArray(raw) ? raw[0] : raw;
  if (requested && req.user?.companyId && requested !== req.user.companyId) {
    throw new ForbiddenException(
      'Tenant header does not match authenticated company',
    );
  }
}

/**
 * JWT Bearer auth, or API key pre-authenticated by middleware (x-api-key / Bearer qk_...).
 * Also blocks VIEWER role from mutating methods (complements DenyViewerMutationsGuard,
 * which only sees req.user when set before controller JwtAuthGuard).
 * Wave BO: post-grace 2FA lock lives in Past2faGraceInterceptor (runs after JWT).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{
      apiKeyAuthenticated?: boolean;
      user?: { companyId?: string; role?: string };
      method?: string;
    }>();
    if (req.apiKeyAuthenticated && req.user?.companyId) {
      this.assertViewerNotMutating(req);
      this.assertTenantHeader(req);
      enforceModulePermission(context, this.reflector);
      return true;
    }
    const result = super.canActivate(context);
    const after = (ok: boolean) => {
      if (ok) {
        const authenticatedRequest = context.switchToHttp().getRequest<{
          method?: string;
          user?: { role?: string; companyId?: string };
          headers?: Record<string, string | string[] | undefined>;
        }>();
        this.assertViewerNotMutating(authenticatedRequest);
        this.assertTenantHeader(authenticatedRequest);
        enforceModulePermission(context, this.reflector);
      }
      return ok;
    };
    if (result instanceof Observable) {
      return result.pipe(map((ok) => after(!!ok)));
    }
    return Promise.resolve(result as boolean | Promise<boolean>).then((ok) =>
      after(!!ok),
    );
  }

  private assertTenantHeader(req: {
    user?: { companyId?: string };
    headers?: Record<string, string | string[] | undefined>;
  }) {
    assertTenantContext(req);
  }

  private assertViewerNotMutating(req: {
    method?: string;
    user?: { role?: string };
  }) {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return;
    }
    if (req.user?.role === 'VIEWER') {
      throw new ForbiddenException('Viewers have read-only access');
    }
  }
}
