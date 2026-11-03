/** Annual Google Drive files and monthly product tabs. See google_sheets_setup.md. */
export interface SheetDestination {
  year: number; sheetName: string; spreadsheetUrl: string; totalRows: number;
}
export interface SheetExportResult {
  success: boolean; sheetName: string; totalRows: number; spreadsheetUrl: string;
  destinations?: SheetDestination[]; error?: string;
}
export interface OrderForExport {
  id: number; external_id: string; customer_name: string; customer_phone: string;
  delivery_address: string; total_price: string | number;
  selected_package: string | null; selected_size: string | null;
  landing_slug: string | null; sync_status: string; retailcrm_id: number | null;
  items_json?: string; created_at: Date | string;
}
export const SHEET_HEADERS = [
  'Tên (bắt buộc)', 'Số điện thoại', 'E-mail', 'Đăng ký nhận email (có/không)',
  'Ngày đặt hàng', 'ExternalId đơn hàng', 'Loại đơn hàng', 'Trạng thái đơn hàng',
  'Tên sản phẩm', 'Số lượng sản phẩm', 'Giá sản phẩm', 'Phí vận chuyển', 'Tổng tiền',
  'Địa chỉ giao hàng', 'Trạng thái thanh toán', 'Ghi chú đơn hàng',
];
type Cell = string | number;
interface Item {
  productName?: string; variantLabel?: string; quantity?: number; initialPrice?: number;
  deliveryFee?: number; promotion?: string; size?: string;
}
interface ExportGroup {
  year: number; month: string; productKey: string; productName: string;
  orders: { id: number; rows: Cell[][]; rowKeys: string[] }[];
}
const STATUS: Record<string, string> = { SUCCESS: 'Thành công', PENDING: 'Chờ đồng bộ', FAILED: 'Lỗi', TIMEOUT: 'Hết thời gian' };
function config() {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new Error('Thiếu GOOGLE_APPS_SCRIPT_URL hoặc GOOGLE_APPS_SCRIPT_SECRET');
  return { url, secret };
}
/** Routing uses the order creation date in a fixed timezone, never the export date. */
export function groupSheetOrders(orders: OrderForExport[], timeZone = process.env.SHEETS_EXPORT_TIMEZONE || 'Asia/Bangkok'): ExportGroup[] {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit' });
  const groups = new Map<string, ExportGroup>();
  for (const order of orders) {
    const created = new Date(order.created_at);
    if (!Number.isFinite(created.getTime())) throw new Error('Ngày tạo đơn không hợp lệ: ' + order.external_id);
    const parts = formatter.formatToParts(created);
    const year = Number(parts.find(p => p.type === 'year')!.value);
    const month = parts.find(p => p.type === 'month')!.value;
    let items: Item[];
    try {
      const parsed: unknown = JSON.parse(order.items_json || '[]');
      if (!Array.isArray(parsed) || !parsed.length || parsed.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error();
      items = parsed;
    } catch { throw new Error('Chi tiết dòng hàng không hợp lệ: ' + order.external_id); }
    // Current order model contains one product with one or more combo variants.
    const productName = items[0].productName || order.landing_slug || 'Khác';
    const productKey = order.landing_slug || productName;
    const key = JSON.stringify([year, month, productKey]);
    let group = groups.get(key);
    if (!group) {
      group = { year, month, productKey, productName, orders: [] };
      groups.set(key, group);
    }
    const rows = items.map((item, index): Cell[] => [
      order.customer_name, order.customer_phone, '', 'không',
      created.toLocaleString('vi-VN', { timeZone }), order.external_id,
      item.productName || productName, STATUS[order.sync_status] || order.sync_status,
      item.variantLabel || item.productName || '', item.quantity || 1,
      Number(item.initialPrice) || 0, Number(item.deliveryFee) || 0,
      index === 0 ? Number(order.total_price) : 0, order.delivery_address, 'Chưa thanh toán',
      [order.selected_package ? 'Gói: ' + order.selected_package : '',
        item.promotion ? 'Khuyến mại: ' + item.promotion : '',
        item.size || order.selected_size ? 'Size: ' + (item.size || order.selected_size) : '',
      ].filter(Boolean).join(' | '),
    ]);
    group.orders.push({ id: order.id, rows, rowKeys: items.map((_, index) =>
      (process.env.GOOGLE_SHEETS_SOURCE || 'lead-admin') + ':' + order.external_id + ':' + order.id + ':' + index) });
  }
  return [...groups.values()];
}
/** Never split an order between batches: mark it only after all its rows are acknowledged. */
export function sheetBatches(group: ExportGroup, maxRows = 5000) {
  const batches: { data: Cell[][]; rowKeys: string[]; orderIds: number[] }[] = [];
  let batch = { data: [] as Cell[][], rowKeys: [] as string[], orderIds: [] as number[] };
  for (const order of group.orders) {
    if (order.rows.length > maxRows) throw new Error('Một đơn vượt giới hạn ' + maxRows + ' dòng');
    if (batch.data.length + order.rows.length > maxRows) { batches.push(batch); batch = { data: [], rowKeys: [], orderIds: [] }; }
    batch.data.push(...order.rows); batch.rowKeys.push(...order.rowKeys); batch.orderIds.push(order.id);
  }
  if (batch.data.length) batches.push(batch);
  return batches;
}
export async function exportOrdersToGoogleSheets(
  orders: OrderForExport[],
  _periodLabel?: string,
  onBatchSuccess?: (batchOrderIds: number[]) => Promise<void>,
): Promise<SheetExportResult> {
  try {
    const { url, secret } = config();
    const groups = groupSheetOrders(orders);
    // Validate all groups before sending any request.
    const planned = groups.map(group => ({ group, batches: sheetBatches(group) }));
    const destinations: SheetDestination[] = [];
    for (const { group, batches } of planned) {
      let destination: SheetDestination | undefined;
      for (const batch of batches) {
        const response = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ protocolVersion: 2, action: 'export', secret,
            year: group.year, month: group.month, productKey: group.productKey, productName: group.productName,
            headers: SHEET_HEADERS, data: batch.data, rowKeys: batch.rowKeys }),
          signal: AbortSignal.timeout(300000),
        });
        if (!response.ok) throw new Error('Apps Script HTTP ' + response.status);
        const result = await response.json();
        if (result.success !== true || result.protocolVersion !== 2 || result.year !== group.year ||
          result.productKey !== group.productKey || result.month !== group.month ||
          result.acceptedRows !== batch.data.length || !result.spreadsheetUrl || !result.sheetName) {
          throw new Error(result.error || 'Apps Script chưa cập nhật v2 hoặc xác nhận dữ liệu không khớp');
        }
        if (onBatchSuccess) await onBatchSuccess(batch.orderIds);
        destination = { year: group.year, sheetName: result.sheetName, spreadsheetUrl: result.spreadsheetUrl,
          totalRows: (destination?.totalRows || 0) + batch.data.length };
      }
      if (destination) destinations.push(destination);
    }
    return { success: true, sheetName: destinations.map(d => d.sheetName).join(', '),
      totalRows: destinations.reduce((sum, d) => sum + d.totalRows, 0),
      spreadsheetUrl: destinations[0]?.spreadsheetUrl || '', destinations };
  } catch (error) {
    return { success: false, sheetName: '', totalRows: 0, spreadsheetUrl: '',
      error: error instanceof Error ? error.message : String(error) };
  }
}
export async function testGoogleSheetsConnection(): Promise<{ connected: boolean; title?: string; error?: string }> {
  try {
    const { url, secret } = config();
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping', protocolVersion: 2, secret }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!data.success || data.protocolVersion !== 2) throw new Error(data.error || 'Apps Script chưa cập nhật v2');
    return { connected: true, title: data.spreadsheetTitle };
  } catch (error) { return { connected: false, error: error instanceof Error ? error.message : String(error) }; }
}
