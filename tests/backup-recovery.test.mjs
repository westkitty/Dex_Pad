import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVault,
  unlockVault,
  createEncryptedStore,
} from '../src/core/crypto/vault.js';
import {
  createEncryptedBackup,
  verifyBackupIntegrity,
  restoreEncryptedBackup,
  recoverVaultWithCode,
  exportUnencryptedWithConsent,
  CorruptBackupError,
  KeyEpochMismatchError,
  ConsentRequiredError,
} from '../src/core/crypto/backup.js';
import { createMemoryStore } from '../src/storage/memory.js';

const TEST_ROUNDS = 10_000;

test('1. creates a deterministic encrypted backup with valid dex-backup.v1 schema and checksum', async () => {
  const rawStore = createMemoryStore();
  const vault = await createVault({ passphrase: 'correct horse battery staple', iterations: TEST_ROUNDS });
  const encStore = createEncryptedStore({
    store: rawStore,
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
  });

  // Store 3 records via encrypted store
  await encStore.commit(
    { id: 'rec-1', revision: 1, title: 'Mission Briefing', body: 'Confidential DEX plan' },
    { id: 'evt-1', itemId: 'rec-1', action: 'created' }
  );
  await encStore.commit(
    { id: 'rec-2', revision: 1, title: 'Relay Architecture', body: 'Candidate C details' },
    { id: 'evt-2', itemId: 'rec-2', action: 'created' }
  );
  await encStore.commit(
    { id: 'rec-3', revision: 1, title: 'Recovery Keys', body: 'Store in safe place' },
    { id: 'evt-3', itemId: 'rec-3', action: 'created' }
  );

  const backup = await createEncryptedBackup({
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
    store: rawStore,
  });

  assert.equal(backup.schemaVersion, 'dex-backup.v1');
  assert.equal(backup.vaultId, vault.manifest.vaultId);
  assert.equal(backup.keyEpoch, 1);
  assert.equal(backup.recordsCount, 3);
  assert.equal(backup.records.length, 3);
  assert.match(backup.checksum, /^[0-9a-f]{64}$/);
  assert.ok(backup.createdAt);

  // Confirm records in backup are ciphertext envelopes, not plaintext
  for (const r of backup.records) {
    assert.ok(r.ciphertext);
    assert.ok(r.iv);
    assert.equal(r.title, undefined);
    assert.equal(r.body, undefined);
  }
});

test('2. verifies backup integrity successfully on untampered archive', async () => {
  const rawStore = createMemoryStore();
  const vault = await createVault({ passphrase: 'test-passphrase-2', iterations: TEST_ROUNDS });
  const encStore = createEncryptedStore({
    store: rawStore,
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
  });

  await encStore.commit(
    { id: 'rec-alpha', revision: 1, title: 'Alpha Note', body: 'Secret alpha' },
    { id: 'e-1', itemId: 'rec-alpha', action: 'created' }
  );
  const backup = await createEncryptedBackup({
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
    store: rawStore,
  });

  const verification = await verifyBackupIntegrity(backup);
  assert.equal(verification.valid, true);
  assert.equal(verification.recordsCount, 1);
  assert.equal(verification.vaultId, vault.manifest.vaultId);
});

test('3. rejects tampered backup with CorruptBackupError (modified ciphertext)', async () => {
  const rawStore = createMemoryStore();
  const vault = await createVault({ passphrase: 'test-passphrase-3', iterations: TEST_ROUNDS });
  const encStore = createEncryptedStore({
    store: rawStore,
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
  });

  await encStore.commit(
    { id: 'rec-1', revision: 1, title: 'Note', body: 'Body' },
    { id: 'e-1', itemId: 'rec-1', action: 'created' }
  );
  const backup = await createEncryptedBackup({
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
    store: rawStore,
  });

  // Tamper with ciphertext of first record
  backup.records[0].ciphertext = 'badf00d' + backup.records[0].ciphertext.slice(7);

  await assert.rejects(
    async () => verifyBackupIntegrity(backup),
    CorruptBackupError,
    'Should reject tampered ciphertext'
  );
});

