// ─────────────────────────────────────────────────────────────────────────────
// Cookie Options — Dynamic secure flag based on request protocol
//
// Vấn đề: Khi deploy trên server dùng IP (không có HTTPS), process.env.NODE_ENV
// không đáng tin vì PM2 có thể không load .env. Thay vào đó, ta detect protocol
// trực tiếp từ request headers.
//
// Quy tắc:
//   - HTTPS (có domain + SSL) → secure: true, sameSite: 'strict'
//   - HTTP  (IP trực tiếp)    → secure: false, sameSite: 'lax'
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from 'next/server';

/**
 * Detect if the current request is over HTTPS.
 *
 * Checks multiple sources:
 * 1. x-forwarded-proto header (set by reverse proxies like nginx)
 * 2. Request URL protocol
 * 3. Fallback to NODE_ENV check
 */
function isSecureRequest(request?: NextRequest | Request): boolean {
  if (request) {
    // Check x-forwarded-proto (nginx/reverse proxy)
    const forwardedProto = request.headers.get('x-forwarded-proto');
    if (forwardedProto) {
      return forwardedProto === 'https';
    }

    // Check actual request URL
    try {
      const url = new URL(request.url);
      if (url.protocol === 'https:') return true;
    } catch {
      // ignore
    }
  }

  // Fallback: NODE_ENV (may not be reliable with PM2 without proper config)
  return process.env.NODE_ENV === 'production' && !process.env.FORCE_HTTP;
}

export interface CookieSetOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
}

/**
 * Get cookie options with dynamic `secure` flag based on the request.
 *
 * Usage:
 * ```ts
 * import { getAuthCookieOptions } from '@/lib/cookie-options';
 * import { AUTH_COOKIE_NAME } from '@/lib/auth';
 *
 * // Set cookie
 * response.cookies.set(getAuthCookieOptions(AUTH_COOKIE_NAME, token, request));
 *
 * // Clear cookie (logout)
 * response.cookies.set(getAuthCookieOptions(AUTH_COOKIE_NAME, '', request, 0));
 * ```
 */
export function getAuthCookieOptions(
  name: string,
  value: string,
  request?: NextRequest | Request,
  maxAge: number = 60 * 60 * 24 * 7, // default: 7 days
): CookieSetOptions {
  const secure = isSecureRequest(request);

  return {
    name,
    value,
    httpOnly: true,
    secure,
    sameSite: secure ? 'strict' : 'lax',
    path: '/',
    maxAge,
  };
}
