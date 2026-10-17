import { NextResponse } from 'next/server';
import { VALID_CREDENTIALS, createAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập tên đăng nhập và mật khẩu' },
        { status: 400 }
      );
    }

    const matchedUser = VALID_CREDENTIALS.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.password === password
    );

    if (!matchedUser) {
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    const user = {
      username: matchedUser.username,
      name: matchedUser.name,
    };

    const token = await createAuthToken(user);

    const response = NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công',
      user,
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trong quá trình đăng nhập' },
      { status: 500 }
    );
  }
}
