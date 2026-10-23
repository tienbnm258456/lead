/**
 * GET /api/cron/export-sheets
 *
 * Tự động xuất đơn hàng lên Google Sheets.
 *
 * Lịch cố định: Mùng 1 mỗi 2 tháng (T2, T4, T6, T8, T10, T12)
 * Cấu hình qua .env:
 *   SHEETS_EXPORT_MONTHS=2,4,6,8,10,12   → Các tháng xuất (mặc định: tháng chẵn)
 *   SHEETS_EXPORT_INTERVAL_MINUTES=5      → Test mode: bỏ qua lịch, xuất ngay
 *
 * Logic:
 *   1. Tháng hiện tại có nằm trong SHEETS_EXPORT_MONTHS?
 *   2. Đã xuất trong tháng này chưa? (tránh xuất trùng)
 *   3. Có đơn chưa xuất không?
 *   4. Xuất → đánh dấu → log
 *
 * Scheduler (instrumentation.ts) gọi MỖI NGÀY lúc 00:00.
 * Nếu server down ngày mùng 1 → mùng 2 vẫn bắt kịp.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exportOrdersToGoogleSheets } from '@/lib/google-sheets';

const TAG = '[Cron/ExportSheets]';

// Tháng xuất mặc định: tháng chẵn (2,4,6,8,10,12)
function getExportMonths(): number[] {
  const env = process.env.SHEETS_EXPORT_MONTHS;
  if (env) {
    return env.split(',').map(s => Number(s.trim())).filter(n => n >= 1 && n <= 12);
  }
  return [2, 4, 6, 8, 10, 12];
}

export async function GET(request: Request) {
  const startTime = Date.now();

  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET || 'internal';
  if (cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`${TAG} ──────────────────────────────────────`);
  console.log(`${TAG} 🚀 Job started at ${new Date().toLocaleString('vi-VN')}`);

  try {
    // ── Check 1: Configured? ──
    if (!process.env.GOOGLE_APPS_SCRIPT_URL) {
      console.log(`${TAG} ⏭️  SKIP — GOOGLE_APPS_SCRIPT_URL chưa cấu hình`);
      return NextResponse.json({ skipped: true, message: 'Thiếu GOOGLE_APPS_SCRIPT_URL' });
    }

    // ── Check 2: Có phải tháng xuất không? ──
    const isTestMode = !!process.env.SHEETS_EXPORT_INTERVAL_MINUTES;
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const exportMonths = getExportMonths();

    if (!isTestMode) {
      if (!exportMonths.includes(currentMonth)) {
        console.log(`${TAG} ⏭️  SKIP — Tháng ${currentMonth} không nằm trong lịch xuất [${exportMonths.join(',')}]`);
        return NextResponse.json({
          skipped: true,
          message: `Tháng ${currentMonth} không phải tháng xuất. Lịch: [${exportMonths.join(', ')}]`,
          currentMonth,
          exportMonths,
        });
      }

      // ── Check 3: Đã xuất trong tháng này chưa? ──
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const exportedThisMonth = await prisma.order.findFirst({
        where: {
          sheets_exported_at: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: { sheets_exported_at: true },
      });

      if (exportedThisMonth) {
        console.log(`${TAG} ⏭️  SKIP — Đã xuất trong tháng ${currentMonth} rồi (${exportedThisMonth.sheets_exported_at?.toLocaleDateString('vi-VN')})`);
        return NextResponse.json({
          skipped: true,
          message: `Đã xuất trong tháng ${currentMonth} rồi`,
          lastExportInMonth: exportedThisMonth.sheets_exported_at,
        });
      }

      console.log(`${TAG} ✅ Tháng ${currentMonth} — nằm trong lịch xuất & chưa xuất tháng này`);
    } else {
      console.log(`${TAG} 🧪 TEST MODE — bỏ qua check lịch tháng`);
    }

    // ── Check 4: Có đơn chưa xuất? ──
    console.log(`${TAG} 📦 Querying orders chưa xuất...`);
    const orders = await prisma.order.findMany({
      where: { sheets_exported_at: null },
      orderBy: { created_at: 'asc' },
    });

    if (orders.length === 0) {
      console.log(`${TAG} ⏭️  SKIP — Không có đơn mới`);
      console.log(`${TAG} ⏱️  ${Date.now() - startTime}ms`);
      return NextResponse.json({ skipped: true, message: 'Không có đơn hàng mới', totalOrders: 0 });
    }

    console.log(`${TAG} 📋 ${orders.length} đơn cần xuất`);

    // ── Period label ──
    const oldest = new Date(orders[0].created_at);
    const newest = new Date(orders[orders.length - 1].created_at);
    const periodLabel = oldest.getMonth() === newest.getMonth()
      ? `T${oldest.getMonth() + 1}/${oldest.getFullYear()}`
      : `T${oldest.getMonth() + 1}-T${newest.getMonth() + 1}/${newest.getFullYear()}`;

    console.log(`${TAG} 📅 Period: "${periodLabel}"`);

    // ── Export (với progressive marking) ──
    console.log(`${TAG} 📤 Đang gửi data lên Google Sheets...`);
    const exportStart = Date.now();
    const orderIds = orders.map(o => o.id);

    const result = await exportOrdersToGoogleSheets(
      orders.map(o => ({
        ...o,
        total_price: String(o.total_price),
        created_at: o.created_at,
      })),
      periodLabel,
      // Progressive marking: đánh dấu từng batch ngay khi gửi thành công
      // → Nếu crash giữa chừng, batch đã gửi sẽ không bị gửi lại
      async (batchOrderIds) => {
        await prisma.order.updateMany({
          where: { id: { in: batchOrderIds } },
          data: { sheets_exported_at: new Date() },
        });
        console.log(`${TAG} ✏️  Đã đánh dấu ${batchOrderIds.length} orders (progressive)`);
      },
    );
    const exportDuration = Date.now() - exportStart;

    if (!result.success) {
      console.error(`${TAG} ❌ FAILED (${exportDuration}ms): ${result.error}`);
      await prisma.activityLog.create({
        data: { action: 'EXPORT', count: orders.length, note: `[Google Sheets] Lỗi: ${result.error}` },
      });
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    // ── Log EXPORT ──
    await prisma.activityLog.create({
      data: { action: 'EXPORT', count: orders.length, note: `[Google Sheets] ${orders.length} đơn → "${result.sheetName}"` },
    });

    console.log(`${TAG} ✅ EXPORTED — ${orders.length} đơn → "${result.sheetName}"`);
    console.log(`${TAG} 🔗 ${result.spreadsheetUrl}`);
    console.log(`${TAG} ⏱️  Export: ${exportDuration}ms`);

    // ── Auto-Cleanup: Xóa đơn đã xuất thành công khỏi DB ──
    // Xóa theo danh sách ID cụ thể (không dùng điều kiện mở) → an toàn, không ảnh hưởng đơn mới
    console.log(`${TAG} 🗑️  Auto-cleanup: xóa ${orderIds.length} đơn đã xuất khỏi DB...`);

    // 1. Xóa sync logs trước (FK constraint)
    const deletedSyncLogs = await prisma.orderSyncLog.deleteMany({
      where: { order_id: { in: orderIds } },
    });

    // 2. Xóa orders
    const purgeResult = await prisma.order.deleteMany({
      where: { id: { in: orderIds } },
    });

    // 3. Log PURGE
    await prisma.activityLog.create({
      data: {
        action: 'PURGE',
        count: purgeResult.count,
        note: `[Auto] Dọn ${purgeResult.count} đơn + ${deletedSyncLogs.count} sync logs sau khi xuất Google Sheets "${result.sheetName}"`,
      },
    });

    console.log(`${TAG} 🗑️  Đã xóa ${purgeResult.count} đơn + ${deletedSyncLogs.count} sync logs`);
    console.log(`${TAG} ⏱️  Total: ${Date.now() - startTime}ms`);
    console.log(`${TAG} ──────────────────────────────────────`);

    return NextResponse.json({
      success: true,
      message: `Đã xuất ${orders.length} đơn hàng lên Google Sheets và dọn dẹp DB`,
      sheetName: result.sheetName,
      totalRows: result.totalRows,
      spreadsheetUrl: result.spreadsheetUrl,
      purgedOrders: purgeResult.count,
      purgedSyncLogs: deletedSyncLogs.count,
    });
  } catch (error) {
    console.error(`${TAG} 💥`, error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