test('4. rejects tampered backup when record count or metadata is altered', async () => {
  const rawStore = createMemoryStore();
  const vault = await createVault({ passphrase: 'test-passphrase-4', iterations: TEST_ROUNDS });
  const encStore = createEncryptedStore({
    store: rawStore,
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
  });

  await encStore.commit(
    { id: 'rec-1', revision: 1, title: 'Note 1', body: 'Body 1' },
    { id: 'e-1', itemId: 'rec-1', action: 'created' }
  );
  await encStore.commit(
    { id: 'rec-2', revision: 1, title: 'Note 2', body: 'Body 2' },
    { id: 'e-2', itemId: 'rec-2', action: 'created' }
  );
  const backup = await createEncryptedBackup({
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
    store: rawStore,
  });

  // Alter metadata recordsCount
  const tampered = JSON.parse(JSON.stringify(backup));
  tampered.recordsCount = 5;

  await assert.rejects(
    async () => verifyBackupIntegrity(tampered),
    CorruptBackupError,
    'Should reject metadata alteration'
  );
});

test('5. independent offline restore on clean store restores all records', async () => {
  // Source client
  const sourceRawStore = createMemoryStore();
  const vault = await createVault({ passphrase: 'restore-test-passphrase', iterations: TEST_ROUNDS });
  const sourceEncStore = createEncryptedStore({
    store: sourceRawStore,
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
  });

  await sourceEncStore.commit(
    { id: 'note-a', revision: 1, title: 'Project Plan', body: 'Local-first architecture' },
    { id: 'e-a', itemId: 'note-a', action: 'created' }
  );
  await sourceEncStore.commit(
    { id: 'note-b', revision: 1, title: 'Decisions', body: 'Zero third-party packages' },
    { id: 'e-b', itemId: 'note-b', action: 'created' }
  );

  const backup = await createEncryptedBackup({
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
    store: sourceRawStore,
  });

  // Fresh, clean destination store on an independent client that possesses the vault credentials
  const targetRawStore = createMemoryStore();
  const targetSession = await unlockVault({
    manifest: vault.manifest,
    passphrase: 'restore-test-passphrase',
  });

  const restoreSummary = await restoreEncryptedBackup({
    backupArchive: backup,
    vaultSession: targetSession,
    vaultManifest: vault.manifest,
    store: targetRawStore,
  });

  assert.equal(restoreSummary.restoredCount, 2);
  assert.equal(restoreSummary.vaultId, vault.manifest.vaultId);

  // Decrypt records in target store
  const targetEncStore = createEncryptedStore({
    store: targetRawStore,
    vaultSession: targetSession,
    vaultManifest: vault.manifest,
  });
  const decryptedA = await targetEncStore.getItem('note-a');
  const decryptedB = await targetEncStore.getItem('note-b');

  assert.equal(decryptedA.title, 'Project Plan');
  assert.equal(decryptedA.body, 'Local-first architecture');
  assert.equal(decryptedB.title, 'Decisions');
  assert.equal(decryptedB.body, 'Zero third-party packages');
});

test('6. restore rejects key epoch mismatch with KeyEpochMismatchError', async () => {
  const sourceRawStore = createMemoryStore();
  const vault = await createVault({ passphrase: 'epoch-test-passphrase', iterations: TEST_ROUNDS });
  const sourceEncStore = createEncryptedStore({
    store: sourceRawStore,
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
  });

  await sourceEncStore.commit(
    { id: 'note-epoch', revision: 1, title: 'Epoch Note', body: 'Content' },
    { id: 'e-1', itemId: 'note-epoch', action: 'created' }
  );
  const backup = await createEncryptedBackup({
    vaultSession: vault.session,
    vaultManifest: vault.manifest,
    store: sourceRawStore,
  });

  // Target vault with mismatched epoch
  const mismatchedManifest = JSON.parse(JSON.stringify(vault.manifest));
  mismatchedManifest.keyEpoch = 99;

  await assert.rejects(
    async () => restoreEncryptedBackup({
      backupArchive: backup,
      vaultSession: vault.session,
      vaultManifest: mismatchedManifest,
      store: createMemoryStore(),
    }),
    KeyEpochMismatchError,
    'Should reject key epoch mismatch'
  );
});

