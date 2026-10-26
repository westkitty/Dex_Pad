import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProjectKit,
  verifyAndRestoreProjectKit,
  createActionableAlert,
  KitIntegrityError,
  AlertAuthError,
} from '../src/core/kits-alerts.js';

test('1. createProjectKit packs selected records and attachments with verifiable SHA-256 manifest (F24)', () => {
  const records = [
    { id: 'note:alpha', title: 'Alpha Note', body: 'Encrypted ciphertext blob alpha', updatedAt: '2026-10-25T12:00:00Z' },
    { id: 'decision:beta', title: 'Beta Decision', status: 'decided', updatedAt: '2026-10-25T12:30:00Z' },
  ];
  const attachments = [
    { id: 'att:diagram', filename: 'architecture.png', sizeBytes: 1024, data: 'base64-data-bytes' },
  ];

  const kit = createProjectKit({
    projectId: 'proj:quantum',
    records,
    attachments,
    clientAuthorizer: { clientId: 'device-m1-authorized', role: 'owner' },
  });

  assert.equal(kit.schemaVersion, 'dex-project-kit.v1');
  assert.equal(kit.projectId, 'proj:quantum');
  assert.equal(kit.manifest.schemaVersion, 'dex-project-kit-manifest.v1');
  assert.equal(kit.manifest.recordCount, 2);
  assert.equal(kit.manifest.attachmentCount, 1);
  assert.equal(kit.manifest.items.length, 3);
  assert.ok(kit.manifest.items.every((item) => typeof item.sha256 === 'string' && item.sha256.length === 64));
});

test('2. verifyAndRestoreProjectKit restores offline and rejects tampered kit (F24)', () => {
  const records = [
    { id: 'note:secure', title: 'Local Spec', body: 'Zero cloud dependency spec.' },
  ];
  const attachments = [
    { id: 'att:spec', filename: 'spec.txt', sizeBytes: 30, data: 'Zero cloud dependency spec bytes' },
  ];

  const kit = createProjectKit({
    projectId: 'proj:secure',
    records,
    attachments,
    clientAuthorizer: { clientId: 'device-test', role: 'owner' },
  });

  // Target mock store
  const targetStore = {
    records: new Map(),
    attachments: new Map(),
    putRecord(rec) { this.records.set(rec.id, rec); },
    putAttachment(att) { this.attachments.set(att.id, att); },
  };

  const receipt = verifyAndRestoreProjectKit({
    kit,
    targetStore,
  });

  assert.equal(receipt.schemaVersion, 'dex-kit-restore-receipt.v1');
  assert.equal(receipt.verified, true);
  assert.equal(receipt.restoredRecordCount, 1);
  assert.equal(receipt.restoredAttachmentCount, 1);
  assert.ok(targetStore.records.has('note:secure'));
  assert.ok(targetStore.attachments.has('att:spec'));

  // Tampered kit test: modify record body without manifest checksum update
  const tamperedKit = JSON.parse(JSON.stringify(kit));
  tamperedKit.records[0].body = 'Tampered content by adversary';

  assert.throws(() => {
    verifyAndRestoreProjectKit({
      kit: tamperedKit,
      targetStore,
    });
  }, { name: 'KitIntegrityError', message: /Checksum verification failed/ });
});

test('3. createActionableAlert produces minimal authenticated alert with zero content leak (F25)', () => {
  const event = {
    type: 'commitment-overdue',
    commitmentId: 'commit:101',
    title: 'Audit Vault Zero Plaintext',
    dueDate: '2026-10-24T00:00:00Z',
    confidentialNotes: 'Do not leak this private key or password in notification payload!',
  };

  const alert = createActionableAlert({
    condition: 'commitment-overdue',
    event,
    recipientAuthorizer: { recipientId: 'user:local', authenticated: true },
    rateLimiterState: new Map(),
  });

  assert.equal(alert.schemaVersion, 'dex-actionable-alert.v1');
  assert.equal(alert.suppressed, false);
  assert.equal(alert.type, 'commitment-overdue');
  assert.equal(alert.actionableTarget, 'commit:101');
  // Content leak guard: confidential notes MUST NOT be in the notification payload
  assert.equal(alert.contentLeaked, false);
  assert.ok(!JSON.stringify(alert).includes('Do not leak this private key'));
});

test('4. createActionableAlert throttles persistent duplicate spam (F25)', () => {
  const rateLimiterState = new Map();
  const event = {
    type: 'stale-source',
    sourceId: 'src:202',
    title: 'Upstream RFC Drift',
  };

  const authorizer = { recipientId: 'user:local', authenticated: true };

  // First alert triggers normally
  const first = createActionableAlert({
    condition: 'stale-source',
    event,
    recipientAuthorizer: authorizer,
    rateLimiterState,
  });
  assert.equal(first.suppressed, false);

  // Immediate duplicate is suppressed as spam
  const second = createActionableAlert({
    condition: 'stale-source',
    event,
    recipientAuthorizer: authorizer,
    rateLimiterState,
  });
  assert.equal(second.suppressed, true);
  assert.equal(second.reason, 'rate_limited_duplicate');

  // Unauthenticated recipient throws AlertAuthError
  assert.throws(() => {
    createActionableAlert({
      condition: 'stale-source',
      event,
      recipientAuthorizer: { recipientId: 'user:local', authenticated: false },
      rateLimiterState,
    });
  }, { name: 'AlertAuthError', message: /Authenticated recipient required/ });
});
