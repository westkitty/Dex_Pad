import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/core/workspace.js';
import { createMemoryStore } from '../src/storage/memory.js';

test('1. creates structured decision record with rationale, alternatives, and review date (F03)', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const decision = await workspace.create({
    kind: 'decision',
    title: 'Adopt Candidate C Journal-Based Sync Engine',
    body: 'We choose candidate C sync engine over Automerge/Yjs for zero runtime dependencies and predictable conflict recovery.',
    rationale: 'Zero external packages, audited replay idempotency, full control over key lifecycle.',
    alternatives: [
      'Automerge (wasm/rust dependency too heavy)',
      'Yjs (requires third-party bundle and custom crypto wrapper)',
    ],
    reviewDate: '2026-12-01',
    evidence: 'verified',
    evidenceRef: 'tests/sync-engine.test.mjs:8-point-fault-matrix',
  });

  assert.equal(decision.kind, 'decision');
  assert.equal(decision.rationale, 'Zero external packages, audited replay idempotency, full control over key lifecycle.');
  assert.equal(decision.alternatives.length, 2);
  assert.equal(decision.reviewDate, '2026-12-01');
  assert.equal(decision.supersededBy, null);
  assert.equal(decision.supersedes, null);
});

test('2. decision superseding links preserve discarded decisions as visible history without current authority (F03)', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  // Original decision
  const dec1 = await workspace.create({
    kind: 'decision',
    title: 'Use In-Memory Sync Mock',
    body: 'Temporary sync harness.',
    rationale: 'Quick prototype bootstrap.',
    evidence: 'proposed',
  });

  // Superseding decision
  const dec2 = await workspace.create({
    kind: 'decision',
    title: 'Replace Mock with Web Crypto Candidate C Sync Engine',
    body: 'Full authenticated encryption and replay idempotency.',
    rationale: 'Production cryptographic requirement.',
    supersedes: dec1.id,
    evidence: 'verified',
    evidenceRef: 'commit:16efa42',
  });

  // Link dec1 as superseded by dec2
  const updatedDec1 = await workspace.update(dec1.id, { supersededBy: dec2.id }, dec1.revision);

  assert.equal(updatedDec1.supersededBy, dec2.id);
  assert.equal(dec2.supersedes, dec1.id);

  // Both decisions exist in store; dec1 is superseded, dec2 is current
  const allDecisions = await workspace.list({ kind: 'decision' });
  assert.equal(allDecisions.length, 2);
  const found1 = allDecisions.find(d => d.id === dec1.id);
  const found2 = allDecisions.find(d => d.id === dec2.id);
  assert.equal(found1.supersededBy, dec2.id);
  assert.equal(found2.supersededBy, null);
});

test('3. creates and updates incident card preserving failure, reproduction, repair, and proof (F05)', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const incident = await workspace.create({
    kind: 'incident',
    title: 'Revision Restore Buttons Disabled After Note Save',
    body: 'UI bug where restore buttons in revisions panel remain permanently disabled after saving.',
    failureDescription: 'saveItem() called renderEditor() inside try block while saving=true, disabling all buttons.',
    reproductionSteps: '1. Create note. 2. Edit note and save. 3. Look at revisions panel restore buttons.',
    confirmedRepair: 'Moved renderEditor() and renderList() outside saving=true block, executing only after saving=false.',
    regressionProof: 'tests/browser_smoke.py:line-42-revisions-panel-click',
    status: 'investigating',
    evidence: 'observed',
  });

  assert.equal(incident.kind, 'incident');
  assert.equal(incident.status, 'investigating');
  assert.ok(incident.failureDescription);
  assert.ok(incident.reproductionSteps);
  assert.ok(incident.confirmedRepair);
  assert.ok(incident.regressionProof);

  // Resolve incident
  const resolved = await workspace.update(
    incident.id,
    { status: 'resolved', evidence: 'verified', evidenceRef: 'tests/browser_smoke.py' },
    incident.revision
  );

  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.evidence, 'verified');
  assert.equal(resolved.revision, 2);
});

test('4. creates outstanding commitment with owner, expected outcome, and review date (F08)', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const commitment = await workspace.create({
    kind: 'commitment',
    title: 'Run Physical Android Tailscale Multi-Device Convergence Test',
    body: 'Test Candidate C sync engine across real MacBook Air, Pixel 8 phone, and Galaxy Tab over Tailscale.',
    owner: 'WestKitty',
    expectedOutcome: 'Three real physical devices converge without data loss after simulated network drops.',
    reviewDate: '2026-11-15',
    status: 'pending',
    evidence: 'proposed',
  });

  assert.equal(commitment.kind, 'commitment');
  assert.equal(commitment.owner, 'WestKitty');
  assert.equal(commitment.expectedOutcome, 'Three real physical devices converge without data loss after simulated network drops.');
  assert.equal(commitment.status, 'pending');
  assert.equal(commitment.reviewDate, '2026-11-15');

  // Advance commitment to in-progress
  const inProgress = await workspace.update(
    commitment.id,
    { status: 'in-progress' },
    commitment.revision
  );
  assert.equal(inProgress.status, 'in-progress');
});

test('5. rejects invalid kinds and malformed fields', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  await assert.rejects(
    () => workspace.create({ kind: 'unsupported-arbitrary-kind' }),
    /Unsupported item kind/
  );

  await assert.rejects(
    () => workspace.create({ kind: 'decision', rationale: 12345 }),
    /rationale must be text/
  );
});
