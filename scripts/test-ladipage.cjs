const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const helpers = load('src/lib/ladipage-order.ts');
const crm = load('src/lib/retailcrm.ts');
const product = { name: 'Test product', xml_id: null };
const variants = [
  { id: 1, label: 'Gói 1+1 – 299.000 UZS', size: 'S o‘lcham: 55 kg dan kam', xml_id: 'OFFER_A_S', quantity: 2, price: 299000, delivery_fee: 50000 },
  { id: 2, label: 'Gói 2+2 – 529.000 UZS', size: 'S o‘lcham: 55 kg dan kam', xml_id: 'OFFER_B_S', quantity: 4, price: 529000, delivery_fee: 0 },
];
test('radio and a single checkbox produce the same combo, ignoring contained-piece quantity', () => {
  const one = helpers.resolveLandingItems(variants, variants[0].label, variants[0].size, product);
  const array = helpers.resolveLandingItems(variants, [variants[0].label], [variants[0].size], product);
  assert.deepEqual(one, array);
  assert.equal(one.items[0].quantity, 1);
  assert.equal(one.totalPrice, 349000);
});
test('multiple packages use every item and charge max shipping once; CRM divides exactly once', () => {
  const resolved = helpers.resolveLandingItems(variants, variants.map(v => v.label), variants[0].size, product);
  assert.equal(resolved.totalPrice, 878000);
  const input = { externalId: 'GF-10001', firstName: 'Ali', phone: '123', delivery: { cost: resolved.deliveryFee, address: { text: 'Bukhara' } }, items: resolved.items };
  const output = crm.buildOrderPayload(input);
  assert.deepEqual(output.items.map(i => [i.offer.xmlId, i.quantity, i.initialPrice]), [['OFFER_A_S, S', 1, 299], ['OFFER_B_S, S', 1, 529]]);
  assert.equal(output.delivery.cost, 50);
  assert.equal(input.items[0].initialPrice, 299000);
  assert.deepEqual(crm.buildOrderPayload(input), output);
});
test('ambiguous sizes, unknown packages and duplicate matches never guess', () => {
  assert.equal(helpers.resolveLandingItems(variants, variants.map(v => v.label), ['S', 'L'], product).items.length, 2);
  assert.throws(() => helpers.resolveLandingItems(variants, 'Unknown', '', product), helpers.SelectionError);
  assert.equal(helpers.resolveLandingItems([{ ...variants[0], xml_id: null }], variants[0].label, variants[0].size, product).items[0].xmlId, 'XML0001_OFFER');
  assert.throws(() => helpers.resolveLandingItems([variants[0], variants[0]], variants[0].label, variants[0].size, product), helpers.SelectionError);
  assert.throws(() => helpers.selections([{}]), helpers.SelectionError);
});
test('normalizes whitespace/apostrophes but does not split commas inside labels', () => {
  assert.deepEqual(helpers.selections('1 dona, 1 bepul'), ['1 dona, 1 bepul']);
  assert.equal(helpers.resolveLandingItems(variants, variants[0].label, variants[0].size.replace('‘', "'"), product).items.length, 1);
});
test('form-data repeated keys are preserved and malformed JSON fields rejected', async () => {
  const request = new Request('http://localhost', { method: 'POST', body: new URLSearchParams([['products', 'A'], ['products', 'B'], ['size', 'S']]) });
  assert.deepEqual(await helpers.readLandingBody(request), { products: ['A', 'B'], size: 'S' });
  await assert.rejects(() => helpers.readLandingBody(new Request('http://localhost', { method: 'POST', body: '[]' })), helpers.SelectionError);
});
test('webhook sends multiple sizes and holds only an unknown package', async () => {
  for (const ambiguous of [false, true]) {
    let saved; let sent; let transaction = false;
    const prisma = {
      landingPage: { findUnique: async () => ({ name: 'Landing', product: { ...product, xml_id: '3B5ggmZQg35w2QgJWnoZ21', slug: 'test', variants: variants.map((v,i) => ({...v, promotion: i === 0 ? '1+1' : '2+2'})) } }) },
      order: { create: async ({ data }) => { saved = data; return { id: 1 }; }, update: async () => ({}) },
      orderSyncLog: { create: async () => ({}) },
      $transaction: async () => { transaction = true; },
    };
    const route = load('src/app/api/webhook/ladipage/route.ts', {
      '@/lib/ladipage-order': helpers,
      'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
      '@/lib/prisma': { prisma },
      '@/lib/retailcrm': { createRetailCrmOrder: async (payload) => { sent = crm.buildOrderPayload(payload); return { status: 'SUCCESS', sentAt: new Date(), completedAt: new Date(), response: { id: 99 } }; } },
      '@prisma/client': {}, '@/lib/api-logger': { withLogger: fn => fn },
      '@/lib/rate-limiter': { rateLimiter: { check: () => ({ allowed: true, remaining: 29, resetAt: Date.now() }) } },
      '@/lib/order-id': { generateExternalId: () => 'GF-10001' },
    });
    const body = { name: 'Ali', phone: '123', address: 'Bukhara', products: ambiguous ? ['Unknown package'] : variants.map(v => v.label), size: ['S', 'L'] };
    const response = await route.POST({ headers: new Headers({ 'content-type': 'application/json' }), nextUrl: new URL('http://localhost/api/webhook/ladipage?api_key=test'), json: async () => ({ ...body, url_page: "https://example.test/vc-cream.store" }) });
    assert.equal(response.status, 200);
    assert.equal(saved.url_page, "https://example.test/vc-cream.store");
    assert.deepEqual(JSON.parse(saved.items_json)[0].rawPayload, { ...body, url_page: "https://example.test/vc-cream.store" });
    if (ambiguous) { assert.equal(sent, undefined); assert.equal(saved.sync_status, 'FAILED'); assert.equal(response.body.requiresReview, true); }
    else { assert.deepEqual(sent.items.map(i => i.offer.xmlId), ['3B5ggmZQg35w2QgJWnoZ21, 1+1, S + L', '3B5ggmZQg35w2QgJWnoZ21, 2+2, S + L']); assert.equal(JSON.parse(saved.items_json)[0].xmlId, '3B5ggmZQg35w2QgJWnoZ21'); assert.equal(sent.items.length, 2); assert.equal(sent.items[0].initialPrice, 299); assert.equal(sent.delivery.cost, 50); assert.equal(transaction, true); }
  }
});

