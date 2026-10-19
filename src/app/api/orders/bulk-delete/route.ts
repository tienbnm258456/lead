import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orders/bulk-delete
 * Xóa hàng loạt đơn hàng theo danh sách ID
 * Body: { ids: number[] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body as { ids: number[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Danh sách ID không hợp lệ' }, { status: 400 });
    }

    // Delete sync logs first (cascade doesn't apply to deleteMany)
    await prisma.orderSyncLog.deleteMany({
      where: { order_id: { in: ids } },
    });

    const result = await prisma.order.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa ${result.count} đơn hàng`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
