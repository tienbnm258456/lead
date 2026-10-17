import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/leads/storage - Get database storage statistics + export history
export async function GET() {
  try {
    const [
      totalCount,
      exportedCount,
      unexportedCount,
      todayCount,
      oldestLead,
      newestLead,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { exported_at: { not: null } } }),
      prisma.lead.count({ where: { exported_at: null } }),
      prisma.lead.count({
        where: {
          created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.lead.findFirst({ orderBy: { created_at: 'asc' }, select: { created_at: true } }),
      prisma.lead.findFirst({ orderBy: { created_at: 'desc' }, select: { created_at: true } }),
    ]);

    // Permanent export/purge history from ExportLog
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const [totalExportedAllTime, totalPurgedAllTime, todayExported, todayPurged, recentLogs] =
      await Promise.all([
        // Total exported all-time
        prisma.exportLog.aggregate({
          _sum: { count: true },
          where: { action: 'EXPORT' },
        }),
        // Total purged all-time
        prisma.exportLog.aggregate({
          _sum: { count: true },
          where: { action: 'PURGE' },
        }),
        // Today exported
        prisma.exportLog.aggregate({
          _sum: { count: true },
          where: { action: 'EXPORT', created_at: { gte: todayStart } },
        }),
        // Today purged
        prisma.exportLog.aggregate({
          _sum: { count: true },
          where: { action: 'PURGE', created_at: { gte: todayStart } },
        }),
        // Recent 20 log entries
        prisma.exportLog.findMany({
          orderBy: { created_at: 'desc' },
          take: 20,
        }),
      ]);

    // Weekly breakdown
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const weeklyData = await prisma.$queryRaw<
      { week_start: Date; count: bigint }[]
    >`
      SELECT date_trunc('week', created_at) as week_start, COUNT(*) as count
      FROM leads
      WHERE created_at >= ${eightWeeksAgo}
      GROUP BY week_start
      ORDER BY week_start DESC
      LIMIT 8
    `;

    // Estimated size: ~500 bytes per record
    const estimatedSizeMB = Math.round((totalCount * 500) / (1024 * 1024) * 100) / 100;
    const exportedSizeMB = Math.round((exportedCount * 500) / (1024 * 1024) * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        totalCount,
        exportedCount,
        unexportedCount,
        todayCount,
        estimatedSizeMB,
        exportedSizeMB,
        oldestRecord: oldestLead?.created_at || null,
        newestRecord: newestLead?.created_at || null,
        // Permanent stats (survive purges)
        totalExportedAllTime: totalExportedAllTime._sum.count || 0,
        totalPurgedAllTime: totalPurgedAllTime._sum.count || 0,
        todayExported: todayExported._sum.count || 0,
        todayPurged: todayPurged._sum.count || 0,
        recentLogs: recentLogs.map((log) => ({
          id: log.id,
          action: log.action,
          count: log.count,
          note: log.note,
          created_at: log.created_at,
        })),
        weeklyBreakdown: weeklyData.map((w) => ({
          weekStart: w.week_start,
          count: Number(w.count),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching storage stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/leads/storage - Purge all exported leads
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { confirmText } = body;

    if (confirmText !== 'DELETE') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập đúng: DELETE' },
        { status: 400 }
      );
    }

    const exportedCount = await prisma.lead.count({
      where: { exported_at: { not: null } },
    });

    if (exportedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Không có bản ghi nào đã xuất để xóa.' },
        { status: 400 }
      );
    }

    // Delete ALL records that have been exported
    const result = await prisma.lead.deleteMany({
      where: { exported_at: { not: null } },
    });

    // Log the purge action permanently
    await prisma.exportLog.create({
      data: {
        action: 'PURGE',
        count: result.count,
        note: `Dọn dẹp ${result.count} bản ghi đã xuất`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa ${result.count.toLocaleString('vi-VN')} bản ghi đã xuất Excel.`,
      deletedCount: result.count,
      freedMB: Math.round((result.count * 500) / (1024 * 1024) * 100) / 100,
    });
  } catch (error) {
    console.error('Error purging leads:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
