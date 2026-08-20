import { Response, CookieOptions } from 'express';
import { randomBytes } from 'crypto';

export const ACCESS_COOKIE = 'bhd_access';
export const REFRESH_COOKIE = 'bhd_refresh';
export const CSRF_COOKIE = 'bhd_csrf';

function baseCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSiteEnv = (process.env.COOKIE_SAME_SITE || '').toLowerCase();
  const sameSite =
    sameSiteEnv === 'none' || sameSiteEnv === 'lax' || sameSiteEnv === 'strict'
      ? (sameSiteEnv as CookieOptions['sameSite'])
      : 'lax';
  return {
    httpOnly: true,
    // Secure required for SameSite=None; also on in production
    secure: isProd || sameSite === 'none',
    sameSite,
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  const base = baseCookieOptions();
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    // BHD unified idle window: 48h sliding (refresh + product session)
    maxAge: 48 * 60 * 60 * 1000,
  });
  res.cookie(CSRF_COOKIE, randomBytes(24).toString('base64url'), {
    ...base,
    httpOnly: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
}
