import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orders/[id]
 * Lấy chi tiết 1 đơn hàng
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: { sync_logs: { orderBy: { created_at: 'desc' }, take: 5 } },
    });
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/orders/[id]
 * Cập nhật thông tin đơn hàng (chỉ cho đơn thủ công hoặc chưa sync)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { customer_name, customer_phone, delivery_address, total_price, selected_package, selected_size } = body;

    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        ...(customer_name && { customer_name }),
        ...(customer_phone && { customer_phone }),
        ...(delivery_address && { delivery_address }),
        ...(total_price !== undefined && { total_price: Number(total_price) }),
        ...(selected_package !== undefined && { selected_package }),
        ...(selected_size !== undefined && { selected_size }),
      },
    });

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/orders/[id]
 * Xóa 1 đơn hàng (cascade xóa sync_logs)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.order.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
