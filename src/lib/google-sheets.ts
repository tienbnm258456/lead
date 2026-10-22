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
  items_json?: string;
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

    // Format data rows — RetailCRM tiếng Nga (22 cột A-V)
    const exportTimestamp = new Date().toLocaleString('vi-VN');

    const STATUS_MAP: Record<string, string> = {
      SUCCESS: 'Thành công',
      PENDING: 'Chờ đồng bộ',
      FAILED: 'Lỗi',
      TIMEOUT: 'Hết thời gian',
    };

    const parseItems = (json: string | undefined) => {
      try {
        if (!json) return { productName: '', quantity: 1, initialPrice: 0, deliveryFee: 0 };
        const items = JSON.parse(json);
        if (Array.isArray(items) && items.length > 0) return items[0];
      } catch { /* ignore */ }
      return { productName: '', quantity: 1, initialPrice: 0, deliveryFee: 0 };
    };

    const headers = [
      'Tên (bắt buộc)', 'Số điện thoại',
      'E-mail', 'Đăng ký nhận email (có/không)',
      'Ngày đặt hàng', 'ExternalId đơn hàng', 'Loại đơn hàng', 'Trạng thái đơn hàng',
      'Tên sản phẩm', 'Số lượng sản phẩm', 'Giá sản phẩm',
      'Phí vận chuyển', 'Tổng tiền',
      'Địa chỉ giao hàng', 'Trạng thái thanh toán', 'Ghi chú đơn hàng',
    ];

    // statusColIndex (0-based) = 7 → cột H (Trạng thái đơn hàng) — shifted do thêm 'Loại đơn hàng'
    const statusColIndex = 7;

    const rows = orders.map((order, idx) => {
      const item = parseItems(order.items_json);
      const deliveryFee = Number(item.deliveryFee) || 0;
      const productPrice = Number(item.initialPrice) || 0;

      const commentParts = [];
      if (order.selected_package) commentParts.push(`Gói: ${order.selected_package}`);
      if (order.selected_size) commentParts.push(`Size: ${order.selected_size}`);

      return [
        order.customer_name,                                    // A: Tên
        order.customer_phone,                                   // B: Số điện thoại
        '',                                                     // C: E-mail
        'không',                                                // D: Đăng ký email
        new Date(order.created_at).toLocaleString('vi-VN'),     // E: Ngày đặt hàng
        order.external_id,                                      // F: ExternalId đơn hàng
        item.productName || order.landing_slug || '',            // G: Loại đơn hàng
        STATUS_MAP[order.sync_status] || order.sync_status,     // H: Trạng thái đơn hàng
        item.variantLabel || item.productName || '',             // I: Tên sản phẩm
        item.quantity || 1,                                     // J: Số lượng
        productPrice,                                           // K: Giá sản phẩm
        deliveryFee,                                            // L: Phí vận chuyển
        Number(order.total_price),                              // M: Tổng tiền
        order.delivery_address,                                 // N: Địa chỉ giao hàng
        'Chưa thanh toán',                                      // O: Trạng thái thanh toán
        commentParts.join(', '),                                // P: Ghi chú
      ];
    });

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
