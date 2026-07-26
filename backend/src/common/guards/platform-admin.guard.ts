import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Bootstrap operators always allowed, plus PLATFORM_ADMIN_EMAILS,
 * plus active rows in platform_operators (managed in /admin/operators).
 */
const DEFAULT_PLATFORM_ADMINS = [
  'admin@bhd.om',
  'admin@hisaby.pro',
  'ammar89555200@gmail.com',
];

export const PLATFORM_PERMISSIONS = [
  'full',
  'overview',
  'tenants',
  'users',
  'billing',
  'plans',
  'visits',
  'gateways',
  'operators',
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export function getEnvPlatformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getBootstrapAdminEmails(): string[] {
  return Array.from(
    new Set([...DEFAULT_PLATFORM_ADMINS, ...getEnvPlatformAdminEmails()]),
  );
}

export function isBootstrapAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getBootstrapAdminEmails().includes(email.toLowerCase());
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const email = (req.user?.email as string | undefined)?.toLowerCase();
    if (!email) {
      throw new ForbiddenException('Not a platform administrator.');
    }
    if (isBootstrapAdminEmail(email)) return true;

    const op = await this.prisma.platformOperator.findUnique({
      where: { email },
    });
    if (op?.isActive) return true;

    throw new ForbiddenException(
      'Not a platform administrator. Appoint this email from /admin/operators.',
    );
  }
}

/** Sync check for bootstrap/env only — prefer AdminService.isPlatformAdmin for full check. */
export function isPlatformAdminEmail(email?: string | null): boolean {
  return isBootstrapAdminEmail(email);
}

export function assertPlatformAdminEmail(email?: string | null): void {
  if (!isBootstrapAdminEmail(email)) {
    throw new ForbiddenException(
      'Not a platform administrator. Appoint this email from /admin/operators.',
    );
  }
}
