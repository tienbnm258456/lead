/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GOOGLE APPS SCRIPT — Nhận đơn hàng từ Lead Admin           ║
 * ║                                                              ║
 * ║  Paste toàn bộ code này vào Google Apps Script editor        ║
 * ║  (Extensions → Apps Script trong Google Sheets)              ║
 * ║                                                              ║
 * ║  Sau đó: Deploy → New deployment → Web app                  ║
 * ║    - Execute as: Me                                          ║
 * ║    - Who has access: Anyone                                  ║
 * ║  → Copy URL → paste vào .env GOOGLE_APPS_SCRIPT_URL          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

/**
 * Xử lý POST request từ server
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    if (action === 'ping') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      return jsonResponse({
        success: true,
        spreadsheetTitle: ss.getName(),
        spreadsheetUrl: ss.getUrl()
      });
    }

    if (action === 'export') {
      return handleExport(payload);
    }

    return jsonResponse({ error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

/**
 * Xử lý export data vào sheet
 * 
 * Logic:
 *   - Nếu sheet cùng tên đã tồn tại → APPEND thêm rows (không tạo mới)
 *   - STT được tính lại liên tục (1, 2, 3... tiếp nối từ dữ liệu cũ)
 *   - Cột "Đợt xuất" cho biết rows nào được thêm lần nào
 */
function handleExport(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = payload.sheetName || 'Import ' + new Date().toLocaleDateString('vi-VN');
  var headers = payload.headers;
  var data = payload.data;
  var batchIndex = payload.batchIndex || 0;
  var statusColIndex = payload.statusColIndex; // 0-based index

  var sheet = null;
  var isNewSheet = false;

  // ── Batch đầu tiên: tạo sheet mới HOẶC append vào sheet cũ ──
  if (batchIndex === 0) {
    var existingSheet = ss.getSheetByName(sheetName);

    if (existingSheet) {
      // ── APPEND MODE: Sheet đã tồn tại → dùng lại ──
      sheet = existingSheet;
      isNewSheet = false;
      Logger.log('APPEND mode: Sheet "' + sheetName + '" đã tồn tại, append thêm data');
    } else {
      // ── NEW MODE: Tạo sheet mới ──
      sheet = ss.insertSheet(sheetName);
      isNewSheet = true;

      // Ghi header
      if (headers && headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setFontSize(10);
        headerRange.setBackground('#334488');
        headerRange.setFontColor('#FFFFFF');
        headerRange.setHorizontalAlignment('center');
        headerRange.setVerticalAlignment('middle');
        headerRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
        sheet.setFrozenRows(1);
        sheet.setRowHeight(1, 32);
      }

      // Wrap text toàn sheet
      sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    }
  } else {
    // Batch 2+ → lấy sheet đã tạo/đang dùng
    sheet = ss.getSheetByName(sheetName);
  }

  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + sheetName });
  }

  // ── Ghi data ──
  if (data && data.length > 0) {
    var lastRow = sheet.getLastRow();
    var existingDataRows = lastRow > 0 ? lastRow - 1 : 0; // Trừ header

    // Tính lại STT liên tục từ dữ liệu cũ
    for (var i = 0; i < data.length; i++) {
      data[i][0] = existingDataRows + i + 1; // STT = existing + offset
    }

    // Ghi data
    var range = sheet.getRange(lastRow + 1, 1, data.length, data[0].length);
    range.setValues(data);
    range.setVerticalAlignment('top');
    range.setFontSize(10);
    range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

    // ── Tô màu cột Trạng thái ──
    if (statusColIndex !== undefined && statusColIndex !== null) {
      colorStatusCells(sheet, lastRow + 1, data, statusColIndex);
    }

    // ── Highlight "Đợt xuất" cột cuối nếu append ──
    if (!isNewSheet && batchIndex === 0) {
      // Tô nền nhẹ cho rows mới để phân biệt với rows cũ
      var exportColIndex = data[0].length; // Cột cuối cùng (1-based)
      var newRowsRange = sheet.getRange(lastRow + 1, exportColIndex, data.length, 1);
      newRowsRange.setFontColor('#1967D2'); // Xanh dương đậm
      newRowsRange.setFontWeight('bold');
    }
  }

  // ── Batch cuối cùng → format final ──
  var totalBatches = payload.totalBatches || 1;
  if (batchIndex === totalBatches - 1) {
    formatFinal(sheet, headers, data);
  }

  return jsonResponse({
    success: true,
    sheetName: sheetName,
    isAppend: !isNewSheet,
    rowsWritten: data ? data.length : 0,
    totalRows: sheet.getLastRow() - 1,
    spreadsheetUrl: ss.getUrl() + '#gid=' + sheet.getSheetId(),
    batchIndex: batchIndex
  });
}

