import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Platform operators for `/admin` gateways.
 * Production: ONLY emails listed in PLATFORM_ADMIN_EMAILS (comma-separated).
 * Non-production: also allows bootstrap admin@bhd.om for local/dev.
 */
export function getPlatformAdminEmails(): string[] {
  const fromEnv = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    return Array.from(new Set(fromEnv));
  }

  return Array.from(new Set(['admin@bhd.om', ...fromEnv]));
}

export function isPlatformAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getPlatformAdminEmails().includes(email.toLowerCase());
}

export function assertPlatformAdminEmail(email?: string | null): void {
  if (!isPlatformAdminEmail(email)) {
    throw new ForbiddenException(
      'Not a platform administrator. Add your email to PLATFORM_ADMIN_EMAILS on the API host.',
    );
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
