import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TokenPayload } from '../interfaces/token-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESS_COOKIE } from '../auth-cookies';

function cookieExtractor(req: Request): string | null {
  if (req?.cookies?.[ACCESS_COOKIE]) {
    return req.cookies[ACCESS_COOKIE];
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        isActive: true,
        company: { select: { isActive: true } },
      },
    });

    if (!user || !user.isActive || !user.company?.isActive) {
      throw new UnauthorizedException('User inactive or not found');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    } satisfies TokenPayload;
  }
}
