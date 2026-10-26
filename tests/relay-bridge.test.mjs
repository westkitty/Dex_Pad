import test from 'node:test';
import assert from 'node:assert/strict';
import { createRelayBridge, validateRelayEvent, RelayError } from '../src/integrations/relay/bridge.js';
import { createWorkspace } from '../src/core/workspace.js';
import { createMemoryStore } from '../src/storage/memory.js';

function makeValidEvent(overrides = {}) {
  return {
    schemaVersion: 'dex-relay.event.v1',
    eventId: 'evt-00000001',
    taskId: 'task-test-1234',
    correlationId: 'corr-test-5678',
    sourceNodeId: 'macbook-node',
    targetNodeId: 'bigmac-node',
    idempotencyKey: 'idemp-key-001',
    sequence: 1,
    previousEventHash: null,
    eventHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    receiptHash: null,
    resultHash: null,
    action: 'CLAUDE_COMPLETED',
    stage: 'CLAUDE_DONE',
    atUtc: '2026-10-25T20:00:00.000Z',
    payload: { summary: 'Implementation phase completed' },
    ...overrides,
  };
}

async function setupBridge() {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);
  const project = await workspace.create({ kind: 'project', title: 'Test Project' });
  const bridge = createRelayBridge({ store, workspace });
  return { store, workspace, project, bridge };
}

test('valid event accepted and associated with explicit project', async () => {
  const { bridge, project } = await setupBridge();
  const event = makeValidEvent();

  const record = await bridge.ingestEvent(project.id, event);
  assert.equal(record.eventId, event.eventId);
  assert.equal(record.projectId, project.id);
  assert.equal(record.sequence, 1);
  assert.equal(record.verificationStatus, 'CLAIMED');
  assert.equal(record.trustedProof, false);

  const timeline = await bridge.getProjectTimeline(project.id);
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].eventId, event.eventId);
});

test('duplicate event ignored safely (idempotent)', async () => {
  const { bridge, project } = await setupBridge();
  const event = makeValidEvent();

  const first = await bridge.ingestEvent(project.id, event);
  const second = await bridge.ingestEvent(project.id, event);
  assert.equal(first.eventId, second.eventId);
  assert.equal(second.idempotentDuplicate, true);

  const timeline = await bridge.getProjectTimeline(project.id);
  assert.equal(timeline.length, 1);
});

test('conflicting duplicate event rejected with error', async () => {
  const { bridge, project } = await setupBridge();
  const event = makeValidEvent();
  await bridge.ingestEvent(project.id, event);

  const conflicting = makeValidEvent({ stage: 'BLOCKED', action: 'BLOCKED' });
  await assert.rejects(
    () => bridge.ingestEvent(project.id, conflicting),
    /Idempotency conflict/
  );
});

test('unsupported schema rejected', async () => {
  const { bridge, project } = await setupBridge();
  const event = makeValidEvent({ schemaVersion: 'unsupported.schema.v99' });

  await assert.rejects(
    () => bridge.ingestEvent(project.id, event),
    /Unsupported schema/
  );
});

test('malformed hash rejected', async () => {
  const { bridge, project } = await setupBridge();
  const invalidHashes = ['not-a-hex', '1234', 'Z'.repeat(64), 'a1b2c3'];

  for (const badHash of invalidHashes) {
    const event = makeValidEvent({ eventHash: badHash });
    await assert.rejects(
      () => bridge.ingestEvent(project.id, event),
      /Invalid hash syntax/
    );
  }
});

test('oversized payload rejected (>64KB)', async () => {
  const { bridge, project } = await setupBridge();
  const oversizedData = 'x'.repeat(70_000);
  const event = makeValidEvent({ payload: { big: oversizedData } });

  await assert.rejects(
    () => bridge.ingestEvent(project.id, event),
    /Payload exceeds maximum/
  );
});

