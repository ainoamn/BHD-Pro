import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

const DEVELOPMENT_PLATFORM_ADMINS = ['admin@bhd.om', 'admin@hisaby.pro'];

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

const PATH_PERMISSIONS: { match: RegExp; perm: PlatformPermission }[] = [
  { match: /\/admin\/operators(\/|$)/, perm: 'operators' },
  { match: /\/admin\/tenants(\/|$)/, perm: 'tenants' },
  { match: /\/admin\/users(\/|$)/, perm: 'users' },
  { match: /\/admin\/billing(\/|$)/, perm: 'billing' },
  { match: /\/admin\/offers(\/|$)/, perm: 'plans' },
  { match: /\/admin\/plans(\/|$)/, perm: 'plans' },
  { match: /\/admin\/visits(\/|$)/, perm: 'visits' },
  { match: /\/admin\/sessions(\/|$)/, perm: 'visits' },
  { match: /\/admin\/payment-gateways(\/|$)/, perm: 'gateways' },
  { match: /\/admin\/gateways(\/|$)/, perm: 'gateways' },
  { match: /\/admin\/overview(\/|$)/, perm: 'overview' },
  { match: /\/admin\/settings(\/|$)/, perm: 'overview' },
];

export function getEnvPlatformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getPlatformOwnerEmail(): string | null {
  const configured = (process.env.PLATFORM_OWNER_EMAIL || '')
    .trim()
    .toLowerCase();
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? null : 'admin@hisaby.pro';
}

export function getBootstrapAdminEmails(): string[] {
  const development =
    process.env.NODE_ENV === 'production' ? [] : DEVELOPMENT_PLATFORM_ADMINS;
  const owner = getPlatformOwnerEmail();
  return Array.from(
    new Set([
      ...development,
      ...getEnvPlatformAdminEmails(),
      ...(owner ? [owner] : []),
    ]),
  );
}

export function isBootstrapAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getBootstrapAdminEmails().includes(email.toLowerCase());
}

export function isProtectedPlatformAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const owner = getPlatformOwnerEmail();
  return !!owner && owner === email.toLowerCase();
}

export function operatorHasPermission(
  permissions: string[] | undefined,
  needed?: PlatformPermission[],
): boolean {
  if (!needed?.length) return true;
  const perms = permissions || [];
  if (perms.includes('full')) return true;
  return needed.some((p) => perms.includes(p));
}

function permissionForPath(url: string): PlatformPermission | null {
  for (const row of PATH_PERMISSIONS) {
    if (row.match.test(url)) return row.perm;
  }
  return null;
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const email = (req.user?.email as string | undefined)?.toLowerCase();
    if (!email) {
      throw new ForbiddenException('Not a platform administrator.');
    }

    let permissions: PlatformPermission[] = [];
    let allowed = false;

    // Primary owner always has full active access (cannot be locked out via DB row)
    if (isProtectedPlatformAdminEmail(email)) {
      allowed = true;
      permissions = ['full'];
    } else {
      const op = await this.prisma.platformOperator.findUnique({
        where: { email },
      });

      if (op) {
        if (op.isActive) {
          allowed = true;
          permissions = ((op.permissions as string[]) || []) as PlatformPermission[];
          if (!permissions.length) permissions = ['full'];
        }
      } else if (isBootstrapAdminEmail(email)) {
        allowed = true;
        permissions = ['full'];
      }
    }

    if (!allowed) {
      throw new ForbiddenException(
        'Not a platform administrator. Appoint this email from /admin/operators.',
      );
    }

    req.platformPermissions = permissions;

    const fromMeta = this.reflector.getAllAndOverride<PlatformPermission[]>(
      'platformPerms',
      [context.getHandler(), context.getClass()],
    );
    const path = String(req.originalUrl || req.url || '');
    const fromPath = permissionForPath(path);
    const needed = fromMeta?.length
      ? fromMeta
      : fromPath
        ? [fromPath]
        : undefined;

    if (!operatorHasPermission(permissions, needed)) {
      throw new ForbiddenException(
        'Insufficient platform operator permissions for this action.',
      );
    }

    return true;
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
