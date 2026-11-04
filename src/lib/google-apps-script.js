/** Paste into one Apps Script project. Setup: google_sheets_setup.md. */
var EXPORT_KEY_HEADER = '_ExportRowId';
function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function settings() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('EXPORT_FOLDER_ID');
  var secret = props.getProperty('EXPORT_SECRET');
  if (!folderId || !secret) throw new Error('Set EXPORT_FOLDER_ID and EXPORT_SECRET in Script Properties');
  return { props: props, folder: DriveApp.getFolderById(folderId), secret: secret,
    prefix: props.getProperty('EXPORT_FILE_PREFIX') || 'Lead Admin' };
}
/** Run once in the editor to authorize Drive + Sheets access; does not export orders. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Google Apps Script entry point
function checkSetup() {
  var cfg = settings();
  // Touch both services so the editor requests all necessary permissions.
  SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('Setup OK: ' + cfg.folder.getName() + ' | File prefix: ' + cfg.prefix);
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Google Apps Script entry point
function doPost(e) {
  var lock;
  try {
    var payload = JSON.parse(e.postData.contents);
    var cfg = settings();
    if (payload.secret !== cfg.secret) throw new Error('Unauthorized');
    if (payload.protocolVersion !== 2) throw new Error('Expected export protocolVersion 2');
    if (payload.action === 'ping') return jsonResponse({ success: true, protocolVersion: 2, spreadsheetTitle: cfg.prefix });
    if (payload.action !== 'export') throw new Error('Unknown action');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) throw new Error('Export busy; retry later');
    return jsonResponse(handleExport(payload, cfg));
  } catch (error) {
    return jsonResponse({ success: false, protocolVersion: 2, error: String(error.message || error) });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
function annualSpreadsheet(year, cfg) {
  var key = 'YEAR_SPREADSHEET_' + year;
  var id = cfg.props.getProperty(key);
  var ss;
  if (id) {
    // Do not silently replace an inaccessible/deleted archive with an empty file.
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create(cfg.prefix + ' - ' + year);
    cfg.props.setProperty(key, ss.getId());
  }
  DriveApp.getFileById(ss.getId()).moveTo(cfg.folder);
  return ss;
}
function productTab(ss, payload, cfg) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload.productKey)
    .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  var key = 'TAB_' + payload.year + '_' + payload.month + '_' + digest;
  var savedName = cfg.props.getProperty(key);
  if (savedName) {
    var saved = ss.getSheetByName(savedName);
    if (!saved) throw new Error('Registered tab missing: ' + savedName);
    return saved;
  }
  var name = String(payload.productName).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Khac';
  name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  var base = payload.year + '-' + payload.month + '_' + name.slice(0, 60);
  var tabName = base;
  // Different products with the same display name retain separate destinations.
  if (ss.getSheetByName(tabName)) tabName = base + '_' + digest.slice(0, 12);
  if (ss.getSheetByName(tabName)) throw new Error('Unregistered tab name collision');
  var tab = ss.insertSheet(tabName);
  cfg.props.setProperty(key, tabName);
  return tab;
}
/** Upgrade the old layout without losing row keys or existing values. */
function upgradeUrlColumn(sheet) {
  if (!sheet.getLastRow()) return;
  var header = sheet.getRange(1, 1, 1, 18).getValues()[0];
  if (header[0] === 'Tên (bắt buộc)' && header[7] === 'Trạng thái đơn hàng' && header[16] === EXPORT_KEY_HEADER) {
    sheet.insertColumnBefore(17);
    sheet.getRange(1, 17, 1, 1).setValues([['URL Landing Page']]);
    sheet.showColumns(17);
    sheet.hideColumns(18);
  }
}
function handleExport(payload, cfg) {
  if (!Number.isInteger(payload.year) || payload.year < 1900 || payload.year > 9999 ||
      !/^(0[1-9]|1[0-2])$/.test(payload.month) || typeof payload.productKey !== 'string' || !payload.productKey ||
      typeof payload.productName !== 'string' || !payload.productName ||
      !Array.isArray(payload.headers) || payload.headers.length !== 17 || payload.headers[0] !== 'Tên (bắt buộc)' ||
      !Array.isArray(payload.data) || !payload.data.length || payload.data.length > 5000 ||
      !Array.isArray(payload.rowKeys) || payload.rowKeys.length !== payload.data.length) throw new Error('Invalid export payload');
  payload.data.forEach(function(row) {
    if (!Array.isArray(row) || row.length !== 17) throw new Error('Expected 17 data columns');
  });
  if (payload.rowKeys.some(function(key) { return typeof key !== 'string' || !key; }) ||
      new Set(payload.rowKeys).size !== payload.rowKeys.length) throw new Error('Invalid row keys');
  var ss = annualSpreadsheet(payload.year, cfg);
  var sheet = productTab(ss, payload, cfg);
  upgradeUrlColumn(sheet);
  var headers = payload.headers.concat([EXPORT_KEY_HEADER]);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 18).setValues([headers]);
    sheet.getRange(1, 1, 1, 18).setFontWeight('bold').setBackground('#334488').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 180); sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(9, 300); sheet.setColumnWidth(14, 300); sheet.setColumnWidth(16, 400);
    sheet.hideColumns(18);
  } else {
    var actual = sheet.getRange(1, 1, 1, 18).getValues()[0];
    if (JSON.stringify(actual) !== JSON.stringify(headers)) throw new Error('Header mismatch; do not append to an old layout');
  }
  var last = sheet.getLastRow();
  var known = new Set(last > 1 ? sheet.getRange(2, 18, last - 1, 1).getValues().map(function(row) { return String(row[0]); }) : []);
  var pending = [];
  for (var i = 0; i < payload.data.length; i++) {
    if (!known.has(payload.rowKeys[i])) {
      // Never overwrite customer name with a sequence number. Column A is the original name.
      pending.push(payload.data[i].concat([payload.rowKeys[i]]));
    }
  }
  if (pending.length) {
    var start = last + 1;
    var end = start + pending.length - 1;
    if (end > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), end - sheet.getMaxRows());
    // Text columns preserve leading zeros, +phone, external IDs, and customer input.
    sheet.getRange(start, 1, pending.length, 18).setNumberFormat('@');
    sheet.getRange(start, 10, pending.length, 4).setNumberFormat('#,##0.##');
    // Prevent spreadsheet formula evaluation for untrusted customer text.
    var safe = pending.map(function(row) { return row.map(function(value) {
      return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value;
    }); });
    var range = sheet.getRange(start, 1, pending.length, 18);
    range.setValues(safe);
    range.setVerticalAlignment('top').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  }
  formatExportSheet(sheet, last + 1, pending.length);
  SpreadsheetApp.flush();
  return { success: true, protocolVersion: 2, year: payload.year, month: payload.month,
    productKey: payload.productKey, sheetName: sheet.getName(), acceptedRows: payload.data.length,
    rowsWritten: pending.length, duplicateRows: payload.data.length - pending.length,
    spreadsheetUrl: ss.getUrl() + '#gid=' + sheet.getSheetId() };
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Google Apps Script entry point
function doGet() { return jsonResponse({ status: 'ok', protocolVersion: 2, message: 'Lead Admin annual export' }); }

