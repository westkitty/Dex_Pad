import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/core/workspace.js';
import { createMemoryStore } from '../src/storage/memory.js';

function fixture(store = createMemoryStore()) {
  let counter = 0;
  const space = createWorkspace(store, {
    id: () => `generated-${++counter}`,
    now: () => `2026-10-25T12:00:${String(counter).padStart(2, '0')}Z`,
  });
  return { space, store };
}

test('creates a titleless note and can retrieve it from local store', async () => {
  const { space } = fixture();
  const note = await space.create({ body: 'A quick thought' });
  assert.equal(note.title, '');
  assert.equal(note.kind, 'note');
  assert.equal(note.revision, 1);
  assert.equal(note.body, 'A quick thought');
  assert.deepEqual((await space.list()).map(i => i.id), [note.id]);
  assert.equal((await space.history(note.id)).length, 1);
});

test('searches synthetic project and note contents without including deleted notes', async () => {
  const { space } = fixture();
  const project = await space.create({ kind: 'project', title: 'DexPad', body: 'Develop secure sync', nextAction: 'Test storage' });
  const note = await space.create({ title: 'Recipe', body: 'Rice and cheese', tags: ['food'] });
  assert.deepEqual((await space.list({ query: 'secure' })).map(n => n.id), [project.id]);
  assert.deepEqual((await space.list({ kind: 'note', query: 'food' })).map(n => n.id), [note.id]);
  await space.remove(note.id, note.revision);
  assert.deepEqual((await space.list({ kind: 'note' })).map(n => n.id), []);
});

test('rejects stale revision without overwriting the newer content', async () => {
  const { space } = fixture();
  const note = await space.create({ body: 'first' });
  const latest = await space.update(note.id, { body: 'second' }, 1);
  await assert.rejects(() => space.update(note.id, { body: 'stale' }, 1), /stale revision/i);
  const [current] = await space.list();
  assert.equal(current.body, 'second');
  assert.equal(current.revision, 2);
  assert.equal(latest.revision, 2);
});

test('requires a supporting reference for claimed verified evidence', async () => {
  const { space } = fixture();
  await assert.rejects(() => space.create({ kind: 'decision', title: 'Done', evidence: 'verified' }), /evidence reference/i);
  const decision = await space.create({ kind: 'decision', title: 'Done', evidence: 'verified', evidenceRef: 'git:abc123' });
  assert.equal(decision.evidence, 'verified');
  assert.equal(decision.evidenceRef, 'git:abc123');
  await assert.rejects(() => space.update(decision.id, { evidenceRef: '' }, 1), /evidence reference/i);
});

test('soft deletion and restoring an earlier revision preserves the full revision trail', async () => {
  const { space } = fixture();
  const note = await space.create({ title: 'Initial', body: 'Original' });
  await space.update(note.id, { body: 'Different' }, 1);
  await space.remove(note.id, 2);
  assert.equal((await space.list()).length, 0);
  const restored = await space.restore(note.id, 1, 3);
  assert.equal(restored.revision, 4);
  assert.equal(restored.deletedAt, null);
  assert.equal(restored.body, 'Original');
  assert.deepEqual((await space.history(note.id)).map(x => x.revision), [1, 2, 3, 4]);
  assert.equal((await space.list()).length, 1);
});

test('a failed commit rejects rather than advertising a saved note', async () => {
  const store = createMemoryStore();
  store.setCommitError(new Error('Storage quota exceeded'));
  const { space } = fixture(store);
  await assert.rejects(() => space.create({ body: 'Never persisted' }), /Storage quota exceeded/);
  assert.equal((await space.list()).length, 0);
});

test('untrusted markup stays plain text in the persisted body', async () => {
  const { space } = fixture();
  const markup = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  const note = await space.create({ body: markup });
  assert.equal((await space.list())[0].body, markup);
  assert.equal(note.body, markup);
});

test('exports a deterministic development-only manifest with history and provenance', async () => {
  const { space } = fixture();
  await space.create({ title: 'Demo', body: 'Synthetic only', kind: 'project', provenance: { origin: 'human' } });
  const packet = await space.exportData();
  assert.equal(packet.schemaVersion, '0-dev');
  assert.equal(packet.unencrypted, true);
  assert.equal(packet.items.length, 1);
  assert.equal(packet.revisions.length, 1);
  assert.equal(packet.items[0].provenance.origin, 'human');
});
