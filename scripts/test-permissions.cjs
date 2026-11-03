const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'crypto', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports, webcrypto);
  return module.exports;
}
const permissions = load('src/lib/permissions.ts');
const root = { id: 1, role: 'ADMIN', group_id: null };
const manager = { id: 2, role: 'ADMIN2', group_id: 10 };
const member = { id: 3, role: 'USER', group_id: 10 };
const outsider = { id: 4, role: 'USER', group_id: 20 };
const next = { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
test('group scope is shared by manager/member, isolated between groups and fails closed for legacy unassigned users', () => {
  assert.deepEqual(permissions.dataScope(root), {});
  assert.deepEqual(permissions.dataScope(manager), { group_id: 10 });
  assert.deepEqual(permissions.dataScope(member), { group_id: 10 });
  assert.deepEqual(permissions.dataScope(outsider), { group_id: 20 });
  assert.deepEqual(permissions.dataScope({ role: 'USER', group_id: null }), { group_id: -1 });
  assert.equal(permissions.landingScope(member).deleted_at, null);
});
test('managers cannot manage peers/superiors or accounts outside their group', () => {
  assert.equal(permissions.canManageAccount(manager, member), true);
  for (const target of [root, manager, outsider, { id: 5, role: 'ADMIN2', group_id: 10 }]) assert.equal(permissions.canManageAccount(manager, target), false);
  assert.equal(permissions.canManageAccount(root, manager), true);
});
test('signed sessions read current DB role/group; old versions, deleted/locked users and changed password are revoked', async () => {
  let user = { ...member, username: 'member', name: 'Member', active: true, session_version: 1, group: { active: true } };
  const auth = load('src/lib/auth.ts', { './prisma': { prisma: { adminUser: { findUnique: async () => user } } } });
  const token = await auth.createAuthToken(user);
  assert.equal((await auth.verifyAuthToken(token)).role, 'USER');
  user = { ...user, role: 'ADMIN2' };
  assert.equal((await auth.verifyAuthToken(token)).role, 'ADMIN2');
  user = { ...user, session_version: 2 }; assert.equal(await auth.verifyAuthToken(token), null);
  user = { ...user, session_version: 1, active: false }; assert.equal(await auth.verifyAuthToken(token), null);
  user = { ...user, active: true, group: { active: false } }; assert.equal(await auth.verifyAuthToken(token), null);
  assert.equal(await auth.verifyAuthToken(token + '.extra'), null);
});
test('both group roles are denied every order mutation, retry and total-admin resource before DB access', async () => {
  const cases = [
    ['src/app/api/orders/[id]/route.ts', 'PUT'], ['src/app/api/orders/[id]/route.ts', 'DELETE'],
    ['src/app/api/orders/bulk-delete/route.ts', 'POST'], ['src/app/api/retailcrm/orders/[id]/retry/route.ts', 'POST'],
    ['src/app/api/retailcrm/orders/route.ts', 'POST'], ['src/app/api/retailcrm/orders/sync/route.ts', 'POST'],
    ['src/app/api/storage/route.ts', 'GET'], ['src/app/api/storage/route.ts', 'DELETE'], ['src/app/api/settings/route.ts', 'GET'], ['src/app/api/settings/route.ts', 'PUT'],
  ];
  for (const actor of [manager, member]) for (const [file, method] of cases) {
    const requireAdmin = async () => ({ error: next.NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });
    const route = load(file, { 'next/server': next, '@/lib/prisma': { prisma: {} }, '@/lib/require-auth': { requireAdmin, requireAuth: async () => ({ user: actor }) },
      '@/lib/permissions': permissions, '@/lib/retailcrm': {}, '@/lib/ladipage-order': {}, '@/lib/settings-cache': {}, '@/lib/order-id': {} });
    assert.equal(typeof route[method], 'function', file + ' ' + method);
    const result = await route[method]({}, { params: Promise.resolve({ id: '1' }) });
    assert.equal(result.status, 403, file + ' ' + method);
  }
});
test('order list and detail constrain queries to the active group', async () => {
  const queries = [];
  const prisma = { order: { findMany: async args => { queries.push(args.where); return []; }, count: async args => { queries.push(args.where); return 0; }, findUnique: async args => { queries.push(args.where); return null; } }, landingPage: { findMany: async args => { queries.push(args.where); return []; } } };
  const mocks = { 'next/server': next, '@/lib/prisma': { prisma }, '@/lib/require-auth': { requireAuth: async () => ({ user: member }) }, '@/lib/permissions': permissions, '@/lib/retailcrm': {}, '@/lib/ladipage-order': {} };
  const route = load('src/app/api/orders/route.ts', mocks);
  assert.equal((await route.GET({ nextUrl: new URL('http://localhost/api/orders?landingSlug=foreign') })).status, 200);
  const detail = load('src/app/api/orders/[id]/route.ts', mocks);
  assert.equal((await detail.GET({}, { params: Promise.resolve({ id: '99' }) })).status, 404);
  assert.ok(queries.length >= 4); for (const where of queries) assert.equal(where.group_id, 10);
});
test('foreign landing page cannot be updated/deleted or regenerated', async () => {
  const queries = [];
  const route = load('src/app/api/landing-pages/[id]/route.ts', {
    'next/server': next, '@/lib/prisma': { prisma: { landingPage: { findUnique: async args => { queries.push(args.where); return null; }, update: async args => { queries.push(args.where); throw new Error('not found'); } } } },
    '@/lib/require-auth': { requireAuth: async () => ({ user: member }) }, '@/lib/permissions': permissions, '@/lib/ladipage-order': {},
  });
  for (const method of ['PUT', 'DELETE', 'PATCH']) { const result = await route[method]({ json: async () => ({ name: 'x' }) }, { params: Promise.resolve({ id: '99' }) }); assert.ok(result.status >= 400); }
  for (const where of queries) { assert.equal(where.group_id, 10); assert.equal(where.deleted_at, null); }
});
