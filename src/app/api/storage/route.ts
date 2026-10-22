import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSettings, toMs } from '@/lib/settings-cache';
import { requireAuth } from '@/lib/require-auth';

/**
 * GET /api/storage
 * Thống kê dung lượng database thực tế + breakdown per-table
 * + thống kê exported/unexported + lịch sử activity
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      exportedOrders,
      unexportedOrders,
      totalSyncLogs,
      totalActivityLogs,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { exported_at: { not: null } } }),
      prisma.order.count({ where: { exported_at: null } }),
      prisma.orderSyncLog.count(),
      prisma.activityLog.count(),
    ]);

    // ── Per-table size breakdown (real PostgreSQL) ──
    interface TableSize {
      table_name: string;
      total_bytes: bigint;
      data_bytes: bigint;
      index_bytes: bigint;
      row_count: bigint;
    }

    let tableBreakdown: { name: string; totalKB: number; dataKB: number; indexKB: number; rows: number }[] = [];
    let dbSizeBytes = 0;

    try {
      const tableSizes = await prisma.$queryRaw<TableSize[]>`
        SELECT
          relname as table_name,
          pg_total_relation_size(quote_ident(relname))::bigint as total_bytes,
          pg_relation_size(quote_ident(relname))::bigint as data_bytes,
          (pg_total_relation_size(quote_ident(relname)) - pg_relation_size(quote_ident(relname)))::bigint as index_bytes,
          n_live_tup::bigint as row_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(quote_ident(relname)) DESC
      `;

      tableBreakdown = tableSizes.map(t => ({
        name: String(t.table_name),
        totalKB: Math.round(Number(t.total_bytes) / 1024 * 100) / 100,
        dataKB: Math.round(Number(t.data_bytes) / 1024 * 100) / 100,
        indexKB: Math.round(Number(t.index_bytes) / 1024 * 100) / 100,
        rows: Number(t.row_count),
      }));

      dbSizeBytes = tableSizes.reduce((sum, t) => sum + Number(t.total_bytes), 0);
    } catch {
      dbSizeBytes = totalOrders * 500 + totalSyncLogs * 1024;
    }

    const dbSizeMB = parseFloat((dbSizeBytes / (1024 * 1024)).toFixed(2));

    // ── Dung lượng thuần data (orders) ──
    // PostgreSQL overhead ~0.4MB cho metadata/indexes khi DB trống
    // Mỗi đơn hàng thực tế ~0.5KB data + ~0.3KB indexes ≈ ~0.8KB/đơn
    const estimatedOrdersKB = totalOrders * 0.8;
    const baseOverheadKB = Math.max(0, dbSizeBytes / 1024 - estimatedOrdersKB);

    // ── All-time stats from activity logs ──
    const [allTimeExported, allTimePurged, todayExported, todayPurged, recentLogs] = await Promise.all([
      prisma.activityLog.aggregate({ where: { action: 'EXPORT' }, _sum: { count: true } }),
      prisma.activityLog.aggregate({ where: { action: 'PURGE' }, _sum: { count: true } }),
      prisma.activityLog.aggregate({ where: { action: 'EXPORT', created_at: { gte: today } }, _sum: { count: true } }),
      prisma.activityLog.aggregate({ where: { action: 'PURGE', created_at: { gte: today } }, _sum: { count: true } }),
      prisma.activityLog.findMany({ orderBy: { created_at: 'desc' }, take: 20 }),
    ]);

    // ── Dự báo tăng trưởng ──
    // Tính trung bình đơn/ngày từ 30 ngày gần nhất
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ordersLast30Days = await prisma.order.count({
      where: { created_at: { gte: thirtyDaysAgo } },
    });
    const avgOrdersPerDay = Math.round(ordersLast30Days / 30 * 100) / 100;
    // Dự báo: với tốc độ này, bao lâu đến 100K records?
    const daysTo100K = avgOrdersPerDay > 0 ? Math.round((100000 - totalOrders) / avgOrdersPerDay) : null;

    return NextResponse.json({
      success: true,
      data: {
        totalOrders,
        exportedOrders,
        unexportedOrders,
        dbSizeMB,
        dbSizeBytes,
        baseOverheadKB: Math.round(baseOverheadKB),
        // Per-table breakdown
        tableBreakdown,
        // Growth forecast
        avgOrdersPerDay,
        daysTo100K,
        // Optimization stats
        totalSyncLogs,
        totalActivityLogs,
        // All-time stats
        totalExportedAllTime: allTimeExported._sum.count || 0,
        totalPurgedAllTime: allTimePurged._sum.count || 0,
        todayExported: todayExported._sum.count || 0,
        todayPurged: todayPurged._sum.count || 0,
        // Activity log
        recentLogs,
      },
    });
  } catch (error) {
    console.error('Error fetching storage stats:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/storage
 * Xóa đơn hàng ĐÃ XUẤT Excel (exported_at != null).
 * Đồng thời auto-cleanup: sync_logs + activity_logs theo cấu hình động.
 */
