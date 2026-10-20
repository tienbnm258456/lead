import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    // Verify current session
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const currentUser = await verifyAuthToken(token);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Bạn cần đăng nhập để đổi mật khẩu' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Mật khẩu mới phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    // Get user from DB
    const dbUser = await prisma.adminUser.findUnique({
      where: { id: currentUser.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Tài khoản không tồn tại' },
        { status: 404 }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, dbUser.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Mật khẩu hiện tại không chính xác' },
        { status: 401 }
      );
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await prisma.adminUser.update({
      where: { id: currentUser.id },
      data: { password_hash: newHash },
    });

    return NextResponse.json({
      success: true,
      message: 'Đổi mật khẩu thành công!',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi đổi mật khẩu' },
      { status: 500 }
    );
  }
}
