import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/auth/reset-password
 *
 * Đặt lại mật khẩu bằng reset token.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp mã xác nhận và mật khẩu mới' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Mật khẩu mới phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    // Find user by reset token
    const user = await prisma.adminUser.findUnique({
      where: { reset_token: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Mã xác nhận không hợp lệ' },
        { status: 400 }
      );
    }

    // Check token expiry
    if (!user.reset_token_exp || user.reset_token_exp < new Date()) {
      return NextResponse.json(
        { error: 'Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới.' },
        { status: 400 }
      );
    }

    // Hash new password and clear reset token
    const passwordHash = await hashPassword(newPassword);
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        password_hash: passwordHash,
        reset_token: null,
        reset_token_exp: null,
      },
    });

    console.log(`[Auth] Password reset successful for "${user.username}"`);

    return NextResponse.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi đặt lại mật khẩu' },
      { status: 500 }
    );
  }
}
