const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
function loadExporter(fetch) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/lib/google-sheets.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'exports', 'fetch', code)(module, module.exports, fetch);
  return module.exports;
}
function order(id, date = '2026-11-15T00:00:00Z', productName = 'Đai lưng', slug = 'dai-lung') {
  return { id, external_id: 'SAMPLE-' + id, customer_name: 'Nguyễn Văn A', customer_phone: '0977700000', delivery_address: 'Địa chỉ thử nghiệm',
    created_at: date, total_price: 878000, selected_package: '1+1 | 2+2', selected_size: 'S | L', landing_slug: slug,
    sync_status: 'SUCCESS', retailcrm_id: null, url_page: 'https://example.test/vc-cream.store',
    items_json: JSON.stringify([{ productName, variantLabel: 'Gói 1+1', quantity: 1, initialPrice: 299000, deliveryFee: 50000 },
      { productName, variantLabel: 'Gói 2+2', quantity: 1, initialPrice: 529000, deliveryFee: 0 }]) };
}
function mockGoogle() {
  const props = new Map([['EXPORT_FOLDER_ID', 'folder'], ['EXPORT_SECRET', 'test-secret']]);
  const files = new Map(); let locks = 0;
  class Range {
    constructor(sheet, r, c, h, w) { Object.assign(this, { sheet, r, c, h, w }); }
    setValues(data) {
      data.forEach((row, i) => row.forEach((v, j) => { const r = this.r + i - 1; this.sheet.rows[r] ||= []; this.sheet.rows[r][this.c + j - 1] = v; })); return this;
    }
    getValues() { return Array.from({ length: this.h }, (_, i) => Array.from({ length: this.w }, (_, j) => this.sheet.rows[this.r + i - 1]?.[this.c + j - 1] ?? '')); }
    setFontSize() { return this; } setHorizontalAlignment() { return this; } setBorder() { return this; }
    setBackgrounds(values) { this.sheet.styles.push({ r: this.r, c: this.c, backgrounds: values }); return this; }
    setFontColors(values) { this.sheet.styles.push({ r: this.r, c: this.c, colors: values }); return this; }
    setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
    setNumberFormat() { return this; } setVerticalAlignment() { return this; } setWrapStrategy() { return this; }
  }
  class Sheet {
    constructor(name, id) { this.name = name; this.id = id; this.rows = []; this.maxRows = 1000; this.styles = []; }
    getRange(...args) { return new Range(this, ...args); }
    getName() { return this.name; } getSheetId() { return this.id; } getLastRow() { return this.rows.length; }
    getMaxRows() { return this.maxRows; } insertRowsAfter(_, n) { this.maxRows += n; }
    insertColumnBefore(c) { this.rows.forEach(row => row.splice(c - 1, 0, "")); }
    showColumns() {}
    setRowHeight() {} setFrozenRows() {} setColumnWidth() {} hideColumns() {}
  }
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k) || null, setProperty: (k, v) => props.set(k, v), getProperties: () => Object.fromEntries(props) }) },
    DriveApp: { getFolderById: id => { if (id !== 'folder') throw Error('bad folder'); return { getName: () => 'Archive' }; }, getFileById: () => ({ moveTo() {} }) },
    SpreadsheetApp: {
      create(name) { const id = 'file-' + (files.size + 1); const sheets = new Map();
        const file = { id, name, sheets, getId: () => id, getUrl: () => 'https://example.test/' + id,
          getSheets: () => [...sheets.values()], getSheetByName: name => sheets.get(name), insertSheet(name) { const sheet = new Sheet(name, sheets.size + 1); sheets.set(name, sheet); return sheet; } };
        files.set(id, file); return file; },
      openById(id) { if (!files.has(id)) throw Error('missing archive'); return files.get(id); },
      getActiveSpreadsheet: () => null, flush() {}, WrapStrategy: { WRAP: 'WRAP' }, BorderStyle: { SOLID: 'SOLID' },
    },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_, value) => Array.from(crypto.createHash('sha256').update(value).digest()) },
    LockService: { getScriptLock: () => ({ tryLock: () => { locks++; return true; }, waitLock: () => { locks++; }, hasLock: () => true, releaseLock: () => { locks--; } }) },
    ContentService: { createTextOutput: text => ({ text, setMimeType() { return this; } }), MimeType: { JSON: 'json' } }, Logger: { log() {} },
  };
  vm.createContext(context); vm.runInContext(fs.readFileSync('src/lib/google-apps-script.js', 'utf8'), context);
  const send = payload => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
  return { files, props, send, context, locks: () => locks };
}
const settings = () => { process.env.GOOGLE_APPS_SCRIPT_URL = 'https://example.test/exec'; process.env.GOOGLE_APPS_SCRIPT_SECRET = 'test-secret'; };
test('year/month follows Bangkok order date, not execution time or UTC year', () => {
  const { groupSheetOrders } = loadExporter();
  const groups = groupSheetOrders([order(1, '2026-12-31T16:59:59Z'), order(2, '2026-12-31T17:00:00Z')], 'Asia/Bangkok');
  assert.deepEqual(groups.map(g => [g.year, g.month]), [[2026, '12'], [2027, '01']]);
});
test('batches limit actual rows, keep whole orders and reject malformed items', () => {
  const { groupSheetOrders, sheetBatches } = loadExporter();
  const group = groupSheetOrders([order(1), order(2), order(3)])[0];
  assert.deepEqual(sheetBatches(group, 4).map(b => [b.data.length, b.orderIds]), [[4, [1, 2]], [2, [3]]]);
  assert.throws(() => sheetBatches(group, 1));
  assert.throws(() => groupSheetOrders([{ ...order(1), items_json: 'bad' }]));
});
test('backend + real Apps Script: preserve names, create yearly files, route product tabs, dedupe retry', async () => {
  settings(); const google = mockGoogle();
  const exporter = loadExporter(async (_, request) => ({ ok: true, json: async () => google.send(JSON.parse(request.body)) }));
  const data = [order(1), order(2, '2026-12-15T00:00:00Z', 'Kem', 'kem'), order(3, '2027-01-15T00:00:00Z')];
  const ack = [];
  const result = await exporter.exportOrdersToGoogleSheets(data, undefined, async ids => ack.push(...ids));
  assert.equal(result.success, true); assert.equal(result.totalRows, 6);
  assert.equal(google.files.size, 2); assert.deepEqual(ack, [1, 2, 3]);
  assert.deepEqual(result.destinations.map(d => d.sheetName), ['2026-11_Dai-lung', '2026-12_Kem', '2027-01_Dai-lung']);
  const first = [...google.files.values()][0].sheets.get('2026-11_Dai-lung');
  assert.equal(first.rows[1][0], 'Nguyễn Văn A'); assert.equal(first.rows[1][1], '0977700000');
  assert.equal(first.rows[1][16], 'https://example.test/vc-cream.store');
  assert.equal(first.rows[1][12], 878000); assert.equal(first.rows[2][12], 0);
  assert.equal(first.rows[0][17], '_ExportRowId');
  assert.equal((await exporter.exportOrdersToGoogleSheets(data)).success, true);
  assert.equal(first.rows.length, 3); assert.equal(google.files.size, 2); assert.equal(google.locks(), 0);
});
test('same product display name with different identity uses distinct stable tabs', async () => {
  settings(); const google = mockGoogle();
  const exporter = loadExporter(async (_, req) => ({ ok: true, json: async () => google.send(JSON.parse(req.body)) }));
  const result = await exporter.exportOrdersToGoogleSheets([order(1), order(2, undefined, 'Đai lưng', 'dai-lung-2')]);
  assert.equal(result.success, true); assert.notEqual(result.destinations[0].sheetName, result.destinations[1].sheetName);
});
test('old Apps Script or failed acknowledgement never marks orders', async () => {
  settings(); let marked = false;
  const exporter = loadExporter(async () => ({ ok: true, json: async () => ({ success: true, rowsWritten: 2 }) }));
  const result = await exporter.exportOrdersToGoogleSheets([order(1)], undefined, async () => { marked = true; });
  assert.equal(result.success, false); assert.equal(marked, false);
});
test('wrong secret rejects export without creating a file', () => {
  const google = mockGoogle();
  assert.equal(google.send({ action: 'export', protocolVersion: 2, secret: 'wrong' }).success, false);
  assert.equal(google.files.size, 0);
});
test('later group failure acknowledges only the completed group', async () => {
  settings(); const google = mockGoogle(); let n = 0; const ack = [];
  const exporter = loadExporter(async (_, req) => ({ ok: true, json: async () => ++n === 2 ? { success: false, error: 'quota' } : google.send(JSON.parse(req.body)) }));
  const result = await exporter.exportOrdersToGoogleSheets([order(1), order(2, '2027-01-01T00:00:00Z')], undefined, async ids => ack.push(...ids));
  assert.equal(result.success, false); assert.deepEqual(ack, [1]);
});

