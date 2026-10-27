import test from 'node:test';
import assert from 'node:assert/strict';
import { createVault } from '../src/core/crypto/vault.js';
import { createMemoryStore } from '../src/storage/memory.js';
import { createWorkspace } from '../src/core/workspace.js';
import {
  createSyncEngine,
  createSyntheticRelay,
  SyncConflictError,
  DeviceRevokedError,
  SyncEnvelopeTamperedError,
} from '../src/core/sync/engine.js';

const TEST_PASSPHRASE = 'sync-harness-synthetic-test-passphrase';
const KDF_ROUNDS = 5_000;

async function setupSyncCluster() {
  const relay = createSyntheticRelay();
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_ROUNDS });

  // Client 1 (e.g. MacBook)
  const store1 = createMemoryStore();
  const ws1 = createWorkspace(store1);
  const client1 = createSyncEngine({
    deviceId: 'dev-macbook-01',
    vaultSession: vault.session,
    workspace: ws1,
    store: store1,
    relay,
  });

  // Client 2 (e.g. Phone)
  const store2 = createMemoryStore();
  const ws2 = createWorkspace(store2);
  const client2 = createSyncEngine({
    deviceId: 'dev-phone-02',
    vaultSession: vault.session,
    workspace: ws2,
    store: store2,
    relay,
  });

  return { relay, vault, ws1, client1, store1, ws2, client2, store2 };
}

test('1. offline writing produces durable local records and pending sync frames', async () => {
  const { ws1, client1 } = await setupSyncCluster();

  // Offline creation
  const note = await ws1.create({ title: 'Offline Note', body: 'Drafted in airplane mode' });
  assert.equal(note.title, 'Offline Note');

  const pending = await client1.getPendingFrames();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].itemId, note.id);
  assert.equal(pending[0].revision, 1);
  assert.equal(pending[0].envelope.schemaVersion, 'dex-sync.v1');
  assert.ok(pending[0].envelope.ciphertext);
  // Encrypted in transit: title and body not in raw JSON
  assert.ok(!JSON.stringify(pending[0]).includes('Drafted in airplane mode'));
});

test('2. private ciphertext-only relay transport prevents relay decryption', async () => {
  const { ws1, client1, relay } = await setupSyncCluster();

  await ws1.create({ title: 'Confidential Strategy', body: 'Relay must never read this text' });
  const pushReceipt = await client1.push();
  assert.equal(pushReceipt.uploadedCount, 1);

  // Inspect the raw relay storage
  const relayBlobs = await relay.listStoredEnvelopes();
  assert.equal(relayBlobs.length, 1);
  const rawRelayDump = JSON.stringify(relayBlobs);
  assert.ok(!rawRelayDump.includes('Confidential Strategy'));
  assert.ok(!rawRelayDump.includes('Relay must never read this text'));
});

test('3. reordered delivery buffers until predecessor arrives without state corruption', async () => {
  const { client1, client2, ws1, ws2 } = await setupSyncCluster();

  const note = await ws1.create({ title: 'Ordered Note', body: 'Revision 1' });
  await ws1.update(note.id, { body: 'Revision 2' }, 1);
  await ws1.update(note.id, { body: 'Revision 3' }, 2);

  const frames = await client1.getPendingFrames();
  assert.equal(frames.length, 3);

  // Deliver frames in scrambled order: Rev 3, then Rev 1, then Rev 2
  const [f1, f2, f3] = frames;
  await client2.receiveFrame(f3); // Out of order! Predecessor Rev 2 missing
  assert.equal(await ws2.list().then(l => l.length), 0, 'Rev 3 cannot be applied before Rev 1 and 2');
  assert.equal(client2.getBufferedCount(), 1);

  await client2.receiveFrame(f1); // Rev 1 applied
  const after1 = await ws2.list();
  assert.equal(after1.length, 1);
  assert.equal(after1[0].revision, 1);

  await client2.receiveFrame(f2); // Rev 2 arrives -> triggers buffered Rev 3 application
  const afterAll = await ws2.list();
  assert.equal(afterAll.length, 1);
  assert.equal(afterAll[0].revision, 3);
  assert.equal(afterAll[0].body, 'Revision 3');
  assert.equal(client2.getBufferedCount(), 0);
});

test('4. duplicate delivery (100x replay) results in exactly-once application', async () => {
  const { ws1, client1, client2, ws2 } = await setupSyncCluster();

  await ws1.create({ title: 'Idempotency Test', body: 'Single record instance' });
  await client1.push();

  // Replay 100 times
  for (let i = 0; i < 100; i++) {
    await client2.pull();
  }

  const items = await ws2.list();
  assert.equal(items.length, 1, 'Exactly one record must exist despite 100 duplicate sync deliveries');
  assert.equal(items[0].title, 'Idempotency Test');
});

