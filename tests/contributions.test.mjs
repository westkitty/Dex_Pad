import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/core/workspace.js';
import { createMemoryStore } from '../src/storage/memory.js';
import { createWriteOnlyGateway } from '../src/core/contributions.js';

test('gateway has a submit operation but no read or list capabilities', async () => {
  const workspace = createWorkspace(createMemoryStore());
  const gateway = createWriteOnlyGateway(workspace);
  assert.deepEqual(Object.keys(gateway), ['acceptContribution']);
  assert.equal(gateway.getItem, undefined);
  assert.equal(gateway.search, undefined);
  assert.equal(gateway.exportData, undefined);
});

test('submitted synthetic contribution becomes an inbox item and returns opaque receipt', async () => {
  const workspace = createWorkspace(createMemoryStore());
  const gateway = createWriteOnlyGateway(workspace);
  const receipt = await gateway.acceptContribution({ requestId: 'example_001', title: 'Draft', body: 'Proposal content' });
  assert.deepEqual(Object.keys(receipt).sort(), ['receiptId', 'state'].sort());
  assert.equal(receipt.state, 'saved-locally');
  const found = await workspace.list({ kind: 'contribution' });
  assert.equal(found.length, 1);
  assert.equal(found[0].body, 'Proposal content');
  assert.equal(found[0].provenance.origin, 'external-simulation');
});

test('repeat submissions are idempotent and conflicting reuses fail without mutation', async () => {
  const workspace = createWorkspace(createMemoryStore());
  const gateway = createWriteOnlyGateway(workspace);
  const data = { requestId: 'repeat_123', title: 'A', body: 'Text' };
  const first = await gateway.acceptContribution(data);
  const second = await gateway.acceptContribution(data);
  assert.deepEqual(second, first);
  assert.equal((await workspace.list()).length, 1);
  await assert.rejects(() => gateway.acceptContribution({ ...data, body: 'Different' }), /idempotency conflict/i);
  assert.equal((await workspace.history('contribution:repeat_123')).length, 1);
});

test('malformed receipt identifiers and oversized submissions are rejected', async () => {
  const gateway = createWriteOnlyGateway(createWorkspace(createMemoryStore()));
  await assert.rejects(() => gateway.acceptContribution({ requestId: '../../secret', body: 'unsafe' }), /request id/i);
  await assert.rejects(() => gateway.acceptContribution({ requestId: 'valid_id1', body: 'x'.repeat(110_000) }), /body/i);
});
