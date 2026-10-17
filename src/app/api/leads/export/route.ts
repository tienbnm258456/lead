import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { LeadStatus, Prisma } from '@prisma/client';

const statusLabels: Record<string, string> = {
  NEW: 'Mới',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Lỗi',
};

// POST /api/leads/export - Export leads to Excel & mark as exported
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, filters } = body;

    let leads;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Export selected leads
      const numericIds = ids.map((id: unknown) => parseInt(String(id))).filter((id: number) => !isNaN(id));
      leads = await prisma.lead.findMany({
        where: { id: { in: numericIds } },
        orderBy: { created_at: 'desc' },
      });
    } else {
      // Export filtered leads
      const where: Prisma.LeadWhereInput = {};

      if (filters?.search) {
        where.OR = [
          { fullname: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters?.status && Object.values(LeadStatus).includes(filters.status)) {
        where.status = filters.status as LeadStatus;
      }

      if (filters?.source) {
        where.source = { contains: filters.source, mode: 'insensitive' };
      }

      if (filters?.dateFrom || filters?.dateTo) {
        where.created_at = {};
        if (filters.dateFrom) {
          where.created_at.gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          const endDate = new Date(filters.dateTo);
          endDate.setHours(23, 59, 59, 999);
          where.created_at.lte = endDate;
        }
      }

      leads = await prisma.lead.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
    }

    if (leads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không có dữ liệu để xuất' },
        { status: 400 }
      );
    }

    // Mark all exported leads with exported_at timestamp
    const exportedIds = leads.map((l) => l.id);
    await prisma.lead.updateMany({
      where: { id: { in: exportedIds } },
      data: { exported_at: new Date() },
    });

    // Log the export action permanently
    await prisma.exportLog.create({
      data: {
        action: 'EXPORT',
        count: leads.length,
        note: `Xuất ${leads.length} lead ra Excel`,
      },
    });

    // Build Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Lead Admin';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Danh sách Lead', {
      headerFooter: { firstHeader: 'Danh sách Lead' },
    });

    // Define columns
    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Họ tên', key: 'fullname', width: 25 },
      { header: 'SĐT', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Ghi chú', key: 'note', width: 30 },
      { header: 'Nguồn', key: 'source', width: 20 },
      { header: 'UTM Source', key: 'utm_source', width: 16 },
      { header: 'UTM Medium', key: 'utm_medium', width: 16 },
      { header: 'Trạng thái', key: 'status', width: 14 },
      { header: 'Ngày tạo', key: 'created_at', width: 20 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 28;

    // Add data rows
    leads.forEach((lead, index) => {
      const row = worksheet.addRow({
        stt: index + 1,
        fullname: lead.fullname,
        phone: lead.phone,
        email: lead.email || '',
        note: lead.note || '',
        source: lead.source,
        utm_source: lead.utm_source || '',
        utm_medium: lead.utm_medium || '',
        status: statusLabels[lead.status] || lead.status,
        created_at: new Date(lead.created_at).toLocaleDateString('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });

      // Alternating row colors
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      row.alignment = { vertical: 'middle' };
      row.height = 22;
    });

    // Add borders to all cells
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="leads_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting leads:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
