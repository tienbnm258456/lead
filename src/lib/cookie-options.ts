// ─────────────────────────────────────────────────────────────────────────────
// Cookie Options — Dynamic secure flag based on deployment config
//
// Quy tắc:
//   - FORCE_HTTP=true (IP trực tiếp, chưa có SSL) → secure: false, sameSite: 'lax'
//   - Production (có domain + SSL)                 → secure: true, sameSite: 'strict'
//   - Development                                  → secure: false, sameSite: 'lax'
//
// ⚠️ KHÔNG dùng x-forwarded-proto từ client vì có thể bị spoofed.
//    Dùng biến môi trường để xác định chế độ deploy.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from 'next/server';

/**
 * Detect if the deployment requires secure cookies.
 *
 * Priority:
 * 1. FORCE_HTTP=true → insecure (cho server dùng IP, chưa có SSL)
 * 2. NODE_ENV=production → secure (yêu cầu HTTPS)
 * 3. Development → insecure
 */
function isSecureRequest(request?: NextRequest | Request): boolean {
  // Cho phép tắt secure cookie khi chưa có SSL (IP trực tiếp, chưa có domain)
  if (process.env.FORCE_HTTP === 'true') return false;

  // Production mặc định bật secure (yêu cầu HTTPS)
  if (process.env.NODE_ENV === 'production') return true;

  // Development: check request protocol nếu có
  if (request) {
    try {
      const url = new URL(request.url);
      if (url.protocol === 'https:') return true;
    } catch { /* ignore */ }
  }

  return false;
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
