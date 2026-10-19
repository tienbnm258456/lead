import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';

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

    const COLUMNS: Partial<ExcelJS.Column>[] = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Mã đơn', key: 'external_id', width: 16 },
      { header: 'Tên khách hàng', key: 'customer_name', width: 22 },
      { header: 'Số điện thoại', key: 'customer_phone', width: 18 },
      { header: 'Địa chỉ', key: 'delivery_address', width: 35 },
      { header: 'Gói sản phẩm', key: 'selected_package', width: 30 },
      { header: 'Tùy chọn phụ', key: 'selected_size', width: 15 },
      { header: 'Tổng tiền (UZS)', key: 'total_price', width: 18 },
      { header: 'Nguồn', key: 'source', width: 14 },
      { header: 'Trạng thái sync', key: 'sync_status', width: 16 },
      { header: 'RetailCRM ID', key: 'retailcrm_id', width: 14 },
      { header: 'Ngày tạo', key: 'created_at', width: 20 },
    ];

    const styleHeader = (ws: ExcelJS.Worksheet) => {
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 28;

      // Auto-filter
      ws.autoFilter = { from: 'A1', to: `L1` };

      // Freeze header row
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    };

    const addOrderRow = (ws: ExcelJS.Worksheet, order: typeof orders[0], index: number) => {
      const row = ws.addRow({
        stt: index + 1,
        external_id: order.external_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone, // Will force text format below
        delivery_address: order.delivery_address,
        selected_package: order.selected_package || '',
        selected_size: order.selected_size || '',
        total_price: Number(order.total_price),
        source: order.source,
        sync_status: order.sync_status,
        retailcrm_id: order.retailcrm_id || '',
        created_at: new Date(order.created_at).toLocaleString('vi-VN'),
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

      return row;
    };

    const formatSheet = (ws: ExcelJS.Worksheet) => {
      // Force phone column to text format
      ws.getColumn('customer_phone').numFmt = '@';
      // Price column to number format with thousands separator
      ws.getColumn('total_price').numFmt = '#,##0';
      // STT column centered
      ws.getColumn('stt').alignment = { horizontal: 'center' };
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