export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();

    if (body.confirmText !== 'DELETE') {
      return NextResponse.json({ success: false, error: 'Cần nhập chính xác: DELETE' }, { status: 400 });
    }

    const exportedCount = await prisma.order.count({
      where: { exported_at: { not: null } },
    });

    if (exportedCount === 0) {
      return NextResponse.json({ success: false, error: 'Không có đơn hàng đã xuất để dọn dẹp' }, { status: 400 });
    }

    // ── Read dynamic cleanup settings (from cache) ──
    const settings = await getSettings();

    const syncLogCutoff = new Date(Date.now() - toMs(
      Number(settings.sync_log_cleanup_value),
      settings.sync_log_cleanup_unit,
    ));
    const activityLogCutoff = new Date(Date.now() - toMs(
      Number(settings.activity_log_cleanup_value),
      settings.activity_log_cleanup_unit,
    ));

    // 1. Delete sync logs of exported orders
    const exportedOrderIds = await prisma.order.findMany({
      where: { exported_at: { not: null } },
      select: { id: true },
    });
    const ids = exportedOrderIds.map(o => o.id);

    await prisma.orderSyncLog.deleteMany({
      where: { order_id: { in: ids } },
    });

    // 2. Delete exported orders
    const result = await prisma.order.deleteMany({
      where: { exported_at: { not: null } },
    });

    // 3. Auto-cleanup: activity_logs theo cấu hình
    const oldLogs = await prisma.activityLog.deleteMany({
      where: { created_at: { lt: activityLogCutoff } },
    });

    // 4. Auto-cleanup: sync_logs cũ theo cấu hình
    const oldSyncLogs = await prisma.orderSyncLog.deleteMany({
      where: { created_at: { lt: syncLogCutoff } },
    });

    // Log activity
    const unitLabels: Record<string, string> = { days: 'ngày', hours: 'giờ', minutes: 'phút', seconds: 'giây' };
    await prisma.activityLog.create({
      data: {
        action: 'PURGE',
        count: result.count,
        note: `Dọn ${result.count} đơn đã xuất Excel` +
          (oldLogs.count > 0 ? ` · ${oldLogs.count} activity logs (>${settings.activity_log_cleanup_value} ${unitLabels[settings.activity_log_cleanup_unit] || settings.activity_log_cleanup_unit})` : '') +
          (oldSyncLogs.count > 0 ? ` · ${oldSyncLogs.count} sync logs (>${settings.sync_log_cleanup_value} ${unitLabels[settings.sync_log_cleanup_unit] || settings.sync_log_cleanup_unit})` : ''),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa ${result.count} đơn hàng đã xuất Excel`,
      deletedCount: result.count,
      cleanedActivityLogs: oldLogs.count,
      cleanedSyncLogs: oldSyncLogs.count,
    });
  } catch (error) {
    console.error('Error purging data:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