test('preserves external IDs and rejects an inaccessible registered annual file', async () => {
  settings(); const google = mockGoogle();
  google.props.set('YEAR_SPREADSHEET_2026', 'missing-file');
  const exporter = loadExporter(async (_, req) => ({ ok: true, json: async () => google.send(JSON.parse(req.body)) }));
  let ack = false;
  const result = await exporter.exportOrdersToGoogleSheets([order(1)], undefined, async () => { ack = true; });
  assert.equal(result.success, false); assert.equal(ack, false); assert.equal(google.files.size, 0);
});
test('empty export does not create files and schema mismatch cannot acknowledge data', async () => {
  settings(); const google = mockGoogle();
  const exporter = loadExporter(async (_, req) => ({ ok: true, json: async () => google.send(JSON.parse(req.body)) }));
  assert.equal((await exporter.exportOrdersToGoogleSheets([])).totalRows, 0);
  assert.equal(google.files.size, 0);
  await exporter.exportOrdersToGoogleSheets([order(1)]);
  const file = [...google.files.values()][0];
  file.sheets.get('2026-11_Dai-lung').rows[0][0] = 'STT';
  let ack = false;
  const result = await exporter.exportOrdersToGoogleSheets([order(2)], undefined, async () => { ack = true; });
  assert.equal(result.success, false); assert.equal(ack, false);
});

