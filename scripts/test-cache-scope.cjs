const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const ts = require('typescript'); const { QueryClient } = require('@tanstack/react-query');
const moduleValue = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('src/lib/query-scope.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(moduleValue, moduleValue.exports);
const { queryScope } = moduleValue.exports;
test('switching accounts never reuses private query data within staleTime', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, gcTime: Infinity, retry: false } } });
  try {
    const a = queryScope({ id: 13, role: 'ADMIN2', group_id: 7 }); const b = queryScope({ id: 14, role: 'ADMIN2', group_id: 8 });
    for (const resource of ['orders', 'landing-pages']) {
      client.setQueryData([resource, a, ''], [{ group_id: 7 }]);
      assert.equal(client.getQueryData([resource, b, '']), undefined);
      const data = await client.fetchQuery({ queryKey: [resource, b, ''], queryFn: async () => [] });
      assert.deepEqual(data, []); assert.deepEqual(client.getQueryData([resource, a, '']), [{ group_id: 7 }]);
    }
    await client.cancelQueries(); client.clear(); assert.equal(client.getQueryCache().getAll().length, 0);
  } finally { client.clear(); }
});
test('same account changing group or role uses a different cache namespace', () => {
  const original = queryScope({ id: 1, role: 'ADMIN2', group_id: 7 });
  assert.notEqual(original, queryScope({ id: 1, role: 'ADMIN2', group_id: 8 }));
  assert.notEqual(original, queryScope({ id: 1, role: 'ADMIN', group_id: 7 }));
});