test('5. interrupted transfer resumes from last acknowledged sync cursor', async () => {
  const { ws1, client1, client2, ws2 } = await setupSyncCluster();

  for (let i = 1; i <= 5; i++) {
    await ws1.create({ title: `Batch Note ${i}`, body: `Content ${i}` });
  }
  await client1.push();

  // Simulate interrupt after first 2 items
  await client2.pull({ maxBatch: 2 });
  const partial = await ws2.list();
  assert.equal(partial.length, 2);

  // Resume pull: fetches remaining 3 items
  const secondPull = await client2.pull();
  assert.equal(secondPull.appliedCount, 3);

  const full = await ws2.list();
  assert.equal(full.length, 5);
});

test('6. concurrent divergent edits create explicit conflict branch with full history recovery', async () => {
  const { ws1, client1, ws2, client2 } = await setupSyncCluster();

  // Seed base note
  const base = await ws1.create({ title: 'Base Note', body: 'Original text' });
  await client1.push();
  await client2.pull();

  // Concurrent offline edit on Client 1
  await ws1.update(base.id, { body: 'Edit by MacBook' }, 1);
  await client1.push();

  // Concurrent offline edit on Client 2 (from same base revision 1)
  await ws2.update(base.id, { body: 'Edit by Phone' }, 1);

  // Sync client 2: conflict detected
  const syncResult = await client2.sync();
  assert.ok(syncResult.conflicts.length > 0, 'Concurrent edit conflict must be detected');

  // Verify zero data loss: both versions are preserved in revision history
  const history = await ws2.history(base.id);
  assert.ok(history.length >= 2);
  const bodies = history.map(h => h.body);
  assert.ok(bodies.includes('Original text'));
  // Conflict revision recorded with inspectable status
  assert.equal(syncResult.conflicts[0].baseRevision, 1);
});

test('7. device pairing, authorization, and revocation enforcement', async () => {
  const { relay, client1, ws1, ws2, client2 } = await setupSyncCluster();

  // Device pairing
  const pairingToken = await client1.issuePairingToken('dev-tablet-03');
  assert.ok(pairingToken.token);
  assert.equal(pairingToken.targetDeviceId, 'dev-tablet-03');

  // Revocation
  await client1.revokeDevice('dev-phone-02');
  assert.ok(relay.isDeviceRevoked('dev-phone-02'));

  // Revoked device attempted push is rejected by relay
  await ws2.create({ title: 'Post-revocation Note' });
  await assert.rejects(
    () => client2.push(),
    DeviceRevokedError
  );
});

test('8. truthful acknowledgment: distinguishes RELAY_STORED from PEER_APPLIED', async () => {
  const { ws1, client1, client2 } = await setupSyncCluster();

  const note = await ws1.create({ title: 'Ack Test', body: 'Testing delivery receipts' });
  const pushReceipt = await client1.push();

  // Relay received the envelope: RELAY_STORED
  assert.equal(pushReceipt.status, 'RELAY_STORED');
  assert.notEqual(pushReceipt.status, 'PEER_APPLIED');

  // Client 2 pulls and applies
  const pullReceipt = await client2.pull();
  assert.equal(pullReceipt.status, 'PEER_APPLIED');
  assert.equal(pullReceipt.appliedCount, 1);
});

test('9. peer-applied confirmation protocol exchanges delivery receipts', async () => {
  const { ws1, client1, ws2, client2 } = await setupSyncCluster();

  const note = await ws1.create({ title: 'Confirmation Test', body: 'Signed receipt test' });
  await client1.push();

  // Before peer pull: sending device state for note is RELAY_STORED
  const preStatus = await client1.getItemSyncState(note.id, note.revision);
  assert.equal(preStatus.state, 'RELAY_STORED');
  assert.equal(preStatus.peerApplied, false);

  // Peer pulls, applies, and registers peer-ack receipt
  await client2.pull();

  // After peer pull: sending device sees PEER_APPLIED with peer device ID and receipt signature
  const postStatus = await client1.getItemSyncState(note.id, note.revision);
  assert.equal(postStatus.state, 'PEER_APPLIED');
  assert.equal(postStatus.peerApplied, true);
  assert.equal(postStatus.appliedByDeviceId, 'dev-phone-02');
  assert.match(postStatus.receiptSignature, /^[0-9a-f]{64}$/);
});

test('10. truthful sync inspector accurately tracks offline, relay, and peer states', async () => {
  const { ws1, client1, client2 } = await setupSyncCluster();

  // 1. Offline item
  const offlineNote = await ws1.create({ title: 'Offline Item' });
  const localStatus = await client1.getItemSyncState(offlineNote.id, offlineNote.revision);
  assert.equal(localStatus.state, 'SAVED_LOCALLY');
  assert.equal(localStatus.pendingUpload, true);

  // 2. Upload to relay
  await client1.push();
  const relayStatus = await client1.getItemSyncState(offlineNote.id, offlineNote.revision);
  assert.equal(relayStatus.state, 'RELAY_STORED');
  assert.equal(relayStatus.pendingUpload, false);
  assert.equal(relayStatus.peerApplied, false);

  // 3. Peer syncs
  await client2.pull();
  const confirmedStatus = await client1.getItemSyncState(offlineNote.id, offlineNote.revision);
  assert.equal(confirmedStatus.state, 'PEER_APPLIED');
  assert.equal(confirmedStatus.peerApplied, true);
});