test('status colors apply to new rows and repair existing archives without changing values', async () => {
  settings(); const google = mockGoogle();
  const exporter = loadExporter(async (_, req) => ({ ok: true, json: async () => google.send(JSON.parse(req.body)) }));
  const input = ['SUCCESS', 'FAILED', 'PENDING', 'TIMEOUT'].map((status, i) => ({ ...order(i + 1), sync_status: status }));
  assert.equal((await exporter.exportOrdersToGoogleSheets(input)).success, true);
  const sheet = [...google.files.values()][0].sheets.get('2026-11_Dai-lung');
  const statusColors = sheet.styles.find(style => style.c === 8 && style.colors);
  assert.deepEqual(Array.from(statusColors.colors, row => row[0]).filter((_, i) => i % 2 === 0), ['#188038', '#C5221F', '#E37400', '#9334E6']);
  const before = JSON.stringify(sheet.rows);
  sheet.styles = []; google.context.reformatAllYearFiles();
  assert.equal(JSON.stringify(sheet.rows), before);
  assert.ok(sheet.styles.some(style => style.c === 8 && style.colors));
  assert.equal(google.locks(), 0);
});


test('old sheet upgrades URL column while preserving dedup keys and existing rows', async () => {
  settings(); const google = mockGoogle();
  const exporter = loadExporter(async (_, req) => ({ ok: true, json: async () => google.send(JSON.parse(req.body)) }));
  await exporter.exportOrdersToGoogleSheets([order(1)]);
  const sheet = [...google.files.values()][0].sheets.get('2026-11_Dai-lung');
  sheet.rows.forEach(row => row.splice(16, 1)); // Simulate the original 16-column layout.
  const oldKey = sheet.rows[1][16];
  const result = await exporter.exportOrdersToGoogleSheets([order(1), order(2)]);
  assert.equal(result.success, true);
  assert.equal(sheet.rows.length, 5);
  assert.equal(sheet.rows[0][16], 'URL Landing Page');
  assert.equal(sheet.rows[1][17], oldKey);
  assert.equal(sheet.rows[1][16], '');
  assert.equal(sheet.rows[3][16], 'https://example.test/vc-cream.store');
});
