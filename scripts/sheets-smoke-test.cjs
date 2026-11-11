/** Sends only synthetic rows directly to Apps Script. Does not read/delete database orders. */
const fs = require('node:fs');
const ts = require('typescript');
const crmStatus = { exports: {} };
const crmCode = ts.transpileModule(fs.readFileSync('src/lib/crm-status-display.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('module', 'exports', crmCode)(crmStatus, crmStatus.exports);
require('@next/env').loadEnvConfig(process.cwd(), true);
if (!process.argv.includes('--send')) {
  console.log('Để gửi dữ liệu giả vào thư mục Google đã cấu hình: node scripts/sheets-smoke-test.cjs --send');
  process.exit(0);
}
const moduleValue = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('src/lib/google-sheets.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('require', 'module', 'exports', code)(() => crmStatus.exports, moduleValue, moduleValue.exports);
const { exportOrdersToGoogleSheets, testGoogleSheetsConnection } = moduleValue.exports;
process.env.GOOGLE_SHEETS_SOURCE = (process.env.GOOGLE_SHEETS_SOURCE || 'lead-admin') + '-smoke';
const sample = (id, created_at, productName, slug) => ({
  id, external_id: 'SAMPLE-SHEETS-' + id, customer_name: 'KHÁCH THỬ NGHIỆM - KHÔNG PHẢI ĐƠN THẬT',
  customer_phone: '0000000000', delivery_address: 'DỮ LIỆU MẪU', total_price: 878000,
  selected_package: '1+1 | 2+2', selected_size: 'S | L', landing_slug: 'sample-' + slug,
  crm_status: 'complete', retailcrm_id: null, created_at,
  items_json: JSON.stringify([
    { productName, variantLabel: 'Gói thử 1+1', promotion: '1+1', size: 'S + L', quantity: 1, initialPrice: 299000, deliveryFee: 50000 },
    { productName, variantLabel: 'Gói thử 2+2', promotion: '2+2', size: 'S + L', quantity: 1, initialPrice: 529000, deliveryFee: 0 },
  ]),
});
(async () => {
  const ping = await testGoogleSheetsConnection();
  if (!ping.connected) throw new Error(ping.error);
  const result = await exportOrdersToGoogleSheets([
    sample(9000001, '2026-11-15T00:00:00Z', 'Mẫu Đai lưng', 'dai-lung'),
    sample(9000002, '2026-12-15T00:00:00Z', 'Mẫu Kem', 'kem'),
    sample(9000003, '2027-01-15T00:00:00Z', 'Mẫu Đai lưng', 'dai-lung'),
  ]);
  if (!result.success) throw new Error(result.error);
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