test('UZS grouped input preserves full units and decimals, rejects invalid input', () => {
  const { parseUZS } = load('src/lib/money.ts');
  assert.equal(parseUZS('299.000'), 299000);
  assert.equal(parseUZS('50,000'), 50000);
  assert.equal(parseUZS('299000'), 299000);
  assert.equal(parseUZS('299000.50'), 299000.5);
  assert.ok(Number.isNaN(parseUZS('')));
  assert.ok(Number.isNaN(parseUZS('bad')));
});

test('retry rebuilds full UZS stored items, keeps shipping and divides only at CRM boundary', async () => {
  let sent;
  const storedItems = [{ xmlId: 'A', quantity: 1, initialPrice: 299000, deliveryFee: 50000 }, { xmlId: 'B', quantity: 1, initialPrice: 529000, deliveryFee: 0 }];
  const prisma = {
    order: { findUnique: async () => ({ id: 1, external_id: 'GF-1', customer_name: 'Ali Valiyev', customer_phone: '123', delivery_address: 'Bukhara', sync_status: 'FAILED', items_json: JSON.stringify(storedItems) }), update: async () => ({ id: 1 }) },
    orderSyncLog: { create: async () => ({}) },
    $transaction: async () => [{ id: 1, external_id: 'GF-1', sync_status: 'SUCCESS' }],
  };
  const retry = load('src/app/api/retailcrm/orders/[id]/retry/route.ts', {
    '@/lib/ladipage-order': helpers, '@/lib/permissions': load('src/lib/permissions.ts'), '@/lib/prisma': { prisma },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/retailcrm': { createRetailCrmOrder: async payload => { sent = crm.buildOrderPayload(payload); return { status: 'SUCCESS', sentAt: new Date(), completedAt: new Date(), response: { id: 99 } }; } },
    '@prisma/client': {}, '@/lib/require-auth': { requireAuth: async () => ({ user: { id: 1, role: 'ADMIN' } }), requireAdmin: async () => ({ user: { id: 1, role: 'ADMIN' } }) },
  });
  const response = await retry.POST({}, { params: Promise.resolve({ id: '1' }) });
  assert.equal(response.status, 200);
  assert.equal(sent.delivery.cost, 50);
  assert.deepEqual(sent.items.map(item => item.initialPrice), [299, 529]);
});

test('auto IDs are distinct/stable and backfill preserves existing XML IDs', async () => {
  const writes = [];
  const client = { productVariant: { updateMany: async args => { writes.push(args); } } };
  const input = [{ id: 1, xml_id: null }, { id: 2, xml_id: '' }, { id: 3, xml_id: 'REAL_CRM_OFFER' }];
  const result = await helpers.ensureOfferXmlIds(client, input);
  assert.deepEqual(result.map(v => v.xml_id), ['XML0001_OFFER', 'XML0002_OFFER', 'REAL_CRM_OFFER']);
  assert.equal(writes.length, 2);
  writes.length = 0;
  assert.deepEqual(await helpers.ensureOfferXmlIds(client, result), result);
  assert.equal(writes.length, 0);
  assert.equal(input[0].xml_id, null);
});

