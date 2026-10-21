import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = await verifyAuthToken(token);

  const isAdminRoute = pathname.startsWith('/admin');
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password';
  const isRootRoute = pathname === '/';

  // If trying to access admin without authentication
  if (isAdminRoute && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If trying to access auth pages (login/register/forgot-password) while already authenticated
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Root redirect: to admin if logged in, to login if not
  if (isRootRoute) {
    if (user) {
      return NextResponse.redirect(new URL('/admin', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handled individually)
     */
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/admin/:path*',
  ],
};
