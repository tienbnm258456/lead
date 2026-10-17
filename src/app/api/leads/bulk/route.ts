import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/leads/bulk - Bulk delete leads
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'IDs array is required' },
        { status: 400 }
      );
    }

    const numericIds = ids.map((id: unknown) => parseInt(String(id))).filter((id: number) => !isNaN(id));

    if (numericIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid IDs provided' },
        { status: 400 }
      );
    }

    const result = await prisma.lead.deleteMany({
      where: { id: { in: numericIds } },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa ${result.count} lead`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error bulk deleting leads:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
