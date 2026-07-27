import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  companyRequires2faForAdmins,
  computeTwoFactorGrace,
  envRequires2faForRole,
  isHard2faAfterGraceEnabled,
  isTwoFactorSetupExemptPath,
  parseRequire2faGraceDays,
  resolveTwoFactorGraceStart,
} from '../../auth/two-factor-policy';

/**
 * After JWT auth: block mutating requests when 2FA grace has ended.
 * Soft mode: REQUIRE_2FA_HARD_AFTER_GRACE=off.
 */
@Injectable()
export class Past2faGraceInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      path?: string;
      user?: { sub?: string };
    }>();
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next.handle();
    }

    const hardRaw =
      this.config.get<string>('REQUIRE_2FA_HARD_AFTER_GRACE') ||
      process.env.REQUIRE_2FA_HARD_AFTER_GRACE;
    if (!isHard2faAfterGraceEnabled(hardRaw)) {
      return next.handle();
    }

    const userId = req.user?.sub;
    if (!userId || userId.startsWith('api-key:')) {
      return next.handle();
    }

    const path = req.originalUrl || req.url || req.path || '';
    if (isTwoFactorSetupExemptPath(path)) {
      return next.handle();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        companyId: true,
        createdAt: true,
        twoFactorEnabled: true,
        company: { select: { securityConfig: true } },
      },
    });
    if (!user || user.twoFactorEnabled) {
      return next.handle();
    }

    const rolesRaw =
      this.config.get<string>('REQUIRE_2FA_ROLES') ||
      process.env.REQUIRE_2FA_ROLES ||
      'ADMIN,MANAGER';
    const required =
      envRequires2faForRole(user.role, rolesRaw) ||
      companyRequires2faForAdmins(user.role, user.company?.securityConfig);
    if (!required) {
      return next.handle();
    }

    const graceDays = parseRequire2faGraceDays(
      this.config.get<string>('REQUIRE_2FA_GRACE_DAYS') ||
        process.env.REQUIRE_2FA_GRACE_DAYS,
    );
    const graceStart = resolveTwoFactorGraceStart(
      this.config.get<string>('REQUIRE_2FA_GRACE_FROM') ||
        process.env.REQUIRE_2FA_GRACE_FROM,
      user.createdAt,
    );
    const grace = computeTwoFactorGrace(true, false, graceDays, graceStart);
    if (!grace.pastGrace) {
      return next.handle();
    }

    throw new ForbiddenException(
      'Two-factor authentication grace period ended — enable 2FA in settings to continue',
    );
  }
}
