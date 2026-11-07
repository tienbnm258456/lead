const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const resolve = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', mocks);
    if (name.startsWith('.')) return load(require('node:path').resolve(require('node:path').dirname(file), name + '.ts'), mocks);
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
  return module.exports;
}

const display = load('src/lib/crm-status-display.ts');
const filters = load('src/lib/order-filters.ts');
const NextResponse = { json: (body, options) => ({ body, status: options?.status || 200 }) };

function setup(user = { id: 1, role: 'ADMIN' }) {
  const calls = [];
  const prisma = {
    order: {
      findMany: async args => { calls.push(['find', args]); return []; },
      count: async args => { calls.push(['count', args]); return 0; },
    },
    landingPage: { findMany: async () => [] },
  };
  const mocks = {
    'next/server': { NextResponse }, '@/lib/prisma': { prisma },
    '@/lib/require-auth': { requireAuth: async () => ({ user }) },
    '@/lib/retailcrm': {}, '@/lib/order-id': {},
    '@/lib/order-filters': filters,
    '@/lib/order-xml-filter': { orderIdsForXmlId: async (xmlId, actor) => { calls.push(['xml', xmlId, actor]); return [7, 11]; } },
    exceljs: {},
  };
  return { calls, list: load('src/app/api/orders/route.ts', mocks), export: load('src/app/api/orders/export/route.ts', mocks) };
}
const request = query => ({ nextUrl: new URL('http://localhost/api/orders?' + query) });

test('each CRM group expands to exactly its mapped statuses for list and count', async () => {
  for (const group of Object.keys(display.CRM_STATUS_GROUPS)) {
    const state = setup();
    assert.equal((await state.list.GET(request('crmStatusGroup=' + group))).status, 200);
    const expected = Object.entries(display.CRM_STATUS_MAPPING).filter(([, status]) => status.group === group).map(([code]) => code);
    assert.deepEqual(state.calls[0][1].where.AND, [{ crm_status: { in: expected } }]);
    assert.deepEqual(state.calls[1][1].where, state.calls[0][1].where);
  }
});

test('group, ADMIN2 manager, exact XML ID and CRM status combine with scope and pagination', async () => {
  const state = setup({ id: 3, role: 'USER', group_id: 12 });
  const result = await state.list.GET(request('groupId=99&managerId=8&xmlId=XML_A&crmStatusGroup=delivery&page=2&pageSize=10&status=SUCCESS'));
  assert.equal(result.status, 200);
  const query = state.calls.find(call => call[0] === 'find')[1];
  assert.equal(query.where.group_id, 12);
  assert.equal(query.where.AND[0].group_id, 99);
  assert.deepEqual(query.where.AND[0].group, { users: { some: { id: 8, role: 'ADMIN2' } } });
  assert.deepEqual(query.where.id, { in: [7, 11] });
  assert.equal(query.where.sync_status, 'SUCCESS');
  assert.equal(query.skip, 10);
  assert.equal(query.take, 10);
  assert.equal(state.calls[0][1], 'XML_A');
});

test('Excel uses the same extra filters and rejects malformed filters before querying', async () => {
  const state = setup();
  await state.list.GET(request('groupId=2&managerId=8&xmlId=X&crmStatusGroup=completed'));
  const listed = state.calls.find(call => call[0] === 'find')[1].where;
  state.calls.length = 0;
  assert.equal((await state.export.GET(request('groupId=2&managerId=8&xmlId=X&crmStatusGroup=completed&mode=filtered'))).status, 404);
  assert.deepEqual(state.calls.find(call => call[0] === 'find')[1].where, listed);
  for (const query of ['crmStatusGroup=constructor', 'groupId=-1', 'groupId=1.5', 'managerId=nope', 'xmlId=' + 'a'.repeat(256)]) {
    state.calls.length = 0;
    assert.equal((await state.list.GET(request(query))).status, 400);
    assert.equal((await state.export.GET(request(query))).status, 400);
    assert.equal(state.calls.length, 0);
  }
});

test('XML query parameterizes the exact value and scopes non-admin orders', async () => {
  let query;
  const api = load('src/lib/order-xml-filter.ts', { '@/lib/prisma': {}, './prisma': {
    prisma: { $queryRaw: async value => { query = value; return [{ id: 3 }]; } },
  } });
  const xmlId = "test' OR 1=1 --";
  assert.deepEqual(await api.orderIdsForXmlId(xmlId, { role: 'USER', group_id: 12 }), [3]);
  assert.deepEqual(query.values, [xmlId, 12]);
  assert.ok(query.sql.includes("item->>'xmlId' = ?"));
});

test('filter options are restricted to the viewer group and only list ADMIN2 accounts', async () => {
  for (const user of [{ id: 1, role: 'ADMIN' }, { id: 2, role: 'USER', group_id: 12 }, { id: 3, role: 'ADMIN2', group_id: 12 }]) {
    let query;
    const api = load('src/app/api/orders/filter-options/route.ts', {
      'next/server': { NextResponse },
      '@/lib/require-auth': { requireAuth: async () => ({ user }) },
      '@/lib/prisma': { prisma: { accessGroup: { findMany: async args => { query = args; return []; } } } },
    });
    assert.equal((await api.GET()).status, 200);
    assert.deepEqual(query.where, user.role === 'ADMIN' ? {} : { id: 12 });
    assert.deepEqual(query.select.users.where, { role: 'ADMIN2' });
  }
});
