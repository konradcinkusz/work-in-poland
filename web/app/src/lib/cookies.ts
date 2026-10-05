import { cookieSecure } from './env';

export const ACCESS_COOKIE = 'wip_at';
export const REFRESH_COOKIE = 'wip_rt';
/** Short-lived cookie that carries the 2FA challenge token so client JS never sees it. */
export const CHALLENGE_COOKIE = 'wip_2fa';
/** 10 s marker set by the refresh route so the edge gate can break a refresh loop. */
/** Remembers `?redirect=` across the social-login round trip (lax: it must survive a cross-site return). */
export const POST_LOGIN_COOKIE = 'wip_post_login';
export const REFRESH_MARKER_COOKIE = 'wip_rf';

/** Lifetime of the session cookies. The JWT `exp` — not the cookie — decides validity. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const CHALLENGE_MAX_AGE_SECONDS = 300;

export interface CookieAttributes {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict' | 'lax';
  path: '/';
  maxAge: number;
}

/**
 * The ONE place cookie attributes are defined. Setting and clearing both go through it, so a
 * delete can never use different path/sameSite than the set (FRONTEND-BFF §3).
 */
export function cookieAttributes(
  maxAge: number,
  secure: boolean = cookieSecure(),
  sameSite: 'strict' | 'lax' = 'strict',
): CookieAttributes {
  return { httpOnly: true, secure, sameSite, path: '/', maxAge };
}

export interface CookieWriter {
  cookies: { set(name: string, value: string, opts: CookieAttributes): unknown };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function setSessionCookies(res: CookieWriter, tokens: TokenPair): void {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieAttributes(SESSION_MAX_AGE_SECONDS));
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieAttributes(SESSION_MAX_AGE_SECONDS));
}

export function clearSessionCookies(res: CookieWriter): void {
  res.cookies.set(ACCESS_COOKIE, '', cookieAttributes(0));
  res.cookies.set(REFRESH_COOKIE, '', cookieAttributes(0));
}

export function setChallengeCookie(res: CookieWriter, token: string): void {
  res.cookies.set(CHALLENGE_COOKIE, token, cookieAttributes(CHALLENGE_MAX_AGE_SECONDS));
}

export function clearChallengeCookie(res: CookieWriter): void {
  res.cookies.set(CHALLENGE_COOKIE, '', cookieAttributes(0));
}

export function setRefreshMarker(res: CookieWriter): void {
  res.cookies.set(REFRESH_MARKER_COOKIE, '1', cookieAttributes(10));
}