test('all 1/2/3 selected sizes apply to every package without changing quantity or price', () => {
  const configured = variants.map((v, index) => ({ ...v, promotion: index === 0 ? '1+1' : '2+2' }));
  for (const sizes of [['S'], ['S', 'L'], ['S', 'M', 'L']]) {
    const result = helpers.resolveLandingItems(configured, variants.map(v => v.label), sizes, product);
    assert.equal(result.items.length, 2);
    assert.equal(result.totalPrice, 878000);
    assert.deepEqual(result.items.map(item => item.size), [sizes.join(' + '), sizes.join(' + ')]);
    assert.deepEqual(result.items.map(item => item.quantity), [1, 1]);
    const sent = crm.buildOrderPayload({ externalId: 'TEST', firstName: 'A', phone: '1', delivery: { cost: result.deliveryFee, address: { text: 'x' } }, items: result.items });
    assert.equal(sent.items[0].offer.xmlId, 'OFFER_A_S, 1+1, ' + sizes.join(' + '));
    assert.equal(sent.items[1].offer.xmlId, 'OFFER_B_S, 2+2, ' + sizes.join(' + '));
    assert.equal('customerComment' in sent, false);
  }
});

test('requested XML format strips auto suffix, abbreviates descriptive sizes and is repeatable', () => {
  const input = { externalId: 'ORDT-8', firstName: 'Test', phone: '1', delivery: { cost: 65000, address: { text: 'x' } }, items: [
    { xmlId: 'XML0001_OFFER', promotion: '1+1', size: 'S o‘lcham: 55 kg dan kam + L o‘lcham: 65–75 kg', quantity: 1, initialPrice: 390000 },
    { xmlId: 'XML0002_OFFER', promotion: '2+2', size: 'S', quantity: 1, initialPrice: 610000 },
  ] };
  const output = crm.buildOrderPayload(input);
  assert.deepEqual(output.items.map(i => i.offer.xmlId), ['XML0001, 1+1, S + L', 'XML0002, 2+2, S']);
  assert.equal('customerComment' in output, false);
  assert.deepEqual(crm.buildOrderPayload(input), output);
  assert.equal(input.items[0].xmlId, 'XML0001_OFFER');
  assert.equal(output.delivery.cost, 65);
  assert.deepEqual(output.items.map(i => i.initialPrice), [390, 610]);
});

test('manual order uses configured offer/promotion/size and splits shipping, ignoring client prices', async () => {
  let saved; let sent;
  const variant = { ...variants[1], id: 2, xml_id: 'XML0002_OFFER', promotion: '2+2', price: 610000, delivery_fee: 65000 };
  const prisma = {
    landingPage: { findUnique: async ({ where, include }) => where.id === 7 && include.product.include.variants.where.id === 2 ?
      { product: { ...product, xml_id: '3B5ggmZQg35w2QgJWnoZ21', active: true, slug: 'test', variants: [variant] } } : null },
    order: { create: async ({ data }) => { saved = data; return { id: 11, ...data }; }, update: async () => ({}) },
    orderSyncLog: { create: async () => ({}) }, $transaction: async () => [],
  };
  const route = load('src/app/api/orders/route.ts', {
    '@/lib/order-filters': {}, '@/lib/order-xml-filter': {},
    '@/lib/crm-status-display': load('src/lib/crm-status-display.ts'),
    '@/lib/ladipage-order': helpers, '@/lib/permissions': load('src/lib/permissions.ts'), '@/lib/prisma': { prisma },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/retailcrm': { createRetailCrmOrder: async payload => { sent = crm.buildOrderPayload(payload); return { status: 'SUCCESS', sentAt: new Date(), completedAt: new Date(), response: { id: 99 } }; } },
    '@prisma/client': {}, '@/lib/require-auth': { requireAuth: async () => ({ user: { id: 1, role: 'ADMIN' } }), requireAdmin: async () => ({ user: { id: 1, role: 'ADMIN' } }) },
  });
  const body = { customer_name: 'Test User', customer_phone: '0987654573', delivery_address: 'Test', landing_page_id: 7, variant_id: 2,
    selected_size: 'S o‘lcham: 55 kg dan kam', total_price: 1, selected_package: 'wrong', landing_slug: 'wrong' };
  const result = await route.POST({ json: async () => body });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.external_id, 'MAN-00011');
  assert.equal(sent.items[0].offer.xmlId, '3B5ggmZQg35w2QgJWnoZ21, 2+2, S');
  assert.equal(sent.items[0].initialPrice, 610);
  assert.equal(sent.items[0].quantity, 1);
  assert.equal(sent.delivery.cost, 65);
  assert.equal(saved.total_price, 675000);
  assert.equal(saved.landing_slug, 'test');
  assert.equal(JSON.parse(saved.items_json)[0].deliveryFee, 65000);
  sent = undefined;
  const invalid = await route.POST({ json: async () => ({ ...body, variant_id: 123 }) });
  assert.equal(invalid.status, 400); assert.equal(sent, undefined);
});
