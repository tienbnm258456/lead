import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/auth/forgot-password
 *
 * Tạo reset token cho user dựa vào username hoặc email.
 * Vì chưa có email service, token sẽ được trả về trực tiếp
 * (trong production nên gửi qua email).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier } = body; // username or email

    if (!identifier) {
      return NextResponse.json(
        { error: 'Vui lòng nhập tên đăng nhập hoặc email' },
        { status: 400 }
      );
    }

    const normalizedId = identifier.trim().toLowerCase();

    // Find user by username or email
    const user = await prisma.adminUser.findFirst({
      where: {
        OR: [
          { username: normalizedId },
          { email: normalizedId },
        ],
        active: true,
      },
    });

    if (!user) {
      // Don't reveal if user exists or not (security)
      return NextResponse.json({
        success: true,
        message: 'Nếu tài khoản tồn tại, bạn sẽ nhận được mã đặt lại mật khẩu.',
      });
    }

    // Generate reset token (random 32-byte hex)
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const resetToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const resetExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Save to DB
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        reset_token: resetToken,
        reset_token_exp: resetExpiry,
      },
    });

    console.log(`[Auth] Password reset requested for "${user.username}". Token: ${resetToken} (expires: ${resetExpiry.toISOString()})`);

    return NextResponse.json({
      success: true,
      message: 'Mã đặt lại mật khẩu đã được tạo.',
      // In DEV mode, return token directly (production should send via email)
      resetToken,
      expiresAt: resetExpiry.toISOString(),
      note: 'Trong môi trường development, token được trả về trực tiếp. Production nên gửi qua email.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi' },
      { status: 500 }
    );
  }
}
