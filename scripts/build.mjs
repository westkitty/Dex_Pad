import { copyFile, mkdir, lstat, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'dist');
try {
  const stat = await lstat(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Refusing to write through a non-directory or symlink dist target');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const allow = [
  'index.html', 'styles.css',
  'src/core/workspace.js', 'src/core/contributions.js', 'src/core/relations.js',
  'src/core/handoff.js', 'src/core/resume-diff.js',
  'src/core/sources.js', 'src/core/radar.js',
  'src/core/media-annotations.js', 'src/core/review-queue.js',
  'src/core/github-anchors.js', 'src/core/runbooks.js',
  'src/core/crypto/primitives.js', 'src/core/crypto/vault.js', 'src/core/crypto/backup.js',
  'src/core/sync/engine.js',
  'src/core/migration/standard-notes.js',
  'src/storage/indexeddb.js', 'src/storage/memory.js',
  'src/ui/app.js',
  'src/integrations/relay/bridge.js', 'src/integrations/relay/validator.js',
];
for (const path of allow) {
  const file = resolve(target, path);
  await mkdir(dirname(file), { recursive: true });
  await copyFile(resolve(root, path), file);
}
await writeFile(resolve(target, 'DEVELOPMENT_ONLY.txt'), 'DEX//Pad DEVELOPMENT PREVIEW. UNENCRYPTED BROWSER STORAGE. SYNTHETIC DATA ONLY. No sync or privacy guarantee.\n');
console.log(`Built ${allow.length} client assets into dist/ (synthetic-data sandbox only).`);
