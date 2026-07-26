import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  accessForHttpMethod,
  canAccessModule,
  ModuleKey,
  ModulePermissions,
} from '../module-permissions';
import {
  MODULE_ACCESS_KEY,
  ModuleAccessMeta,
} from '../decorators/require-module-access.decorator';

/** First match wins — put specific paths before broad ones. */
const PATH_MODULE_MAP: { re: RegExp; module: ModuleKey }[] = [
  { re: /\/pos\/shifts/, module: 'posShifts' },
  { re: /\/pos\/(inventory|favorites|incentives)/, module: 'posInventory' },
  { re: /\/pos(\/|$|\?)/, module: 'posSales' },
  { re: /\/resto\/kitchen/, module: 'kitchen' },
  { re: /\/resto\/expo/, module: 'expo' },
  { re: /\/resto\/(menu|recipes|modifiers|stations)/, module: 'restoMenu' },
  { re: /\/resto\/(reservations|waitlist)/, module: 'restoReservations' },
  { re: /\/resto\/reports/, module: 'restoReports' },
  { re: /\/resto\/shifts/, module: 'posShifts' },
  { re: /\/resto\/(config|staff|sections|link)/, module: 'settings' },
  { re: /\/resto(\/|$|\?)/, module: 'floor' },
  { re: /\/users(\/|$|\?)/, module: 'users' },
  { re: /\/reports(\/|$|\?)/, module: 'reports' },
];

function moduleForPath(url: string): ModuleKey | null {
  for (const row of PATH_MODULE_MAP) {
    if (row.re.test(url)) return row.module;
  }
  return null;
}

@Injectable()
export class ModulePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = req.user?.role as string | undefined;
    if (!req.user || role === 'ADMIN') return true;

    const meta = this.reflector.getAllAndOverride<ModuleAccessMeta>(
      MODULE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const path = String(req.originalUrl || req.url || '');
    const module = meta?.module || moduleForPath(path);
    if (!module) return true;

    const needed = meta?.level || accessForHttpMethod(req.method || 'GET');
    const permissions = req.user?.modulePermissions as
      | ModulePermissions
      | undefined;

    if (!canAccessModule(permissions, module, needed)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'MODULE_ACCESS_DENIED',
        module,
        required: needed,
        message:
          needed === 'edit'
            ? 'You can view this area but cannot make changes. Ask your company admin.'
            : 'This area is hidden for your account. Ask your company admin for access.',
      });
    }
    return true;
  }
}
