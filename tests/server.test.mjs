import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from '../scripts/dev-server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function withServer(fn) {
  const server = createServer({ root });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('serves a static development UI with explicit plaintext warning and safe MIME type', () => withServer(async url => {
  const response = await fetch(`${url}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(html, /UNENCRYPTED DEVELOPMENT STORAGE/);
  assert.match(response.headers.get('cache-control'), /no-store/);
}));

test('rejects hidden source/config files even if they exist in project directory', () => withServer(async url => {
  for (const path of ['/.git/config', '/.gitignore', '/package.json', '/tests/workspace.test.mjs', '/docs/SECURITY.md']) {
    const response = await fetch(`${url}${path}`);
    assert.equal(response.status, 404, path);
  }
}));

test('does not implement any API write endpoint and has local-only content policy', () => withServer(async url => {
  const response = await fetch(`${url}/api/write`, { method: 'POST', body: 'private data' });
  assert.equal(response.status, 405);
  const page = await fetch(`${url}/`);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.match(page.headers.get('x-content-type-options'), /nosniff/);
}));
