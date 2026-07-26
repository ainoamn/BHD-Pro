import {
  ForbiddenException,
  Injectable,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * JWT Bearer auth, or API key pre-authenticated by middleware (x-api-key / Bearer qk_...).
 * Also blocks VIEWER role from mutating methods (complements DenyViewerMutationsGuard,
 * which only sees req.user when set before controller JwtAuthGuard).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{
      apiKeyAuthenticated?: boolean;
      user?: { companyId?: string; role?: string };
      method?: string;
    }>();
    if (req.apiKeyAuthenticated && req.user?.companyId) {
      this.assertViewerNotMutating(req);
      return true;
    }
    const result = super.canActivate(context);
    const after = (ok: boolean) => {
      if (ok) {
        this.assertViewerNotMutating(
          context.switchToHttp().getRequest<{
            method?: string;
            user?: { role?: string };
          }>(),
        );
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
