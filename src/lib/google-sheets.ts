/**
 * Google Sheets Integration via Google Apps Script
 *
 * Đẩy dữ liệu đơn hàng lên Google Sheets thông qua Apps Script Web App.
 * KHÔNG cần Google Cloud Console, KHÔNG cần thẻ credit/debit.
 *
 * Setup (chỉ cần tài khoản Google thường):
 *   1. Tạo Google Spreadsheet mới
 *   2. Extensions → Apps Script → paste đoạn script bên dưới
 *   3. Deploy → New Deployment → Web App → Anyone → Deploy
 *   4. Copy Web App URL → paste vào GOOGLE_APPS_SCRIPT_URL trong .env
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ APPS SCRIPT CODE (paste vào Google Apps Script editor):             │
 * │                                                                      │
 * │ Xem file: src/lib/google-apps-script.js                             │
 * │ (Hoặc xem hướng dẫn trong artifact google_sheets_setup.md)          │
 * └──────────────────────────────────────────────────────────────────────┘
 */

// ── Types ─────────────────────────────────────────────────────
export interface SheetExportResult {
  success: boolean;
  sheetName: string;
  totalRows: number;
  spreadsheetUrl: string;
  error?: string;
}

export interface OrderForExport {
  id: number;
  external_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  total_price: string | number;
  selected_package: string | null;
  selected_size: string | null;
  landing_slug: string | null;
  sync_status: string;
  retailcrm_id: number | null;
  created_at: Date | string;
}

// ── Config ────────────────────────────────────────────────────
function getWebAppUrl(): string {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!url) {
    throw new Error('Missing GOOGLE_APPS_SCRIPT_URL env variable');
  }
  return url;
}

// ── Main Export Function ──────────────────────────────────────

/**
 * Xuất danh sách đơn hàng lên Google Sheets qua Apps Script Web App.
 *
 * Gửi data theo batch 5,000 rows/request để tránh Apps Script timeout (6 phút).
 *
 * @param orders - Mảng đơn hàng từ DB
 * @param periodLabel - Label cho kỳ xuất (vd: "T10-T12/2026")
 */
export async function exportOrdersToGoogleSheets(
  orders: OrderForExport[],
  periodLabel?: string,
): Promise<SheetExportResult> {
  try {
    const webAppUrl = getWebAppUrl();

    // Generate period label
    const now = new Date();
    const label = periodLabel || `T${now.getMonth() + 1}/${now.getFullYear()}`;
    const sheetName = `Đơn hàng ${label}`;

    console.log(`[GoogleSheets] Exporting ${orders.length} orders → "${sheetName}"`);

    // Format data rows
    const exportTimestamp = new Date().toLocaleString('vi-VN');
    const headers = [
      'STT', 'Mã đơn', 'Tên khách', 'SĐT', 'Địa chỉ',
      'Tổng tiền (UZS)', 'Gói SP', 'Tùy chọn', 'Landing Page',
      'Trạng thái', 'RetailCRM ID', 'Ngày tạo', 'Đợt xuất',
    ];

    // statusColIndex (0-based) = 9 → cột J (Trạng thái)
    const statusColIndex = 9;

    const rows = orders.map((order, idx) => [
      idx + 1, // STT tạm — Apps Script sẽ tính lại khi append
      order.external_id,
      order.customer_name,
      order.customer_phone,
      order.delivery_address,
      Number(order.total_price),
      order.selected_package || '',
      order.selected_size || '',
      order.landing_slug || '',
      order.sync_status,
      order.retailcrm_id || '',
      new Date(order.created_at).toLocaleString('vi-VN'),
      exportTimestamp, // Đợt xuất — cùng timestamp cho toàn bộ batch
    ]);

    // Send in batches (5,000 rows per request to stay under Apps Script limits)
    const BATCH_SIZE = 5_000;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    let spreadsheetUrl = '';

    for (let i = 0; i < totalBatches; i++) {
      const batch = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const isFirstBatch = i === 0;

      const payload = {
        action: 'export',
        sheetName,
        headers: isFirstBatch ? headers : null, // Chỉ gửi header lần đầu
        data: batch,
        batchIndex: i,
        totalBatches,
        statusColIndex, // Cột trạng thái (0-based) → Apps Script sẽ tô màu
      };

      console.log(`[GoogleSheets] Sending batch ${i + 1}/${totalBatches}: ${batch.length} rows`);

      const res = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(300_000), // 5 phút timeout
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Apps Script responded ${res.status}: ${text}`);
      }

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.spreadsheetUrl) {
        spreadsheetUrl = result.spreadsheetUrl;
      }
    }

    console.log(`[GoogleSheets] ✅ Exported ${orders.length} orders → ${spreadsheetUrl}`);

    return {
      success: true,
      sheetName,
      totalRows: orders.length,
      spreadsheetUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[GoogleSheets] ❌ Export failed:`, message);
    return {
      success: false,
      sheetName: '',
      totalRows: 0,
      spreadsheetUrl: '',
      error: message,
    };
  }
}

/**
 * Kiểm tra kết nối tới Apps Script Web App
 */
export async function testGoogleSheetsConnection(): Promise<{ connected: boolean; title?: string; error?: string }> {
  try {
    const webAppUrl = getWebAppUrl();

    const res = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping' }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      connected: true,
      title: data.spreadsheetTitle || 'Connected',
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
