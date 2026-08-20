import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

export const BHD_OAUTH_STATE_COOKIE = 'bhd_oauth_state';

type OAuthState = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  redirectUri: string;
};

type IdClaims = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  preferred_username?: string;
  nonce?: string;
};

function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomToken(bytes = 32): string {
  return base64Url(randomBytes(bytes));
}

function sha256Base64Url(value: string): string {
  return base64Url(createHash('sha256').update(value).digest());
}

function safeReturnTo(raw: string | null | undefined): string {
  const v = (raw || '/dashboard').trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('://') || v.includes('\\')) {
    return '/dashboard';
  }
  // Portal launcher always sends returnTo=/ — Hisaby home is the dashboard.
  if (v === '/') return '/dashboard';
  return v;
}

@Injectable()
export class BhdSsoService {
  private readonly logger = new Logger(BhdSsoService.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  isConfigured(): boolean {
    return !!(
      this.issuer() &&
      this.clientId() &&
      (process.env.BHD_OAUTH_REDIRECT_URI || process.env.FRONTEND_URL)
    );
  }

  issuer(): string {
    return (
      process.env.BHD_IDENTITY_ISSUER ||
      this.config.get<string>('bhd.issuer') ||
      'https://id.bhd-om.com'
    ).replace(/\/$/, '');
  }

  clientId(): string {
    return (
      process.env.BHD_OAUTH_CLIENT_ID ||
      this.config.get<string>('bhd.clientId') ||
      'bhd-hisaby'
    ).trim();
  }

  clientSecret(): string {
    return (process.env.BHD_OAUTH_CLIENT_SECRET || '').trim();
  }

  /** Prefer explicit redirect; else derive from request public origin. */
  redirectUriFor(requestOrigin: string): string {
    const fixed = (process.env.BHD_OAUTH_REDIRECT_URI || '').trim();
    if (fixed) return fixed;
    return `${requestOrigin.replace(/\/$/, '')}/api/auth/bhd/callback`;
  }

  frontendOrigin(): string {
    return (
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN?.split(',')[0]?.trim() ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  buildStart(returnToRaw: string | undefined, requestOrigin: string): {
    authorizeUrl: string;
    stateCookieValue: string;
  } {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'BHD Identity SSO is not configured (BHD_IDENTITY_ISSUER / BHD_OAUTH_CLIENT_ID)',
      );
    }
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken(48);
    const challenge = sha256Base64Url(verifier);
    const returnTo = safeReturnTo(returnToRaw);
    const redirectUri = this.redirectUriFor(requestOrigin);
    const payload: OAuthState = {
      state,
      nonce,
      verifier,
      returnTo,
      redirectUri,
    };
    const authorize = new URL(`${this.issuer()}/oauth/authorize`);
    authorize.searchParams.set('client_id', this.clientId());
    authorize.searchParams.set('redirect_uri', redirectUri);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('scope', 'openid profile email');
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('nonce', nonce);
    authorize.searchParams.set('code_challenge', challenge);
    authorize.searchParams.set('code_challenge_method', 'S256');
    return {
      authorizeUrl: authorize.toString(),
      // Plain JSON — Express cookie serializer encodes once (avoid double encodeURIComponent)
      stateCookieValue: JSON.stringify(payload),
    };
  }

  parseStateCookie(raw: string | undefined): OAuthState | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OAuthState;
    } catch {
      try {
        return JSON.parse(decodeURIComponent(raw)) as OAuthState;
      } catch {
        return null;
      }
    }
  }

  async exchangeAndLogin(
    code: string,
    stateParam: string,
    saved: OAuthState,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ tokens: { accessToken: string; refreshToken: string }; returnTo: string }> {
    if (!code || !stateParam || saved.state !== stateParam) {
      throw new BadRequestException('Invalid OAuth state');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: saved.redirectUri,
      client_id: this.clientId(),
      code_verifier: saved.verifier,
    });
    const secret = this.clientSecret();
    if (secret) body.set('client_secret', secret);

    const tokenRes = await fetch(`${this.issuer()}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      this.logger.warn(`BHD token exchange failed: ${tokenRes.status} ${text.slice(0, 200)}`);
      throw new UnauthorizedException('BHD token exchange failed');
    }
    const tokenJson = (await tokenRes.json()) as { id_token?: string };
    if (!tokenJson.id_token) {
      throw new UnauthorizedException('Missing id_token');
    }

    const claims = await this.verifyIdToken(tokenJson.id_token, saved.nonce);
    const session = await this.authService.loginWithBhdIdentity(claims, meta);
    return { tokens: session, returnTo: saved.returnTo || '/dashboard' };
  }

  endSessionUrl(postLogoutRedirect?: string): string {
    const url = new URL(`${this.issuer()}/oauth/end-session`);
    url.searchParams.set('client_id', this.clientId());
    url.searchParams.set(
      'post_logout_redirect_uri',
      postLogoutRedirect || `${this.frontendOrigin()}/`,
    );
    return url.toString();
  }

  private async verifyIdToken(idToken: string, expectedNonce: string): Promise<IdClaims> {
    const issuer = this.issuer();
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(`${issuer}/oauth/jwks.json`));
    }
    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer,
      audience: this.clientId(),
    });
    if (payload.nonce !== expectedNonce) {
      throw new UnauthorizedException('Invalid nonce');
    }
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new UnauthorizedException('Invalid id_token claims');
    }
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
      throw new UnauthorizedException('Email not verified on BHD Identity');
    }
    return {
      sub: payload.sub,
      email: String(payload.email).trim().toLowerCase(),
      email_verified: true,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
      preferred_username:
        typeof payload.preferred_username === 'string'
          ? payload.preferred_username
          : undefined,
    };
  }
}
