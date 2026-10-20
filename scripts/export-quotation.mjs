/**
 * Xuất báo giá dự án ra file Excel chuyên nghiệp
 * Chạy: node scripts/export-quotation.mjs
 */

import ExcelJS from 'exceljs';
import path from 'path';

const OUTPUT_DIR = 'D:\\home\\document';
const FILE_NAME = `Bao_gia_du_an_LadiPage_${new Date().toISOString().slice(0, 10)}.xlsx`;

async function generate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Lead Admin System';
  workbook.created = new Date();

  // ─── COLOR PALETTE ───
  const COLORS = {
    primary: 'FF1E3A5F',      // Dark navy
    primaryLight: 'FF2C5282',  // Medium blue
    accent: 'FF3182CE',       // Bright blue
    success: 'FF38A169',      // Green
    warning: 'FFDD6B20',      // Orange
    danger: 'FFE53E3E',       // Red
    headerBg: 'FF1E3A5F',
    headerText: 'FFFFFFFF',
    moduleBg: 'FFEDF2F7',
    altRow: 'FFF7FAFC',
    borderLight: 'FFCBD5E0',
    borderMedium: 'FFA0AEC0',
    totalBg: 'FFEBF8FF',
    totalBgStrong: 'FFBEE3F8',
    white: 'FFFFFFFF',
    black: 'FF1A202C',
    gray: 'FF718096',
    grayLight: 'FFA0AEC0',
  };

  const thinBorder = { style: 'thin', color: { argb: COLORS.borderLight } };
  const medBorder = { style: 'thin', color: { argb: COLORS.borderMedium } };
  const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  const allMedBorders = { top: medBorder, bottom: medBorder, left: medBorder, right: medBorder };

  // ═══════════════════════════════════════════════════
  // SHEET 1: BÁO GIÁ CHI TIẾT
  // ═══════════════════════════════════════════════════
  const ws = workbook.addWorksheet('Báo giá', {
    properties: { defaultColWidth: 15 },
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
  });

  ws.columns = [
    { key: 'stt', width: 5 },
    { key: 'module', width: 8 },
    { key: 'item', width: 48 },
    { key: 'price', width: 18 },
    { key: 'required', width: 12 },
    { key: 'note', width: 25 },
  ];

  // ── Title block ──
  let row = ws.addRow(['', '', 'BÁO GIÁ PHÁT TRIỂN HỆ THỐNG', '', '', '']);
  ws.mergeCells(row.number, 1, row.number, 6);
  row.getCell(1).font = { bold: true, size: 18, color: { argb: COLORS.primary } };
  row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  row.height = 36;

  row = ws.addRow(['', '', 'Tích hợp API LadiPage + Quản trị Lead', '', '', '']);
  ws.mergeCells(row.number, 1, row.number, 6);
  row.getCell(1).font = { size: 13, color: { argb: COLORS.accent }, italic: true };
  row.getCell(1).alignment = { horizontal: 'center' };
  row.height = 22;

  ws.addRow([]);

  // ── Client info ──
  const infoStyle = { font: { size: 11, color: { argb: COLORS.black } } };
  const infoLabel = { font: { size: 11, color: { argb: COLORS.gray }, bold: true } };

  row = ws.addRow(['', '', 'Kính gửi:', '[Tên khách hàng]', '', '']);
  row.getCell(3).style = infoLabel;
  row.getCell(4).style = infoStyle;

  row = ws.addRow(['', '', 'Ngày:', new Date().toLocaleDateString('vi-VN'), '', '']);
  row.getCell(3).style = infoLabel;
  row.getCell(4).style = infoStyle;

  row = ws.addRow(['', '', 'Hiệu lực:', '30 ngày kể từ ngày báo giá', '', '']);
  row.getCell(3).style = infoLabel;
  row.getCell(4).style = infoStyle;

  ws.addRow([]);

  // ── Section header: CHI TIẾT BÁO GIÁ ──
  row = ws.addRow(['', '', '━━━  CHI TIẾT BÁO GIÁ TỪNG HẠNG MỤC  ━━━', '', '', '']);
  ws.mergeCells(row.number, 1, row.number, 6);
  row.getCell(1).font = { bold: true, size: 12, color: { argb: COLORS.primary } };
  row.getCell(1).alignment = { horizontal: 'center' };
  row.height = 28;

  // ── Table header ──
  const headerRow = ws.addRow(['#', '', 'Hạng mục', 'Đơn giá (VND)', 'Bắt buộc?', 'Ghi chú']);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: COLORS.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = allMedBorders;
  });

  // ── Data rows ──
  const items = [
    { type: 'module', label: 'MODULE 1: API NHẬN DỮ LIỆU' },
    {
      stt: 1, item: 'API nhận data từ 5-6 trang LadiPage',
      detail: '• Validation dữ liệu đầu vào\n• Bảo mật bằng API Key\n• Chống spam (Rate Limiting)',
      price: 1500000, required: '✔ Có', note: 'Core',
    },
    { type: 'module', label: 'MODULE 2: TÍCH HỢP ĐỐI TÁC' },
    {
      stt: 2, item: 'Chuyển tiếp dữ liệu sang hệ thống đối tác',
      detail: '• Gọi API đối tác realtime\n• Xử lý lỗi khi đối tác timeout\n• Lưu trạng thái gửi (thành công/lỗi)',
      price: 2500000, required: '✔ Có', note: 'Core',
    },
    {
      stt: 3, item: 'Tự động gửi lại khi lỗi (Retry)',
      detail: '• Retry tự động 3 lần khi timeout\n• Nút gửi lại thủ công trên Admin',
      price: 1000000, required: 'Tùy chọn', note: 'Khuyến nghị',
    },
    { type: 'module', label: 'MODULE 3: TRANG QUẢN TRỊ ADMIN' },
    {
      stt: 4, item: 'Dashboard thống kê tổng quan + Đăng nhập',
      detail: '• Đăng nhập bảo mật\n• Tổng lead, lead hôm nay, theo nguồn',
      price: 1500000, required: '✔ Có', note: 'Core',
    },
    {
      stt: 5, item: 'Quản lý dữ liệu Lead (CRUD)',
      detail: '• Xem / tìm kiếm / lọc dữ liệu\n• Thêm / sửa / xóa thủ công\n• Theo dõi trạng thái gửi đối tác',
      price: 2000000, required: '✔ Có', note: 'Core',
    },
    {
      stt: 6, item: 'Xuất file Excel',
      detail: '• Xuất toàn bộ hoặc theo bộ lọc\n• File Excel có định dạng chuyên nghiệp',
      price: 500000, required: 'Tùy chọn', note: '',
    },
    {
      stt: 7, item: 'Quản lý dung lượng Database',
      detail: '• Thống kê dung lượng DB\n• Dọn dẹp data cũ đã xuất (1-click)\n• Lịch sử xuất/dọn dẹp vĩnh viễn',
      price: 500000, required: 'Tùy chọn', note: 'Tiết kiệm hosting',
    },
    { type: 'module', label: 'MODULE 4: TRIỂN KHAI & BÀN GIAO' },
    {
      stt: 8, item: 'Setup server + Deploy',
      detail: '• Cài đặt VPS (Node.js, PostgreSQL)\n• Cấu hình domain + SSL (HTTPS)\n• Deploy ứng dụng lên server',
      price: 1500000, required: '✔ Có', note: 'Core',
    },
    {
      stt: 9, item: 'Cấu hình LadiPage webhook (5-6 trang)',
      detail: '• Kết nối từng trang LadiPage → API mới',
      price: 500000, required: '✔ Có', note: 'Core',
    },
    {
      stt: 10, item: 'Hướng dẫn sử dụng + Tài liệu',
      detail: '• Hướng dẫn dùng Admin Dashboard\n• Tài liệu kỹ thuật API',
      price: 500000, required: 'Tùy chọn', note: '',
    },
  ];

  let rowIdx = 0;
  for (const item of items) {
    if (item.type === 'module') {
      // Module header row
      row = ws.addRow(['', '', item.label, '', '', '']);
      ws.mergeCells(row.number, 1, row.number, 6);
      row.getCell(1).font = { bold: true, size: 11, color: { argb: COLORS.primaryLight } };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.moduleBg } };
      row.getCell(1).alignment = { vertical: 'middle' };
      row.getCell(1).border = allBorders;
      row.height = 26;
    } else {
      // Item row
      row = ws.addRow([item.stt, '', item.item, item.price, item.required, item.note || '']);
      row.height = 24;

      // Alternating background
      const bgColor = rowIdx % 2 === 0 ? COLORS.white : COLORS.altRow;
      row.eachCell((cell, colNum) => {
        cell.border = allBorders;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.alignment = { vertical: 'middle' };

        if (colNum === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { bold: true, size: 10, color: { argb: COLORS.gray } };
        } else if (colNum === 3) {
          cell.font = { size: 11, color: { argb: COLORS.black } };
        } else if (colNum === 4) {
          cell.numFmt = '#,##0';
          cell.font = { bold: true, size: 11, color: { argb: COLORS.primary } };
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 5) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = {
            bold: item.required === '✔ Có',
            size: 10,
            color: { argb: item.required === '✔ Có' ? COLORS.success : COLORS.warning },
          };
        } else if (colNum === 6) {
          cell.font = { size: 10, italic: true, color: { argb: COLORS.gray } };
        }
      });

      // Sub-detail row
      if (item.detail) {
        const detailRow = ws.addRow(['', '', item.detail, '', '', '']);
        ws.mergeCells(detailRow.number, 3, detailRow.number, 6);
        detailRow.getCell(3).font = { size: 9, color: { argb: COLORS.grayLight } };
        detailRow.getCell(3).alignment = { wrapText: true, vertical: 'top' };
        detailRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        detailRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        detailRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        detailRow.getCell(1).border = allBorders;
        detailRow.getCell(2).border = allBorders;
        detailRow.getCell(3).border = allBorders;
        const lines = item.detail.split('\n').length;
        detailRow.height = Math.max(15 * lines, 30);
      }

      rowIdx++;
    }
  }

  // ── TOTALS ──
  ws.addRow([]);

  const totalMandatory = 1500000 + 2500000 + 1500000 + 2000000 + 1500000 + 500000; // 9,500,000
  const totalOptional = 1000000 + 500000 + 500000 + 500000; // 2,500,000
  const totalFull = totalMandatory + totalOptional;

  // Mandatory total
  row = ws.addRow(['', '', 'Các hạng mục BẮT BUỘC (1,2,4,5,8,9)', totalMandatory, '', '']);
  ws.mergeCells(row.number, 1, row.number, 2);
  row.getCell(3).font = { size: 11, color: { argb: COLORS.black } };
  row.getCell(4).numFmt = '#,##0';
  row.getCell(4).font = { bold: true, size: 12, color: { argb: COLORS.primary } };
  row.getCell(4).alignment = { horizontal: 'right' };
  row.eachCell((c) => { c.border = allBorders; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } }; });
  row.height = 26;

  // Optional total
  row = ws.addRow(['', '', 'Các hạng mục TÙY CHỌN (3,6,7,10)', totalOptional, '', '']);
  ws.mergeCells(row.number, 1, row.number, 2);
  row.getCell(3).font = { size: 11, color: { argb: COLORS.black } };
  row.getCell(4).numFmt = '#,##0';
  row.getCell(4).font = { bold: true, size: 12, color: { argb: COLORS.warning } };
  row.getCell(4).alignment = { horizontal: 'right' };
  row.eachCell((c) => { c.border = allBorders; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } }; });
  row.height = 26;

  // Grand total
  row = ws.addRow(['', '', '★  TỔNG CỘNG (ĐẦY ĐỦ)', totalFull, '', '']);
  ws.mergeCells(row.number, 1, row.number, 2);
  row.getCell(3).font = { bold: true, size: 13, color: { argb: COLORS.headerText } };
  row.getCell(4).numFmt = '#,##0';
  row.getCell(4).font = { bold: true, size: 14, color: { argb: COLORS.headerText } };
  row.getCell(4).alignment = { horizontal: 'right' };
  row.eachCell((c) => {
    c.border = allMedBorders;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } };
    c.alignment = { ...c.alignment, vertical: 'middle' };
  });
  row.height = 32;

  // ── Maintenance section ──
  ws.addRow([]);
  ws.addRow([]);

  row = ws.addRow(['', '', '━━━  GÓI BẢO TRÌ HÀNG THÁNG  ━━━', '', '', '']);
  ws.mergeCells(row.number, 1, row.number, 6);
  row.getCell(1).font = { bold: true, size: 12, color: { argb: COLORS.primary } };
  row.getCell(1).alignment = { horizontal: 'center' };
  row.height = 28;

  const maintenanceItems = [
    ['', '', 'Phí bảo trì hàng tháng', 1500000, 'Tùy chọn', ''],
    ['', '', '  • Giám sát server hoạt động 24/7', '', '', ''],
    ['', '', '  • Sửa lỗi phát sinh (trong giờ hành chính)', '', '', ''],
    ['', '', '  • Hỗ trợ kỹ thuật qua Zalo / Telegram', '', '', ''],
    ['', '', '  • Cập nhật nhỏ (< 2 giờ/tháng)', '', '', ''],
  ];

  for (let i = 0; i < maintenanceItems.length; i++) {
    row = ws.addRow(maintenanceItems[i]);
    if (i === 0) {
      row.getCell(3).font = { bold: true, size: 11, color: { argb: COLORS.black } };
      row.getCell(4).numFmt = '#,##0';
      row.getCell(4).font = { bold: true, size: 12, color: { argb: COLORS.accent } };
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(5).font = { size: 10, color: { argb: COLORS.warning } };
      row.getCell(5).alignment = { horizontal: 'center' };
    } else {
      row.getCell(3).font = { size: 10, color: { argb: COLORS.gray } };
    }
    row.eachCell((c) => { c.border = allBorders; });
    row.height = 20;
  }

  // ── Hosting costs ──
  ws.addRow([]);
  ws.addRow([]);

  row = ws.addRow(['', '', '━━━  CHI PHÍ HOSTING (KHÁCH HÀNG CHỊ)  ━━━', '', '', '']);
  ws.mergeCells(row.number, 1, row.number, 6);
  row.getCell(1).font = { bold: true, size: 12, color: { argb: COLORS.primary } };
  row.getCell(1).alignment = { horizontal: 'center' };
  row.height = 28;

  const hostingHeader = ws.addRow(['', '', 'Khoản', 'Chi phí (VND)', 'Chu kỳ', 'Ghi chú']);
  hostingHeader.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: COLORS.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = allMedBorders;
  });
  hostingHeader.height = 24;

  const hostingData = [
    ['', '', 'Domain .com', 300000, '/năm', '~25,000/tháng'],
    ['', '', 'VPS Server (2 vCPU / 2 GB RAM)', 250000, '/tháng', 'DigitalOcean / Vultr'],
    ['', '', 'SSL Certificate', 0, '', 'Let\'s Encrypt (miễn phí)'],
  ];

  for (const hd of hostingData) {
    row = ws.addRow(hd);
    row.getCell(3).font = { size: 10, color: { argb: COLORS.black } };
    row.getCell(4).numFmt = '#,##0';
    row.getCell(4).font = { size: 10, color: { argb: COLORS.primary } };
    row.getCell(4).alignment = { horizontal: 'right' };
    row.getCell(5).font = { size: 10, color: { argb: COLORS.gray } };
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).font = { size: 9, italic: true, color: { argb: COLORS.gray } };
    row.eachCell((c) => { c.border = allBorders; });
    row.height = 22;
  }

  // ── Payment terms ──
  ws.addRow([]);
  ws.addRow([]);

  row = ws.addRow(['', '', '━━━  THANH TOÁN & BẢO HÀNH  ━━━', '', '', '']);
  ws.mergeCells(row.number, 1, row.number, 6);
  row.getCell(1).font = { bold: true, size: 12, color: { argb: COLORS.primary } };
  row.getCell(1).alignment = { horizontal: 'center' };
  row.height = 28;

  const paymentData = [
    ['', '', 'Đợt 1: 50% khi ký hợp đồng', '', '', ''],
    ['', '', 'Đợt 2: 30% khi demo thành công', '', '', ''],
    ['', '', 'Đợt 3: 20% khi bàn giao chính thức', '', '', ''],
    ['', '', '', '', '', ''],
    ['', '', 'Thời gian thực hiện: ~2 tuần (10 ngày làm việc)', '', '', ''],
    ['', '', 'Bảo hành: 30 ngày fix bug miễn phí sau bàn giao', '', '', ''],
    ['', '', 'Thay đổi/bổ sung ngoài phạm vi: tính thêm theo thỏa thuận', '', '', ''],
  ];

  for (const pd of paymentData) {
    row = ws.addRow(pd);
    ws.mergeCells(row.number, 3, row.number, 6);
    row.getCell(3).font = { size: 10, color: { argb: pd[2] === '' ? COLORS.white : COLORS.black } };
    row.height = 20;
  }

  // ── Footer ──
  ws.addRow([]);
  row = ws.addRow(['', '', 'Trân trọng cảm ơn Quý khách!', '', '', '']);
  ws.mergeCells(row.number, 1, row.number, 6);
  row.getCell(1).font = { italic: true, size: 11, color: { argb: COLORS.accent } };
  row.getCell(1).alignment = { horizontal: 'center' };

  // ── Save ──
  const outputPath = path.join(OUTPUT_DIR, FILE_NAME);
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Đã xuất file: ${outputPath}`);
}

generate().catch(console.error);
