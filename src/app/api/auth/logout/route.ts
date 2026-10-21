import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import { getAuthCookieOptions } from '@/lib/cookie-options';

export async function POST(request: Request) {
  const response = NextResponse.json({
    success: true,
    message: 'Đăng xuất thành công',
  });

  // Clear cookie — auto-detect secure flag from request
  response.cookies.set(getAuthCookieOptions(AUTH_COOKIE_NAME, '', request, 0));

  return response;
}