/** Bulk formatting: status is column H in the current 17-column layout. */
function statusStyle(value) {
  var key = String(value || '').trim().toUpperCase();
  if (key === 'SUCCESS' || key === 'THÀNH CÔNG') return { background: '#E6F4EA', color: '#188038' };
  if (key === 'FAILED' || key === 'LỖI' || key === 'THẤT BẠI') return { background: '#FCE8E6', color: '#C5221F' };
  if (key === 'PENDING' || key === 'CHỜ ĐỒNG BỘ' || key === 'CHỜ XỬ LÝ') return { background: '#FEF7E0', color: '#E37400' };
  if (key === 'TIMEOUT' || key === 'HẾT THỜI GIAN' || key === 'HẾT THỜI GIAN CHỜ') return { background: '#F3E8FD', color: '#9334E6' };
  return { background: '#FFFFFF', color: '#202124' };
}
function formatExportSheet(sheet, startRow, count) {
  sheet.getRange(1, 1, 1, 17).setFontWeight('bold').setFontSize(10)
    .setBackground('#334488').setFontColor('#FFFFFF').setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 56);
  var widths = [180, 155, 180, 125, 170, 170, 180, 160, 360, 110, 150, 150, 170, 320, 170, 420, 420];
  widths.forEach(function(width, index) { sheet.setColumnWidth(index + 1, width); });
  sheet.hideColumns(18);
  if (!count) return;
  var range = sheet.getRange(startRow, 1, count, 17);
  range.setFontSize(10).setFontWeight('normal').setFontColor('#202124')
    .setVerticalAlignment('top').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setBackgrounds(Array.from({ length: count }, function(_, i) {
      return Array(17).fill((startRow + i) % 2 === 0 ? '#F8F9FA' : '#FFFFFF');
    })).setBorder(true, true, true, true, true, true, '#DADCE0', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(startRow, 10, count, 4).setNumberFormat('#,##0.##').setHorizontalAlignment('right');
  var status = sheet.getRange(startRow, 8, count, 1);
  var styles = status.getValues().map(function(row) { return statusStyle(row[0]); });
  status.setBackgrounds(styles.map(function(style) { return [style.background]; }))
    .setFontColors(styles.map(function(style) { return [style.color]; })).setFontWeight('bold');
}
/** Run manually once after updating code: format existing registered yearly archives, without re-export. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Google Apps Script editor entry point
function reformatAllYearFiles() {
  var cfg = settings();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var props = cfg.props.getProperties();
    Object.keys(props).filter(function(key) { return /^YEAR_SPREADSHEET_\d{4}$/.test(key); }).forEach(function(key) {
      var ss = SpreadsheetApp.openById(props[key]);
      ss.getSheets().forEach(function(sheet) {
        if (!sheet.getLastRow()) return;
        upgradeUrlColumn(sheet);
        var header = sheet.getRange(1, 1, 1, 18).getValues()[0];
        if (header[0] !== 'Tên (bắt buộc)' || header[7] !== 'Trạng thái đơn hàng' || header[17] !== EXPORT_KEY_HEADER) return;
        formatExportSheet(sheet, 2, sheet.getLastRow() - 1);
        Logger.log('Formatted: ' + sheet.getName());
      });
    });
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}
