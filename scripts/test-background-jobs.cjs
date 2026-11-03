const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/instrumentation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function setup(env, fetchImpl) {
  let id = 0; const timers = new Map(); const calls = [];
  const context = { exports: {}, process: { env: { NODE_ENV: 'development', ...env } }, console: { log() {}, error() {} },
    setTimeout: (fn, ms) => { const key = ++id; timers.set(key, { fn, ms, interval: false }); return key; },
    setInterval: (fn, ms) => { const key = ++id; timers.set(key, { fn, ms, interval: true }); return key; },
    clearTimeout: key => timers.delete(key), fetch: async (...args) => { calls.push(args); return fetchImpl ? fetchImpl() : { ok: true, json: async () => ({ skipped: true, message: 'empty' }) }; },
  };
  vm.createContext(context); vm.runInContext('(function(){' + code + '\n})();', context);
  return { context, timers, calls, reload() { vm.runInContext('(function(){' + code + '\n})();', context); }, register: () => context.exports.register() };
}
test('dev configured 5-minute sheets job starts after 15s and does not schedule cleanup', async () => {
  const s = setup({ SHEETS_EXPORT_INTERVAL_MINUTES: '5', CRON_SECRET: 'test' }); s.register();
  assert.deepEqual([...s.timers.values()].map(t => t.ms), [15000, 300000]);
  await [...s.timers.values()][0].fn();
  assert.equal(s.calls[0][0], 'http://localhost:3000/api/cron/export-sheets');
  assert.equal(s.calls[0][1].headers['x-cron-secret'], 'test');
});
test('dev without valid interval remains idle, edge/test runtimes do not start timers', () => {
  for (const env of [{}, { SHEETS_EXPORT_INTERVAL_MINUTES: '0' }, { SHEETS_EXPORT_INTERVAL_MINUTES: 'bad' },
    { SHEETS_EXPORT_INTERVAL_MINUTES: 'Infinity' }, { NODE_ENV: 'test', SHEETS_EXPORT_INTERVAL_MINUTES: '5' },
    { NEXT_RUNTIME: 'edge', SHEETS_EXPORT_INTERVAL_MINUTES: '5' }]) {
    const s = setup(env); s.register(); assert.equal(s.timers.size, 0);
  }
});
test('register/reload does not duplicate timers; changing config replaces schedule', () => {
  const s = setup({ SHEETS_EXPORT_INTERVAL_MINUTES: '5' });
  s.register(); s.reload(); s.register(); assert.equal(s.timers.size, 2);
  s.context.process.env.SHEETS_EXPORT_INTERVAL_MINUTES = '2'; s.register();
  assert.equal(s.timers.size, 2); assert.ok([...s.timers.values()].some(t => t.ms === 120000));
});
test('slow job never overlaps interval tick', async () => {
  let finish;
  const s = setup({ SHEETS_EXPORT_INTERVAL_MINUTES: '5' }, () => new Promise(resolve => { finish = resolve; })); s.register();
  const callbacks = [...s.timers.values()]; const running = callbacks[0].fn();
  await callbacks[1].fn(); assert.equal(s.calls.length, 1);
  finish({ ok: true, json: async () => ({ success: true }) }); await running;
  const next = callbacks[1].fn(); assert.equal(s.calls.length, 2);
  finish({ ok: true, json: async () => ({ success: true }) }); await next;
});
test('production retains daily cleanup and sheets schedules', () => {
  const s = setup({ NODE_ENV: 'production' }); s.register(); assert.equal(s.timers.size, 4);
});