test('out-of-order event handled without inventing history (missing predecessor surfaced)', async () => {
  const { bridge, project } = await setupBridge();
  const eventSeq2 = makeValidEvent({
    eventId: 'evt-00000002',
    sequence: 2,
    previousEventHash: '0000000000000000000000000000000000000000000000000000000000000001',
    eventHash: 'b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1',
  });

  const record = await bridge.ingestEvent(project.id, eventSeq2);
  assert.equal(record.streamIntegrity, 'MISSING_PREDECESSOR');

  const timeline = await bridge.getProjectTimeline(project.id);
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].streamIntegrity, 'MISSING_PREDECESSOR');
  assert.equal(timeline[0].isCompleteStream, false);
});

test('missing predecessor surfaced when hash does not match previous', async () => {
  const { bridge, project } = await setupBridge();
  const event1 = makeValidEvent();
  await bridge.ingestEvent(project.id, event1);

  const event2BadPrev = makeValidEvent({
    eventId: 'evt-00000002',
    sequence: 2,
    previousEventHash: 'f'.repeat(64), // Does NOT match event1.eventHash
    eventHash: 'b'.repeat(64),
  });

  const record = await bridge.ingestEvent(project.id, event2BadPrev);
  assert.equal(record.streamIntegrity, 'HASH_CHAIN_MISMATCH');

  const timeline = await bridge.getProjectTimeline(project.id);
  assert.equal(timeline[1].streamIntegrity, 'HASH_CHAIN_MISMATCH');
});

test('cross-project association denied', async () => {
  const { bridge } = await setupBridge();
  const event = makeValidEvent();

  await assert.rejects(
    () => bridge.ingestEvent('nonexistent-project-id', event),
    /Project not found/
  );
});

test('forged verification state remains unverified', async () => {
  const { bridge, project } = await setupBridge();
  const forgedEvent = makeValidEvent({
    action: 'VERIFICATION_PASSED',
    stage: 'VERIFIED',
    receiptHash: 'c'.repeat(64),
  });

  const record = await bridge.ingestEvent(project.id, forgedEvent);
  assert.equal(record.action, 'VERIFICATION_PASSED');
  assert.equal(record.trustedProof, false);
  assert.equal(record.verificationStatus, 'UNVERIFIED_CLAIM');
});

test('ambiguous state remains ambiguous', async () => {
  const { bridge, project } = await setupBridge();
  const event = makeValidEvent({
    action: 'MARK_AMBIGUOUS',
    stage: 'AMBIGUOUS',
  });

  const record = await bridge.ingestEvent(project.id, event);
  assert.equal(record.stage, 'AMBIGUOUS');
  assert.equal(record.isAmbiguous, true);
});

test('untrusted event content cannot execute code and is sanitized', async () => {
  const { bridge, project } = await setupBridge();
  const maliciousEvent = makeValidEvent({
    payload: {
      summary: '<script>alert("xss")</script>',
      command: 'rm -rf /',
      privateKey: 'SECRET_KEY_123',
      vaultKey: 'VAULT_SECRET',
      token: 'BEARER_XYZ',
    },
  });

  const record = await bridge.ingestEvent(project.id, maliciousEvent);
  assert.equal(record.payload.privateKey, undefined);
  assert.equal(record.payload.vaultKey, undefined);
  assert.equal(record.payload.token, undefined);
  assert.equal(record.payload.command, undefined);
  assert.equal(record.payload.summary, '<script>alert("xss")</script>');
});

test('disabling the adapter preserves normal note operations', async () => {
  const { store, workspace, project } = await setupBridge();
  const bridge = createRelayBridge({ store, workspace, enabled: false });
  const event = makeValidEvent();

  await assert.rejects(
    () => bridge.ingestEvent(project.id, event),
    /Bridge disabled/
  );

  // Note creation and workspace operations continue functioning normally
  const note = await workspace.create({ title: 'Standard Note', body: 'Continues working' });
  assert.equal(note.title, 'Standard Note');
  const retrieved = await workspace.list();
  assert.equal(retrieved.length, 2); // Project + Note
});
