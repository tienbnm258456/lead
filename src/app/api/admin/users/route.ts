import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-auth';

/**
 * GET /api/admin/users
 * Lấy danh sách tài khoản — chỉ ADMIN mới xem được.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const users = await prisma.adminUser.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      active: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({ success: true, data: users });
}

/**
 * DELETE /api/admin/users
 * Xóa tài khoản — chỉ ADMIN mới xóa được.
 * Body: { id: number }
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await request.json();

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

    // Không cho phép admin tự xóa chính mình
    if (id === auth.user.id) {
      return NextResponse.json(
        { error: 'Không thể xóa tài khoản của chính bạn' },
        { status: 400 }
      );
    }

    // Kiểm tra user tồn tại
    const user = await prisma.adminUser.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'Tài khoản không tồn tại' }, { status: 404 });
    }

    // Không cho xóa tài khoản ADMIN khác (bảo vệ)
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Không thể xóa tài khoản Admin khác' },
        { status: 403 }
      );
    }

    await prisma.adminUser.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Đã xóa tài khoản "${user.username}"`,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Lỗi khi xóa tài khoản' },
      { status: 500 }
    );
  }
}
