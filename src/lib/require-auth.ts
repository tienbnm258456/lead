/**
 * API Route Authentication Helper
 *
 * Dùng ở đầu mỗi API route handler cần bảo vệ.
 *
 * Usage:
 *   import { requireAuth } from '@/lib/require-auth';
 *
 *   export async function GET() {
 *     const auth = await requireAuth();
 *     if (auth.error) return auth.error;
 *     // auth.user is available
 *   }
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthToken, type AuthUser } from './auth';

type AuthSuccess = { user: AuthUser; error?: undefined };
type AuthFailure = { user?: undefined; error: NextResponse };
type AuthResult = AuthSuccess | AuthFailure;

/**
 * Kiểm tra authentication. Trả về user hoặc 401 response.
 */
export async function requireAuth(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const user = await verifyAuthToken(token);

    if (!user) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    return { user };
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
}

/**
 * Kiểm tra authentication + yêu cầu role ADMIN.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.error) return result;

  if (result.user.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden — chỉ admin mới có quyền' }, { status: 403 }) };
  }
  return result;
}
