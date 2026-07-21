import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Bearer auth, or API key pre-authenticated by middleware (x-api-key / Bearer qk_...).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{
      apiKeyAuthenticated?: boolean;
      user?: { companyId?: string };
    }>();
    if (req.apiKeyAuthenticated && req.user?.companyId) {
      return true;
    }
    return super.canActivate(context);
  }
}
