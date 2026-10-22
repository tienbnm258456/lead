import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { requireAuth } from '@/lib/require-auth';

/**
 * GET /api/orders/export
 * Xuất đơn hàng ra file Excel (.xlsx) với format đẹp.
 *
 * Query params (bộ lọc — giống /api/orders):
 *   - mode:        "all" (chia sheet theo sản phẩm) | "filtered" (1 sheet)
 *   - search:      tìm theo tên/SĐT/mã đơn
 *   - status:      lọc theo trạng thái sync
 *   - landingSlug: lọc theo sản phẩm
 *   - dateFrom:    từ ngày (YYYY-MM-DD)
 *   - dateTo:      đến ngày (YYYY-MM-DD)
 *
 * Side-effect: Đánh dấu exported_at + ghi ActivityLog.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = request.nextUrl;
    const mode = searchParams.get('mode') || 'all';
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const landingSlug = searchParams.get('landingSlug') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    // ── Build Prisma where clause ──
    const where: Prisma.OrderWhereInput = {};

    if (search) {
      where.OR = [
        { customer_name: { contains: search, mode: 'insensitive' } },
        { customer_phone: { contains: search, mode: 'insensitive' } },
        { external_id: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.sync_status = status as Prisma.EnumOrderSyncStatusFilter;
    if (landingSlug) where.landing_slug = landingSlug;
    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) (where.created_at as Prisma.DateTimeFilter).gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        (where.created_at as Prisma.DateTimeFilter).lte = end;
      }
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    if (orders.length === 0) {
      return NextResponse.json({ success: false, error: 'Không có đơn hàng nào để xuất' }, { status: 404 });
    }

    // ── Build Excel workbook ──
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Lead Management System';
    workbook.created = new Date();

    const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '_');

    // ── Status mapping: DB → Russian label ──
    const STATUS_MAP: Record<string, string> = {
      SUCCESS: 'Thành công',
      PENDING: 'Chờ đồng bộ',
      FAILED: 'Lỗi',
      TIMEOUT: 'Hết thời gian',
    };

    // ── Parse items_json helper ──
    const parseItems = (json: string) => {
      try {
        const items = JSON.parse(json);
        if (Array.isArray(items) && items.length > 0) return items[0];
      } catch { /* ignore */ }
      return { productName: '', quantity: 1, initialPrice: 0, deliveryFee: 0 };
    };

    // ── Columns: Format RetailCRM (13 cột A-M) ──
    const COLUMNS: Partial<ExcelJS.Column>[] = [
      { header: 'Tên (bắt buộc)', key: 'firstName', width: 22 },
      { header: 'Số điện thoại', key: 'phone', width: 18 },
      { header: 'E-mail', key: 'email', width: 22 },
      { header: 'Đăng ký nhận email (có/không)', key: 'emailSub', width: 18 },
      { header: 'Ngày đặt hàng', key: 'orderDate', width: 20 },
      { header: 'ExternalId đơn hàng', key: 'orderExtId', width: 18 },
      { header: 'Loại đơn hàng', key: 'orderType', width: 22 },
      { header: 'Trạng thái đơn hàng', key: 'orderStatus', width: 16 },
      { header: 'Tên sản phẩm', key: 'productName', width: 30 },
      { header: 'Số lượng sản phẩm', key: 'quantity', width: 14 },
      { header: 'Giá sản phẩm', key: 'salePrice', width: 18 },
      { header: 'Phí vận chuyển', key: 'deliveryFee', width: 16 },
      { header: 'Tổng tiền', key: 'totalPrice', width: 18 },
      { header: 'Địa chỉ giao hàng', key: 'deliveryAddr', width: 35 },
      { header: 'Trạng thái thanh toán', key: 'paymentStatus', width: 16 },
      { header: 'Ghi chú đơn hàng', key: 'comment', width: 35 },
    ];

    const styleHeader = (ws: ExcelJS.Worksheet) => {
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 32;

      // Auto-filter (A1 → P1 = 16 cột)
      ws.autoFilter = { from: 'A1', to: 'P1' };

      // Freeze header row
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    };

    const addOrderRow = (ws: ExcelJS.Worksheet, order: typeof orders[0], index: number) => {
      const item = parseItems(order.items_json);
      const deliveryFee = Number(item.deliveryFee) || 0;
      const productPrice = Number(item.initialPrice) || 0;

      // Ghép ghi chú từ gói SP + tùy chọn (không có LP vì đã tách cột riêng)
      const commentParts = [];
      if (order.selected_package) commentParts.push(`Gói: ${order.selected_package}`);
      if (order.selected_size) commentParts.push(`Size: ${order.selected_size}`);

      const row = ws.addRow({
        firstName: order.customer_name,
        phone: order.customer_phone,
        email: '',
        emailSub: 'không',
        orderDate: new Date(order.created_at).toLocaleString('vi-VN'),
        orderExtId: order.external_id,
        orderType: item.productName || order.landing_slug || '',
        orderStatus: STATUS_MAP[order.sync_status] || order.sync_status,
        productName: item.variantLabel || item.productName || '',
        quantity: item.quantity || 1,
        salePrice: productPrice,
        deliveryFee: deliveryFee,
        totalPrice: Number(order.total_price),
        deliveryAddr: order.delivery_address,
        paymentStatus: 'Chưa thanh toán',
        comment: commentParts.join(', '),
      });

      // Style alternate rows
      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        });
      }

      // Borders
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });

      // Tô màu trạng thái
      const statusCell = row.getCell('orderStatus');
      switch (order.sync_status) {
        case 'SUCCESS':
          statusCell.font = { color: { argb: 'FF16A34A' }, bold: true };
          break;
        case 'FAILED':
          statusCell.font = { color: { argb: 'FFDC2626' }, bold: true };
          break;
        case 'TIMEOUT':
          statusCell.font = { color: { argb: 'FFEA580C' }, bold: true };
          break;
        case 'PENDING':
          statusCell.font = { color: { argb: 'FFD97706' }, bold: true };
          break;
      }

      return row;
    };

    const formatSheet = (ws: ExcelJS.Worksheet) => {
      // Force phone column to text format
      ws.getColumn('phone').numFmt = '@';
      // Price column to number format with thousands separator
      ws.getColumn('salePrice').numFmt = '#,##0';
      ws.getColumn('quantity').alignment = { horizontal: 'center' };
    };

    if (mode === 'all' && !landingSlug) {
      // ── MODE: ALL → Chia sheet theo sản phẩm ──
      const grouped = new Map<string, typeof orders>();
      for (const order of orders) {
        const slug = order.landing_slug || 'khac';
        if (!grouped.has(slug)) grouped.set(slug, []);
        grouped.get(slug)!.push(order);
      }

      for (const [slug, groupOrders] of grouped) {
        const sheetName = `${slug}_${today}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 31);
        const ws = workbook.addWorksheet(sheetName);
        ws.columns = COLUMNS;
        styleHeader(ws);
        groupOrders.forEach((order, idx) => addOrderRow(ws, order, idx));
        formatSheet(ws);
      }
    } else {
      // ── MODE: FILTERED → 1 sheet ──
      const sheetName = landingSlug
        ? `${landingSlug}_${today}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 31)
        : `don_hang_${today}`;
      const ws = workbook.addWorksheet(sheetName);
      ws.columns = COLUMNS;
      styleHeader(ws);
      orders.forEach((order, idx) => addOrderRow(ws, order, idx));
      formatSheet(ws);
    }

    // ── Mark as exported ──
    const now = new Date();
    const notExportedIds = orders.filter(o => !o.exported_at).map(o => o.id);
    if (notExportedIds.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: notExportedIds } },
        data: { exported_at: now },
      });
    }

    // ── Log activity ──
    const filterDesc = [
      landingSlug && `SP: ${landingSlug}`,
      status && `Trạng thái: ${status}`,
      dateFrom && `Từ: ${dateFrom}`,
      dateTo && `Đến: ${dateTo}`,
      search && `Tìm: ${search}`,
    ].filter(Boolean).join(', ');

    await prisma.activityLog.create({
      data: {
        action: 'EXPORT',
        count: orders.length,
        note: `Xuất ${orders.length} đơn hàng${filterDesc ? ` (${filterDesc})` : ''}`,
      },
    });

    // ── Generate buffer & respond ──
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `orders_${today}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
