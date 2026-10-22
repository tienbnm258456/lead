import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const startTime = Date.now();
  const method = request.method;

  // ── Auth check ────────────────────────────────────────────────────
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = await verifyAuthToken(token);
  const duration = Date.now() - startTime;

  // ── Request logging (hiện trong PM2 log) ──────────────────────────
  const userTag = user ? `[${user.username}]` : '[anonymous]';
  const isApiRoute = pathname.startsWith('/api/');

  if (isApiRoute) {
    // Log API requests với query params (hữu ích cho debug)
    const query = request.nextUrl.search || '';
    console.log(`📡 ${method} ${pathname}${query} ${userTag} (${duration}ms)`);
  } else {
    console.log(`🌐 ${method} ${pathname} ${userTag} (${duration}ms)`);
  }

  // ── API routes: chỉ log, KHÔNG redirect ───────────────────────────
  // (Webhook endpoint cần public, auth check ở từng route riêng)
  if (isApiRoute) {
    return NextResponse.next();
  }

  // ── Page routes: auth protection ──────────────────────────────────
  // C2: /register giờ là admin feature (cần đăng nhập)
  const isAdminRoute = pathname.startsWith('/admin') || pathname === '/register';
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/forgot-password';
  const isRootRoute = pathname === '/';

  // If trying to access admin without authentication
  if (isAdminRoute && !user) {
    console.log(`🔒 Redirect → /login (unauthenticated access to ${pathname})`);
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
     * - favicon.ico, robots.txt, sitemap.xml
     */
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/admin/:path*',
    '/api/:path*',
  ],
};