/**
 * Tô màu cells theo trạng thái
 */
function colorStatusCells(sheet, startRow, data, statusColIndex) {
  var statusCol = statusColIndex + 1; // 0-based → 1-based

  for (var r = 0; r < data.length; r++) {
    var status = String(data[r][statusColIndex]);
    var statusUpper = status.toUpperCase();
    var cell = sheet.getRange(startRow + r, statusCol);
    cell.setFontWeight('bold');

    // Match cả giá trị DB (SUCCESS/FAILED/PENDING/TIMEOUT) lẫn tiếng Việt
    if (statusUpper === 'SUCCESS' || status === 'Thành công') {
      cell.setFontColor('#188038');
      cell.setBackground('#E6F4EA');
    } else if (statusUpper === 'FAILED' || status === 'Lỗi') {
      cell.setFontColor('#C5221F');
      cell.setBackground('#FCE8E6');
    } else if (statusUpper === 'PENDING' || status === 'Chờ đồng bộ') {
      cell.setFontColor('#E37400');
      cell.setBackground('#FEF7E0');
    } else if (statusUpper === 'TIMEOUT' || status === 'Hết thời gian') {
      cell.setFontColor('#9334E6');
      cell.setBackground('#F3E8FD');
    }
  }
}

/**
 * Format cuối cùng: column widths, number format, borders
 */
function formatFinal(sheet, headers, data) {
  var numCols = headers ? headers.length : (data && data.length > 0 ? data[0].length : 1);

  // Column widths (13 cột A-M)
  var colWidths = {
    1: 160,   // A: Tên
    2: 130,   // B: SĐT
    3: 180,   // C: E-mail
    4: 100,   // D: Đăng ký email
    5: 160,   // E: Ngày đặt hàng
    6: 140,   // F: ExternalId đơn hàng
    7: 130,   // G: Trạng thái đơn hàng
    8: 200,   // H: Tên sản phẩm
    9: 80,    // I: Số lượng
    10: 120,  // J: Giá bán
    11: 250,  // K: Địa chỉ giao hàng
    12: 130,  // L: Trạng thái thanh toán
    13: 250,  // M: Ghi chú
  };

  for (var col in colWidths) {
    if (parseInt(col) <= numCols) {
      sheet.setColumnWidth(parseInt(col), colWidths[col]);
    }
  }

  // Format cột Tổng tiền dạng số
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 6, sheet.getLastRow() - 1, 1).setNumberFormat('#,##0');
  }

  // Zebra stripes
  if (sheet.getLastRow() > 1) {
    for (var row = 2; row <= sheet.getLastRow(); row++) {
      if (row % 2 === 0) {
        // Chỉ set background nếu cell chưa có background đặc biệt (status)
        var existingBg = sheet.getRange(row, 1).getBackground();
        if (existingBg === '#ffffff' || existingBg === null) {
          sheet.getRange(row, 1, 1, numCols).setBackground('#F8F9FA');
        }
      }
    }
  }

  // Borders
  sheet.getRange(1, 1, sheet.getLastRow(), numCols)
    .setBorder(true, true, true, true, true, true, '#DADCE0', SpreadsheetApp.BorderStyle.SOLID);

  Logger.log('Final format done. Total rows: ' + (sheet.getLastRow() - 1));
}

/**
 * JSON response helper
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET handler (test URL trong browser)
 */
function doGet() {
  return jsonResponse({
    status: 'ok',
    message: 'Lead Admin Sheets Export — Apps Script is running',
    time: new Date().toISOString()
  });
}
