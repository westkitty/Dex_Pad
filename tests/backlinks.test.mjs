import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractItemReferences,
  buildKnowledgeGraph,
  getBacklinksForItem,
  getOutgoingLinksForItem,
} from '../src/core/relations.js';
import { createWorkspace } from '../src/core/workspace.js';
import { createMemoryStore } from '../src/storage/memory.js';

test('1. extracts wikilinks and structured references from item body and metadata', () => {
  const item = {
    id: 'note-001',
    kind: 'note',
    title: 'Architecture Guide',
    body: 'Refer to [[dec-001]] for sync decisions and [[note-002]] for storage design.',
    projectId: 'proj-alpha',
    references: [
      { id: 'note-003', relation: 'related' },
    ],
  };

  const refs = extractItemReferences(item);
  assert.equal(refs.length, 4);

  const targets = refs.map(r => r.targetId);
  assert.ok(targets.includes('dec-001'));
  assert.ok(targets.includes('note-002'));
  assert.ok(targets.includes('proj-alpha'));
  assert.ok(targets.includes('note-003'));
});

test('2. builds knowledge graph and queries incoming backlinks', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const noteA = await workspace.create({ title: 'Foundation Specs' });
  const noteB = await workspace.create({
    title: 'Security Review',
    body: `This document audits [[${noteA.id}]] against AEAD requirements.`,
  });
  const noteC = await workspace.create({
    title: 'Implementation Checklist',
    body: `Follow checklist derived from [[${noteA.id}]].`,
  });

  const allItems = await workspace.list({ includeDeleted: true });
  const graph = buildKnowledgeGraph(allItems);

  const backlinksToA = getBacklinksForItem({ graph, itemId: noteA.id });
  assert.equal(backlinksToA.length, 2);

  const sourceIds = backlinksToA.map(b => b.sourceId);
  assert.ok(sourceIds.includes(noteB.id));
  assert.ok(sourceIds.includes(noteC.id));
  assert.ok(backlinksToA.every(b => !b.brokenTarget));
});

test('3. preserves incoming links when target item is renamed (stable relation invariant)', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const target = await workspace.create({ title: 'Original Target Title' });
  const source = await workspace.create({
    title: 'Linking Note',
    body: `Link to [[${target.id}]].`,
  });

  // Rename target item
  const renamed = await workspace.update(
    target.id,
    { title: 'Brand New Target Title' },
    target.revision
  );
  assert.equal(renamed.title, 'Brand New Target Title');

  const allItems = await workspace.list({ includeDeleted: true });
  const graph = buildKnowledgeGraph(allItems);

  const backlinks = getBacklinksForItem({ graph, itemId: target.id });
  assert.equal(backlinks.length, 1);
  assert.equal(backlinks[0].sourceId, source.id);
  assert.equal(backlinks[0].brokenTarget, false);
});

test('4. surfaces broken-target indicator when referenced item is missing or deleted', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const ephemeral = await workspace.create({ title: 'Temporary Note' });
  const source = await workspace.create({
    title: 'Source Document',
    body: `Links to [[${ephemeral.id}]] and missing [[non-existent-uuid]].`,
  });

  // Soft-delete ephemeral note
  await workspace.remove(ephemeral.id, ephemeral.revision);

  const allItems = await workspace.list({ includeDeleted: true });
  const graph = buildKnowledgeGraph(allItems);

  const outgoing = getOutgoingLinksForItem({ graph, itemId: source.id });
  assert.equal(outgoing.length, 2);

  const broken = outgoing.filter(l => l.brokenTarget);
  assert.equal(broken.length, 2);
  assert.ok(broken.some(b => b.targetId === ephemeral.id));
  assert.ok(broken.some(b => b.targetId === 'non-existent-uuid'));
});

test('5. indexes decision superseding links in the knowledge graph', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const decOld = await workspace.create({
    kind: 'decision',
    title: 'Old Protocol',
    evidence: 'proposed',
  });
  const decNew = await workspace.create({
    kind: 'decision',
    title: 'New Protocol',
    supersedes: decOld.id,
    evidence: 'verified',
    evidenceRef: 'commit:7eb8392',
  });

  const allItems = await workspace.list({ includeDeleted: true });
  const graph = buildKnowledgeGraph(allItems);

  const backlinksToOld = getBacklinksForItem({ graph, itemId: decOld.id });
  assert.equal(backlinksToOld.length, 1);
  assert.equal(backlinksToOld[0].sourceId, decNew.id);
  assert.equal(backlinksToOld[0].relation, 'supersedes');
});

test('6. safely handles circular references without infinite loops', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const note1 = await workspace.create({ title: 'Node 1' });
  const note2 = await workspace.create({
    title: 'Node 2',
    body: `Links back to [[${note1.id}]].`,
  });
  // Update note1 to link to note2 creating cycle
  await workspace.update(note1.id, { body: `Links forward to [[${note2.id}]].` }, note1.revision);

  const allItems = await workspace.list({ includeDeleted: true });
  const graph = buildKnowledgeGraph(allItems);

  const back1 = getBacklinksForItem({ graph, itemId: note1.id });
  const back2 = getBacklinksForItem({ graph, itemId: note2.id });

  assert.equal(back1.length, 1);
  assert.equal(back1[0].sourceId, note2.id);
  assert.equal(back2.length, 1);
  assert.equal(back2[0].sourceId, note1.id);
});
