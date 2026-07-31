import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TokenPayload } from '../interfaces/token-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESS_COOKIE } from '../auth-cookies';
import { resolveModulePermissions } from '../../common/module-permissions';

function cookieExtractor(req: Request): string | null {
  if (req?.cookies?.[ACCESS_COOKIE]) {
    return req.cookies[ACCESS_COOKIE];
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly authCache = new Map<
    string,
    { expires: number; payload: TokenPayload }
  >();
  private readonly authInFlight = new Map<string, Promise<TokenPayload>>();
  private static readonly AUTH_CACHE_TTL_MS = 30_000;

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret'),
    });
  }

  async validate(payload: TokenPayload) {
    if (!payload.sub || !payload.companyId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.sub.startsWith('api-key:') || payload.email?.startsWith('api-key@')) {
      return payload;
    }

    const cached = this.authCache.get(payload.sub);
    if (cached && cached.expires > Date.now()) {
      return cached.payload;
    }
    if (cached) {
      this.authCache.delete(payload.sub);
    }

    const inFlight = this.authInFlight.get(payload.sub);
    if (inFlight) {
      return inFlight;
    }

    const validation = this.loadUser(payload.sub).finally(() => {
      this.authInFlight.delete(payload.sub);
    });
    this.authInFlight.set(payload.sub, validation);
    return validation;
  }

  private async loadUser(userId: string): Promise<TokenPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        isActive: true,
        permissions: true,
        company: { select: { isActive: true } },
      },
    });

    if (!user || !user.isActive || !user.company?.isActive) {
      throw new UnauthorizedException('User inactive or not found');
    }

    const validated = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      modulePermissions: resolveModulePermissions(user.role, user.permissions),
    } satisfies TokenPayload;

    if (this.authCache.size >= 5000) {
      const oldest = this.authCache.keys().next().value;
      if (oldest) this.authCache.delete(oldest);
    }
    this.authCache.set(userId, {
      expires: Date.now() + JwtStrategy.AUTH_CACHE_TTL_MS,
      payload: validated,
    });
    return validated;
  }
}
