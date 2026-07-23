import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/** Bootstrap operators — always allowed, plus any emails in PLATFORM_ADMIN_EMAILS */
const DEFAULT_PLATFORM_ADMINS = ['admin@bhd.om'];

export function getPlatformAdminEmails(): string[] {
  const fromEnv = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_PLATFORM_ADMINS, ...fromEnv]));
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
