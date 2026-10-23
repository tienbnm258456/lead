/**
 * Next.js Instrumentation — Background Jobs
 *
 * Jobs:
 *   1. Cleanup — dọn logs cũ (mỗi ngày lúc CLEANUP_CRON_HOUR)
 *   2. Sheets Export — xuất đơn hàng (mỗi ngày lúc 00:00, API route tự check lịch tháng)
 *
 * Lịch xuất Sheets (cấu hình trong API route):
 *   - Chạy vào 00:00:00 ngày mùng 1 mỗi 2 tháng (T2, T4, T6, T8, T10, T12)
 *   - Nếu server down ngày mùng 1 → mùng 2, 3... vẫn bắt kịp (chỉ xuất 1 lần/tháng)
 *
 * .env:
 *   CLEANUP_CRON_HOUR=23               → Cleanup lúc 23:00
 *   CLEANUP_INTERVAL_MINUTES=5         → Test cleanup
 *   SHEETS_EXPORT_MONTHS=2,4,6,8,10,12 → Tháng xuất (mặc định: tháng chẵn)
 *   SHEETS_EXPORT_INTERVAL_MINUTES=5   → Test export (bỏ qua lịch tháng)
 */

export async function register() {
  if (typeof window !== 'undefined') return;

  // ── Skip background jobs trong dev mode ──────────────────────────
  // Instrumentation fetch vào chính dev server → trigger recompile → loop reload.
  // Chỉ chạy background jobs ở production (next start / PM2).
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Instrumentation] DEV MODE — background jobs disabled (tránh reload loop)');
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  const BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // ═══════════════════════════════════════════════════════════════
  // JOB 1: CLEANUP
  // ═══════════════════════════════════════════════════════════════
  const runCleanup = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/cron/cleanup`, {
        method: 'GET',
        headers: { 'x-cron-secret': process.env.CRON_SECRET || 'internal' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.deletedSyncLogs > 0 || data.deletedActivityLogs > 0) {
          console.log(`[Cron] Cleanup: ${data.message}`);
        }
      }
    } catch (error) {
      console.error('[Cron] Cleanup failed:', error instanceof Error ? error.message : error);
    }
  };

  const cleanupIntervalMin = process.env.CLEANUP_INTERVAL_MINUTES;
  if (cleanupIntervalMin && !isNaN(Number(cleanupIntervalMin)) && Number(cleanupIntervalMin) > 0) {
    const ms = Number(cleanupIntervalMin) * 60 * 1000;
    console.log(`[Instrumentation] Cleanup: TEST MODE — every ${cleanupIntervalMin} min`);
    setTimeout(runCleanup, 10_000);
    setInterval(runCleanup, ms);
  } else {
    const cronHour = Number(process.env.CLEANUP_CRON_HOUR ?? '23');
    console.log(`[Instrumentation] Cleanup: DAILY at ${String(cronHour).padStart(2, '0')}:00`);
    const scheduleCleanup = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(cronHour, 0, 0, 0);
      if (now >= target) target.setDate(target.getDate() + 1);
      const delayMs = target.getTime() - now.getTime();
      console.log(`[Instrumentation] Next cleanup in ${(delayMs / 3600_000).toFixed(1)}h`);
      setTimeout(async () => { await runCleanup(); scheduleCleanup(); }, delayMs);
    };
    setTimeout(runCleanup, 10_000);
    scheduleCleanup();
  }

  // ═══════════════════════════════════════════════════════════════
  // JOB 2: GOOGLE SHEETS EXPORT
  //
  // Chạy mỗi ngày lúc 00:00 → API route tự check:
  //   "Tháng này có phải tháng xuất? Đã xuất tháng này chưa?"
  //
  // Test mode: SHEETS_EXPORT_INTERVAL_MINUTES → chạy mỗi N phút
  // ═══════════════════════════════════════════════════════════════
  const runSheetsExport = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/cron/export-sheets`, {
        method: 'GET',
        headers: { 'x-cron-secret': process.env.CRON_SECRET || 'internal' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          console.log(`[Cron] Sheets Export: ${data.message}`);
        }
        // Không log skip để tránh spam (skip xảy ra 28-30 ngày/tháng)
      }
    } catch (error) {
      console.error('[Cron] Sheets Export failed:', error instanceof Error ? error.message : error);
    }
  };

  const sheetsIntervalMin = process.env.SHEETS_EXPORT_INTERVAL_MINUTES;
  if (sheetsIntervalMin && !isNaN(Number(sheetsIntervalMin)) && Number(sheetsIntervalMin) > 0) {
    const ms = Number(sheetsIntervalMin) * 60 * 1000;
    console.log(`[Instrumentation] Sheets Export: TEST MODE — every ${sheetsIntervalMin} min`);
    setTimeout(runSheetsExport, 15_000);
    setInterval(runSheetsExport, ms);
  } else {
    const exportMonths = process.env.SHEETS_EXPORT_MONTHS || '2,4,6,8,10,12';
    console.log(`[Instrumentation] Sheets Export: DAILY check at 00:00 | Months: [${exportMonths}]`);

    const scheduleExportCheck = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(0, 0, 0, 0);
      // Schedule cho ngày mai lúc 00:00
      target.setDate(target.getDate() + 1);
      const delayMs = target.getTime() - now.getTime();
      const delayHours = (delayMs / 3600_000).toFixed(1);
      console.log(`[Instrumentation] Next Sheets check in ${delayHours}h (${target.toLocaleDateString('vi-VN')})`);
      setTimeout(async () => { await runSheetsExport(); scheduleExportCheck(); }, delayMs);
    };

    // Chạy 1 lần khi server khởi động (bắt kịp nếu miss ngày mùng 1)
    setTimeout(runSheetsExport, 15_000);
    scheduleExportCheck();
  }
}
