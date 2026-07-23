import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

export function getPlatformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(email?: string | null): boolean {
  const allow = getPlatformAdminEmails();
  if (!allow.length || !email) return false;
  return allow.includes(email.toLowerCase());
}

export function assertPlatformAdminEmail(email?: string | null): void {
  const allow = getPlatformAdminEmails();
  if (!allow.length) {
    throw new ForbiddenException(
      'Platform admin is disabled. Set PLATFORM_ADMIN_EMAILS to enable.',
    );
  }
  if (!email || !allow.includes(email.toLowerCase())) {
    throw new ForbiddenException('Not a platform administrator');
  }
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    assertPlatformAdminEmail(req.user?.email);
    return true;
  }
}
