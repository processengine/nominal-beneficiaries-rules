import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function waitForPublishedMetadata({
  name, version, commit, fetchMetadata = globalThis.fetch,
  now = Date.now, delay = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = 600_000, pollMs = 5_000, log = console.error,
}) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const deadline = now() + timeoutMs;
  let attempt = 0;
  while (now() < deadline) {
    let response;
    try {
      response = await fetchMetadata(url, {
        headers: { accept: 'application/json', 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      log(`Registry attempt ${++attempt}: network ${error.name}`);
      await delay(Math.min(pollMs, Math.max(0, deadline - now())));
      continue;
    }
    log(`Registry attempt ${++attempt}: HTTP ${response.status}`);
    if (response.status === 404 || response.status >= 500) {
      await delay(Math.min(pollMs, Math.max(0, deadline - now())));
      continue;
    }
    assert.equal(response.status, 200, 'Public registry metadata request failed');
    const value = await response.json();
    assert.equal(value.name, name, 'Published package name mismatch');
    assert.equal(value.version, version, 'Published package version mismatch');
    assert.equal(value.gitHead, commit, 'Published gitHead mismatch');
    assert.match(value.dist?.integrity ?? '', /^sha512-[A-Za-z0-9+/]+={0,2}$/);
    const tarball = new URL(value.dist.tarball);
    assert.equal(tarball.origin, 'https://registry.npmjs.org');
    assert.equal(tarball.username + tarball.password + tarball.search + tarball.hash, '');
    return { name, version, gitHead: value.gitHead,
      dist: { integrity: value.dist.integrity, tarball: tarball.href } };
  }
  throw new Error(`Published version ${name}@${version} did not become readable within ${timeoutMs}ms`);
}

export function verifyArchiveIntegrity(metadata, bytes) {
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  assert.equal(integrity, metadata.dist.integrity, 'Registry archive integrity mismatch');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'metadata') {
    const [name, version, commit, output] = args;
    assert(name && version && commit && output && args.length === 4);
    const metadata = await waitForPublishedMetadata({ name, version, commit });
    writeFileSync(output, `${JSON.stringify(metadata, null, 2)}\n`);
  } else if (mode === 'archive') {
    assert.equal(args.length, 2);
    verifyArchiveIntegrity(JSON.parse(readFileSync(args[0], 'utf8')), readFileSync(args[1]));
  } else {
    throw new Error('Usage: verify-published.mjs metadata <name> <version> <commit> <output> | archive <metadata> <tarball>');
  }
}
