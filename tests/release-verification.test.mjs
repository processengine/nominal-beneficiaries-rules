import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { waitForPublishedMetadata, verifyArchiveIntegrity } from '../scripts/verify-published.mjs';

const bytes = Buffer.from('synthetic archive');
const value = {
  name: '@processengine/nominal-beneficiaries-rules', version: '2.0.16', gitHead: 'a'.repeat(40),
  dist: { integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    tarball: 'https://registry.npmjs.org/@processengine/nominal-beneficiaries-rules/-/nominal-beneficiaries-rules-2.0.16.tgz' },
};
function verify(responses, patch = {}) {
  let time = 0;
  return waitForPublishedMetadata({ name: value.name, version: value.version, commit: value.gitHead,
    now: () => time, delay: async ms => { time += ms; }, timeoutMs: 20, pollMs: 5, log: () => {},
    fetchMetadata: async (url, options) => {
      assert.equal(url, 'https://registry.npmjs.org/%40processengine%2Fnominal-beneficiaries-rules/2.0.16');
      assert.equal(options.headers['cache-control'], 'no-cache');
      const next = responses.length > 1 ? responses.shift() : responses[0];
      if (next instanceof Error) throw next;
      return { status: next, json: async () => ({ ...value, ...patch }) };
    } });
}

test('Точные метаданные сохраняют SHA и integrity без подписей и окружения', async () => {
  assert.deepEqual(await verify([200]), value);
});
test('Временные 404, 503 и сетевой сбой требуют последующего точного совпадения', async () => {
  assert.deepEqual(await verify([404, 503, new TypeError('network'), 200]), value);
});
test('Не появившаяся версия завершает ожидание ошибкой', async () => {
  await assert.rejects(verify([404]), /did not become readable/);
});
for (const status of [401, 403]) test(`HTTP ${status} не выдаётся за успешную публикацию`, async () => {
  await assert.rejects(verify([status]), /metadata request failed/);
});
for (const [label, patch] of [
  ['SHA', { gitHead: 'b'.repeat(40) }], ['имя', { name: 'other' }],
  ['версия', { version: '2.0.15' }], ['отсутствующий SHA', { gitHead: undefined }],
  ['integrity', { dist: { ...value.dist, integrity: 'sha1-invalid' } }],
  ['другой registry', { dist: { ...value.dist, tarball: 'https://example.org/package.tgz' } }],
]) test(`Несовпадение ${label} останавливает проверку`, async () => {
  await assert.rejects(verify([200], patch));
});
test('Архив обязан совпасть с sha512 точных метаданных', () => {
  verifyArchiveIntegrity(value, bytes);
  assert.throws(() => verifyArchiveIntegrity(value, Buffer.from('modified')), /integrity mismatch/);
});
