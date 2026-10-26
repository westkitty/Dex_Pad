import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('offline build copies runnable interface but never bundles repository metadata or tests', async () => {
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: new URL('.', root).pathname, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../dist/src/ui/app.js', import.meta.url), 'utf8');
  assert.match(index, /UNENCRYPTED DEVELOPMENT STORAGE/);
  assert.match(app, /openIndexedDbStore/);
  await assert.rejects(() => stat(new URL('../dist/.git/config', import.meta.url)), /ENOENT/);
  await assert.rejects(() => stat(new URL('../dist/tests/workspace.test.mjs', import.meta.url)), /ENOENT/);
});
