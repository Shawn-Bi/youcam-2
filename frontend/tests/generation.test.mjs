import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, requireMock, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: requireMock, console: { info() {} }, ...globals });
  return exports;
}
function polling(fetchStatus, timeoutMs = 915000) {
  let state, now = 0, pending, cleanup;
  const effects = [];
  class ApiError extends Error { constructor(status) { super(); this.status = status; } }
  const react = { useState: () => [null, (value) => { state = value; }], useRef: (value) => ({ current: value }), useEffect: (fn) => effects.push(fn) };
  const { usePollStatus: poll } = load('lib/usePollStatus.ts', (name) => name === 'react' ? react : { ApiError }, { Date: { now: () => now }, setTimeout: (fn) => { pending = fn; return 1; }, clearTimeout: () => { pending = null; } });
  poll('existing-task', fetchStatus, { timeoutMs });
  effects.forEach((fn) => { cleanup = fn() || cleanup; });
  return { ApiError, state: () => state, advance: async (ms) => { now += ms; const fn = pending; pending = null; if (fn) await fn(); await Promise.resolve(); }, stop: () => cleanup() };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
test('slow video survives four minutes and reads success at its final boundary', async () => {
  let calls = 0;
  const hook = polling(async (id) => { assert.equal(id, 'existing-task'); return ++calls === 3 ? { status: 'success', videoUrl: 'https://example.com/video' } : { status: 'running' }; });
  await flush(); await hook.advance(241000); assert.equal(hook.state().status, 'running');
  await hook.advance(674000); assert.equal(hook.state().status, 'success');
});
test('transport failure keeps polling; missing task offers recovery rather than failure', async () => {
  let calls = 0, hook;
  hook = polling(async () => { if (++calls === 1) throw new Error('offline'); throw new hook.ApiError(404); });
  await flush(); assert.equal(hook.state().status, 'running');
  await hook.advance(2000); assert.equal(hook.state().status, 'unavailable');
});
test('uncertain result stops polling without creating another task', async () => {
  let calls = 0;
  const hook = polling(async () => { calls++; return { status: 'uncertain' }; });
  await flush(); await hook.advance(999999); assert.equal(calls, 1); assert.equal(hook.state().status, 'uncertain');
});
test('unmounted poll ignores late responses', async () => {
  let resolve;
  const hook = polling(() => new Promise((done) => { resolve = done; }));
  hook.stop(); resolve({ status: 'success' }); await flush(); assert.equal(hook.state().status, 'queued');
});
test('warmup is one health request, tolerates failure, and skips mock mode', async () => {
  for (const mock of [false, true]) {
    let calls = 0;
    const api = load('lib/api.ts', () => ({}), { process: { env: { NEXT_PUBLIC_USE_MOCKS: String(mock) } }, performance: { now: () => 0 }, AbortSignal: { timeout: () => undefined }, fetch: async (url) => { assert.equal(url, '/api/health'); calls++; throw new Error('sleeping'); } });
    await Promise.all([api.warmBackend(), api.warmBackend()]);
    assert.equal(calls, mock ? 0 : 1);
  }
});
