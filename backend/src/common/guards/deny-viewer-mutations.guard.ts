import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/** Blocks VIEWER role from mutating HTTP methods (POST/PUT/PATCH/DELETE). */
@Injectable()
export class DenyViewerMutationsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      user?: { role?: string };
    }>();
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }
    if (req.user?.role === 'VIEWER') {
      throw new ForbiddenException('Viewers have read-only access');
    }
    return true;
  }
}
