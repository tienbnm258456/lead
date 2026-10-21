import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  const user = await verifyAuthToken(token);

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Chỉ trả thông tin hiển thị tối thiểu — không trả id, email, username
  return NextResponse.json({
    authenticated: true,
    name: user.name || user.username,
    role: user.role,
  });
}
