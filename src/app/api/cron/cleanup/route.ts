import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSettings, toMs } from '@/lib/settings-cache';

/**
 * GET /api/cron/cleanup
 *
 * Background job: tự động dọn dẹp logs quá hạn.
 * Chạy bởi instrumentation.ts interval hoặc external cron.
 *
 * Logic:
 * 1. Đọc cấu hình cleanup từ cache (system_settings)
 * 2. Tính cutoff date cho sync_logs và activity_logs
 * 3. Xóa records quá hạn
 * 4. Log kết quả
 */
export async function GET() {
  try {
    const settings = await getSettings();

    const syncCutoff = new Date(Date.now() - toMs(
      Number(settings.sync_log_cleanup_value),
      settings.sync_log_cleanup_unit,
    ));
    const activityCutoff = new Date(Date.now() - toMs(
      Number(settings.activity_log_cleanup_value),
      settings.activity_log_cleanup_unit,
    ));

    // 1. Xóa sync logs quá hạn
    const deletedSyncLogs = await prisma.orderSyncLog.deleteMany({
      where: { created_at: { lt: syncCutoff } },
    });

    // 2. Xóa activity logs quá hạn
    const deletedActivityLogs = await prisma.activityLog.deleteMany({
      where: { created_at: { lt: activityCutoff } },
    });

    const totalDeleted = deletedSyncLogs.count + deletedActivityLogs.count;

    if (totalDeleted > 0) {
      console.log(
        `[Cron Cleanup] Deleted ${deletedSyncLogs.count} sync logs (>${settings.sync_log_cleanup_value} ${settings.sync_log_cleanup_unit})` +
        ` + ${deletedActivityLogs.count} activity logs (>${settings.activity_log_cleanup_value} ${settings.activity_log_cleanup_unit})`
      );
    }

    return NextResponse.json({
      success: true,
      message: totalDeleted > 0
        ? `Đã dọn ${deletedSyncLogs.count} sync logs + ${deletedActivityLogs.count} activity logs`
        : 'Không có dữ liệu cần dọn',
      deletedSyncLogs: deletedSyncLogs.count,
      deletedActivityLogs: deletedActivityLogs.count,
      config: {
        syncLogs: `${settings.sync_log_cleanup_value} ${settings.sync_log_cleanup_unit}`,
        activityLogs: `${settings.activity_log_cleanup_value} ${settings.activity_log_cleanup_unit}`,
      },
    });
  } catch (error) {
    console.error('[Cron Cleanup] Error:', error);
    return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 });
  }
}
