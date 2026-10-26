import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandoffPacket } from '../src/core/handoff.js';
import { getChangesSinceLastVisit } from '../src/core/resume-diff.js';
import { createWorkspace } from '../src/core/workspace.js';
import { createMemoryStore } from '../src/storage/memory.js';

test('1. createHandoffPacket exports ONLY user-selected items without leaking other vault items (F06)', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const secretItem = await workspace.create({ title: 'Private Unselected Note', body: 'Confidential personal note' });
  const selected1 = await workspace.create({
    title: 'Architecture Blueprint',
    body: 'Candidate C sync engine details.',
    evidence: 'verified',
    evidenceRef: 'tests/sync-engine.test.mjs',
  });
  const selected2 = await workspace.create({
    kind: 'project',
    title: 'DEX//Pad Core Delivery',
    nextAction: 'Implement Project Continuity Superpowers',
    evidence: 'observed',
  });

  const packet = await createHandoffPacket({
    workspace,
    selectedItemIds: [selected1.id, selected2.id],
    constraints: [
      'Preserve zero external package invariant',
      'Require test-driven implementation',
    ],
    purpose: 'Autonomous coding agent prompt context',
  });

  assert.equal(packet.schemaVersion, 'dex-handoff.v1');
  assert.equal(packet.selectedItems.length, 2);
  assert.ok(packet.constraints.includes('Preserve zero external package invariant'));

  const itemIds = packet.selectedItems.map(i => i.id);
  assert.ok(itemIds.includes(selected1.id));
  assert.ok(itemIds.includes(selected2.id));
  assert.ok(!itemIds.includes(secretItem.id), 'Unselected items must NEVER be included in the handoff packet');

  // Verify evidence states are preserved
  const item1 = packet.selectedItems.find(i => i.id === selected1.id);
  assert.equal(item1.evidence, 'verified');
  assert.equal(item1.evidenceRef, 'tests/sync-engine.test.mjs');
});

test('2. createHandoffPacket includes evidence breakdown and rejects empty selections (F06)', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const item = await workspace.create({ title: 'Task Card', evidence: 'proposed' });

  const packet = await createHandoffPacket({
    workspace,
    selectedItemIds: [item.id],
  });

  assert.equal(packet.evidenceSummary.proposed, 1);
  assert.equal(packet.evidenceSummary.verified, 0);

  await assert.rejects(
    () => createHandoffPacket({ workspace, selectedItemIds: [] }),
    /Selection cannot be empty/
  );
});

test('3. getChangesSinceLastVisit returns events and revisions since timestamp for a project (F18)', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  // 1. Create project at T0
  const project = await workspace.create({
    kind: 'project',
    title: 'Continuity Mission',
    nextAction: 'Draft architecture',
  });

  const lastVisit = new Date().toISOString();

  // Small delay to simulate passing time
  await new Promise(r => setTimeout(r, 20));

  // 2. Work done while away: update project nextAction & create linked notes
  const updatedProject = await workspace.update(
    project.id,
    { nextAction: 'Implement relations graph', blocker: 'Awaiting subagent review' },
    project.revision
  );

  const linkedNote = await workspace.create({
    kind: 'note',
    title: 'Relations Spec',
    body: 'Wikilink parsing design.',
    projectId: project.id,
    evidence: 'observed',
  });

  const diff = await getChangesSinceLastVisit({
    store,
    workspace,
    projectId: project.id,
    lastVisitUtc: lastVisit,
  });

  assert.equal(diff.projectId, project.id);
  assert.ok(diff.revisionsSinceLastVisit.length >= 2);
  assert.equal(diff.latestNextAction, 'Implement relations graph');
  assert.equal(diff.currentBlocker, 'Awaiting subagent review');
});

test('4. getChangesSinceLastVisit separates empirical recorded observations from inferred impact (F18)', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const project = await workspace.create({ kind: 'project', title: 'Radar Project' });
  const t0 = new Date().toISOString();
  await new Promise(r => setTimeout(r, 15));

  // Add verified note with concrete proof
  await workspace.create({
    title: 'Verified Discovery',
    projectId: project.id,
    evidence: 'verified',
    evidenceRef: 'commit:92e77ad',
  });

  // Add proposed speculative note
  await workspace.create({
    title: 'Speculative Idea',
    projectId: project.id,
    evidence: 'proposed',
  });

  const diff = await getChangesSinceLastVisit({
    store,
    workspace,
    projectId: project.id,
    lastVisitUtc: t0,
  });

  // Recorded observations contains only concrete evidence
  assert.ok(diff.recordedObservations.some(o => o.title === 'Verified Discovery'));
  assert.ok(!diff.recordedObservations.some(o => o.title === 'Speculative Idea'));

  // Inferred impact summarizes overall activity
  assert.ok(diff.inferredImpact.summary);
  assert.equal(diff.inferredImpact.newRevisionsCount, 2);
});
