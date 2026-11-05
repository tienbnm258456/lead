import { Prisma } from '@prisma/client';
import { purgeEligibility, retentionDays, TERMINAL_CRM_STATUSES } from '@/lib/order-retention';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSettings, toMs } from '@/lib/settings-cache';
import { requireAdmin } from '@/lib/require-auth';

/**
 * GET /api/storage
 * Thống kê dung lượng database thực tế + breakdown per-table
 * + thống kê exported/unexported + lịch sử activity
 */
export async function GET(request?: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const days = retentionDays(request ? new URL(request.url).searchParams.get('retentionDays') : undefined);
    const cutoff = new Date(Date.now() - days * 86400000);
    const [eligible] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM orders o WHERE ${purgeEligibility(cutoff)}`;
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
      prisma.order.count({ where: { OR: [{ exported_at: { not: null } }, { sheets_exported_at: { not: null } }] } }),
      prisma.order.count({ where: { exported_at: null, sheets_exported_at: null } }),
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
        purgeableOrders: Number(eligible.count),
        retentionDays: days,
        terminalStatuses: TERMINAL_CRM_STATUSES,
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
    if (error instanceof Error && error.message.startsWith('Thời hạn')) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error fetching storage stats:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/storage
 * Xóa đơn đã xuất, trạng thái kết thúc, quá hạn không cập nhật CRM và không có webhook tồn đọng.
 * Đồng thời auto-cleanup: sync_logs + activity_logs theo cấu hình động.
 */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();

    if (body.confirmText !== 'DELETE') {
      return NextResponse.json({ success: false, error: 'Cần nhập chính xác: DELETE' }, { status: 400 });
    }

    const days = retentionDays(body.retentionDays);
    const settings = await getSettings();
    const cutoff = new Date(Date.now() - days * 86400000);
    const result = await prisma.$transaction(async tx => {
      // Briefly block writes so an accepted webhook or CRM update cannot race the eligibility check.
      // Reads remain available. Lock orders before inbox to match worker write order.
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$executeRaw`LOCK TABLE orders, retailcrm_events IN SHARE ROW EXCLUSIVE MODE`;
      const deleted = await tx.$queryRaw<{ id: number }[]>(Prisma.sql`DELETE FROM orders o WHERE ${purgeEligibility(cutoff)} RETURNING o.id`);
      if (!deleted.length) return null;
      // FK cascade deletes only the selected orders' sync logs.
      const oldLogs = await tx.activityLog.deleteMany({ where: { created_at: { lt: new Date(Date.now() - toMs(Number(settings.activity_log_cleanup_value), settings.activity_log_cleanup_unit)) } } });
      const oldSyncLogs = await tx.orderSyncLog.deleteMany({ where: { created_at: { lt: new Date(Date.now() - toMs(Number(settings.sync_log_cleanup_value), settings.sync_log_cleanup_unit)) } } });
      await tx.activityLog.create({ data: { action: 'PURGE', count: deleted.length,
        note: 'Dọn ' + deleted.length + ' đơn đã xuất, trạng thái kết thúc, không cập nhật CRM quá ' + days + ' ngày; không có webhook tồn đọng' } });
      return { count: deleted.length, oldLogs: oldLogs.count, oldSyncLogs: oldSyncLogs.count };
    }, { timeout: 30000, maxWait: 5000 });
    if (!result) return NextResponse.json({ success: false, error: 'Không có đơn đủ điều kiện: đã xuất, trạng thái kết thúc, quá hạn và không có webhook tồn đọng' }, { status: 400 });
    return NextResponse.json({ success: true, message: 'Đã xóa ' + result.count + ' đơn đủ điều kiện',
      deletedCount: result.count, cleanedActivityLogs: result.oldLogs, cleanedSyncLogs: result.oldSyncLogs });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Thời hạn')) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error purging data:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

