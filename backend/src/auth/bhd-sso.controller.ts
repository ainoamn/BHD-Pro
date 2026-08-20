import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import {
  BHD_OAUTH_STATE_COOKIE,
  BhdSsoService,
} from './bhd-sso.service';
import { clearAuthCookies, setAuthCookies } from './auth-cookies';
import { AuthService } from './auth.service';

@ApiTags('Auth / BHD Identity')
@Controller('auth')
export class BhdSsoController {
  private readonly logger = new Logger(BhdSsoController.name);

  constructor(
    private readonly bhdSso: BhdSsoService,
    private readonly authService: AuthService,
  ) {}

  private requestOrigin(req: Request): string {
    const xfProto = (req.headers['x-forwarded-proto'] as string) || '';
    const xfHost = (req.headers['x-forwarded-host'] as string) || '';
    if (xfHost) {
      const proto = (xfProto.split(',')[0] || 'https').trim();
      return `${proto}://${xfHost.split(',')[0].trim()}`;
    }
    const frontend = this.bhdSso.frontendOrigin();
    if (frontend) return frontend;
    return `${req.protocol}://${req.get('host')}`;
  }

  @Get('bhd/start')
  @SkipThrottle()
  @ApiOperation({ summary: 'Begin BHD Identity SSO (302 → id.bhd-om.com)' })
  start(
    @Query('returnTo') returnTo: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const origin = this.requestOrigin(req);
    const { authorizeUrl, stateCookieValue } = this.bhdSso.buildStart(
      returnTo,
      origin,
    );
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(BHD_OAUTH_STATE_COOKIE, stateCookieValue, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60 * 1000,
    });
    return res.redirect(302, authorizeUrl);
  }

  @Get('bhd/callback')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'BHD Identity OAuth callback' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const origin = this.requestOrigin(req);
    const fail = (path = '/login?bhd=error') => {
      res.clearCookie(BHD_OAUTH_STATE_COOKIE, { path: '/' });
      return res.redirect(302, `${origin}${path}`);
    };

    if (error) {
      this.logger.warn(`BHD callback error: ${error}`);
      return fail(`/login?bhd=denied`);
    }

    const raw = req.cookies?.[BHD_OAUTH_STATE_COOKIE] as string | undefined;
    const saved = this.bhdSso.parseStateCookie(raw);
    res.clearCookie(BHD_OAUTH_STATE_COOKIE, { path: '/' });
    // Clear any previous product session before establishing the new one (§0.7)
    clearAuthCookies(res);

    if (!saved || !code || !state) {
      return fail();
    }

    try {
      const { tokens, returnTo } = await this.bhdSso.exchangeAndLogin(
        code,
        state,
        saved,
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      );
      setAuthCookies(res, tokens);
      const dest = returnTo.startsWith('/') ? returnTo : '/dashboard';
      return res.redirect(302, `${origin}${dest}`);
    } catch (err: unknown) {
      this.logger.warn(
        `BHD callback failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (err instanceof ForbiddenException) {
        const body = err.getResponse();
        const code =
          typeof body === 'object' && body && 'code' in body
            ? String((body as { code: string }).code)
            : '';
        if (code === 'BHD_NO_LOCAL_USER') {
          return fail('/login?bhd=no_user');
        }
      }
      return fail();
    }
  }

  @Get('bhd/logout')
  @SkipThrottle()
  @ApiOperation({ summary: 'Clear Hisaby session then BHD end-session' })
  async logout(@Req() req: Request, @Res() res: Response) {
    const user = (req as Request & { user?: { sub?: string } }).user;
    if (user?.sub) {
      try {
        await this.authService.logout(user.sub);
      } catch {
        /* ignore */
      }
    }
    clearAuthCookies(res);
    res.clearCookie(BHD_OAUTH_STATE_COOKIE, { path: '/' });
    const origin = this.requestOrigin(req);
    return res.redirect(302, this.bhdSso.endSessionUrl(`${origin}/`));
  }

  @Get('admin-entry')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Platform /admin entry via BHD SSO (never local password)',
  })
  adminEntry(
    @Query('next') next: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const origin = this.requestOrigin(req);
    let returnTo = '/admin';
    const raw = (next || '').trim();
    if (
      raw.startsWith('/') &&
      !raw.startsWith('//') &&
      !raw.includes('://') &&
      !raw.includes('\\')
    ) {
      returnTo = raw;
    }
    return res.redirect(
      302,
      `${origin}/api/auth/bhd/start?returnTo=${encodeURIComponent(returnTo)}`,
    );
  }
}
