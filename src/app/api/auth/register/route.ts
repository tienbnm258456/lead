import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, name, email } = body;

    // Validate required fields
    if (!username || !password || !name) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ tên đăng nhập, mật khẩu và họ tên' },
        { status: 400 }
      );
    }

    // Validate username format
    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername.length < 3 || normalizedUsername.length > 50) {
      return NextResponse.json(
        { error: 'Tên đăng nhập phải từ 3-50 ký tự' },
        { status: 400 }
      );
    }
    if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
      return NextResponse.json(
        { error: 'Tên đăng nhập chỉ chứa chữ thường, số và dấu gạch dưới' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    // Validate email format (optional but if provided must be valid)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Email không hợp lệ' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUser = await prisma.adminUser.findUnique({
      where: { username: normalizedUsername },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Tên đăng nhập đã tồn tại' },
        { status: 409 }
      );
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await prisma.adminUser.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email đã được sử dụng' },
          { status: 409 }
        );
      }
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.adminUser.create({
      data: {
        username: normalizedUsername,
        password_hash: passwordHash,
        name: name.trim(),
        email: email ? email.trim().toLowerCase() : null,
        role: 'ADMIN',
        active: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Đăng ký thành công! Bạn có thể đăng nhập ngay.',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trong quá trình đăng ký' },
      { status: 500 }
    );
  }
}