test('7. lost-device recovery restores vault access via recovery code and decrypts backup', async () => {
  const rawStore = createMemoryStore();
  const vault = await createVault({ passphrase: 'forgotten-passphrase', iterations: TEST_ROUNDS });
  const recoveryCode = vault.recoveryCode;
  const originalManifest = vault.manifest;

  const encStore = createEncryptedStore({
    store: rawStore,
    vaultSession: vault.session,
    vaultManifest: originalManifest,
  });
  await encStore.commit(
    { id: 'vault-secret', revision: 1, title: 'Top Secret', body: 'Recoverable with emergency code' },
    { id: 'e-sec', itemId: 'vault-secret', action: 'created' }
  );

  const backup = await createEncryptedBackup({
    vaultSession: vault.session,
    vaultManifest: originalManifest,
    store: rawStore,
  });

  // Lost device scenario: user forgot passphrase, only has recoveryCode and manifest
  const recovered = await recoverVaultWithCode({
    manifest: originalManifest,
    recoveryCode,
    newPassphrase: 'brand-new-secure-passphrase-2026',
    iterations: TEST_ROUNDS,
  });

  assert.ok(recovered.newEnvelope);
  assert.equal(recovered.vaultId, originalManifest.vaultId);

  // Unlock with new passphrase
  const newSession = await unlockVault({
    manifest: recovered.newEnvelope,
    passphrase: 'brand-new-secure-passphrase-2026',
  });

  // Target clean store
  const freshStore = createMemoryStore();
  await restoreEncryptedBackup({
    backupArchive: backup,
    vaultSession: newSession,
    vaultManifest: recovered.newEnvelope,
    store: freshStore,
  });

  const freshEncStore = createEncryptedStore({
    store: freshStore,
    vaultSession: newSession,
    vaultManifest: recovered.newEnvelope,
  });
  const decrypted = await freshEncStore.getItem('vault-secret');
  assert.equal(decrypted.title, 'Top Secret');
  assert.equal(decrypted.body, 'Recoverable with emergency code');
});

test('8. unrecoverable without credentials (invalid recovery code fails)', async () => {
  const vault = await createVault({ passphrase: 'forgotten-passphrase-2', iterations: TEST_ROUNDS });
  await assert.rejects(
    async () => recoverVaultWithCode({
      manifest: vault.manifest,
      recoveryCode: 'DEX-RECOV-0000-0000-0000-0000',
      newPassphrase: 'new-passphrase',
      iterations: TEST_ROUNDS,
    }),
    /Invalid recovery code or tampered recovery envelope/
  );
});

test('9. unencrypted export strictly requires explicit user consent', async () => {
  const mockWorkspace = {
    async exportData() {
      return { notes: [{ id: '1', title: 'Secret' }] };
    },
  };

  await assert.rejects(
    async () => exportUnencryptedWithConsent({ workspace: mockWorkspace, consentGiven: false }),
    ConsentRequiredError
  );

  const exported = await exportUnencryptedWithConsent({
    workspace: mockWorkspace,
    consentGiven: true,
    reason: 'Offline unencrypted migration preview',
  });

  assert.equal(exported.warning, 'UNENCRYPTED_DEVELOPMENT_EXPORT_SYNTHETIC_DATA_ONLY');
  assert.ok(exported.exportedAt);
  assert.equal(exported.notes.length, 1);
});
