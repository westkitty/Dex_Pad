import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVault,
  unlockVault,
  recoverVault,
  deriveKeyHierarchy,
  encryptRecord,
  decryptRecord,
  createEncryptedStore,
  VaultLockedError,
  InvalidCredentialsError,
  TamperedCiphertextError,
} from '../src/core/crypto/vault.js';
import { createMemoryStore } from '../src/storage/memory.js';

const TEST_PASSPHRASE = 'correct-horse-battery-staple-synthetic-test';
const WRONG_PASSPHRASE = 'incorrect-password-attempt';
const KDF_TEST_ROUNDS = 10_000; // fast for unit tests; production profile uses 100k+

test('1. generates a unique vault identity and versioned format', async () => {
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });
  assert.match(vault.manifest.vaultId, /^vlt-[0-9a-f-]{36}$/);
  assert.equal(vault.manifest.schemaVersion, 'dex-vault.v1');
  assert.equal(vault.manifest.kdfParams.algorithm, 'PBKDF2');
  assert.equal(vault.manifest.kdfParams.hash, 'SHA-256');
  assert.equal(vault.manifest.kdfParams.iterations, KDF_TEST_ROUNDS);
  assert.equal(vault.manifest.kdfParams.salt.length, 32); // 16 bytes hex
  assert.ok(vault.recoveryCode, 'Recovery code must be issued on vault creation');
  assert.match(vault.recoveryCode, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});

test('2. establishes separated key hierarchy (MK, VK, AK, RK, PK, IK)', async () => {
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);

  const hierarchy = await deriveKeyHierarchy({
    passphrase: TEST_PASSPHRASE,
    salt,
    iterations: KDF_TEST_ROUNDS,
  });

  // Ensure all 5 derived keys exist and are distinct
  assert.ok(hierarchy.vaultKey);
  assert.ok(hierarchy.authKey);
  assert.ok(hierarchy.recoveryKey);
  assert.ok(hierarchy.pairingKey);
  assert.ok(hierarchy.integrationKey);

  // Export raw bytes to verify domain separation ensures distinct keys
  const [vk, ak, rk, pk, ik] = await Promise.all([
    globalThis.crypto.subtle.exportKey('raw', hierarchy.vaultKey),
    globalThis.crypto.subtle.exportKey('raw', hierarchy.authKey),
    globalThis.crypto.subtle.exportKey('raw', hierarchy.recoveryKey),
    globalThis.crypto.subtle.exportKey('raw', hierarchy.pairingKey),
    globalThis.crypto.subtle.exportKey('raw', hierarchy.integrationKey),
  ]);

  const toHex = b => Buffer.from(b).toString('hex');
  const hexes = new Set([toHex(vk), toHex(ak), toHex(rk), toHex(pk), toHex(ik)]);
  assert.equal(hexes.size, 5, 'All 5 derived keys in the hierarchy must be cryptographically distinct');
});

test('3. encrypts and authenticates note payloads with AEAD', async () => {
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });
  const rawNote = {
    title: 'Secret architectural decision',
    body: 'We choose end-to-end authenticated encryption using AES-256-GCM.',
    tags: ['crypto', 'private'],
  };

  const envelope = await encryptRecord(vault.session, 'note:abc-123', rawNote);
  assert.equal(envelope.schemaVersion, 'dex-record.v1');
  assert.equal(envelope.recordId, 'note:abc-123');
  assert.equal(envelope.vaultId, vault.manifest.vaultId);
  assert.equal(envelope.epoch, 1);
  assert.equal(envelope.iv.length, 24); // 12 bytes hex
  assert.ok(envelope.ciphertext);
  // Ensure plaintext does not appear anywhere in serialized envelope
  const jsonEnvelope = JSON.stringify(envelope);
  assert.ok(!jsonEnvelope.includes('Secret architectural decision'));
  assert.ok(!jsonEnvelope.includes('end-to-end authenticated encryption'));

  // Decrypt and verify
  const decrypted = await decryptRecord(vault.session, envelope);
  assert.deepEqual(decrypted, rawNote);
});

test('4. persists ciphertext only when using encrypted store', async () => {
  const rawStore = createMemoryStore();
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });
  const encStore = createEncryptedStore({ store: rawStore, vaultSession: vault.session, vaultManifest: vault.manifest });

  const note = {
    id: 'note-001',
    revision: 1,
    title: 'Private synthetic research',
    body: 'Sensitive notes that must never reach disk unencrypted',
    tags: ['research'],
  };

  await encStore.commit(note, { id: 'evt-1', itemId: 'note-001', revision: 1, action: 'created' });

  // Inspect the raw backing store at rest
  const storedAtRest = await rawStore.getItem('note-001');
  assert.ok(storedAtRest);
  assert.equal(storedAtRest.schemaVersion, 'dex-record.v1');
  assert.ok(!storedAtRest.title); // Title is encrypted inside payload
  assert.ok(!storedAtRest.body);  // Body is encrypted inside payload
  assert.ok(storedAtRest.ciphertext);

  const rawDump = JSON.stringify(await rawStore.listItems());
  assert.ok(!rawDump.includes('Private synthetic research'));
  assert.ok(!rawDump.includes('Sensitive notes that must never reach disk unencrypted'));

  // Decrypts transparently when reading through the active session
  const retrieved = await encStore.getItem('note-001');
  assert.equal(retrieved.title, 'Private synthetic research');
  assert.equal(retrieved.body, 'Sensitive notes that must never reach disk unencrypted');
});

test('5. prevents nonce reuse across sequential encryptions', async () => {
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });
  const payload = { body: 'Constant message content' };

  const nonces = new Set();
  for (let i = 0; i < 50; i++) {
    const record = await encryptRecord(vault.session, `note:${i}`, payload);
    assert.ok(!nonces.has(record.iv), `Nonce reuse detected on iteration ${i}! Nonce: ${record.iv}`);
    nonces.add(record.iv);
  }
  assert.equal(nonces.size, 50, 'All 50 generated nonces must be strictly unique');
});

test('6. verifies lock and unlock behavior', async () => {
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });
  const note = { title: 'Lock test', body: 'This should be inaccessible when locked' };
  const envelope = await encryptRecord(vault.session, 'note:lock-1', note);

  // Lock the vault
  vault.session.lock();
  assert.equal(vault.session.isUnlocked(), false);

  // Attempt to encrypt or decrypt while locked
  await assert.rejects(
    () => encryptRecord(vault.session, 'note:lock-2', note),
    VaultLockedError
  );
  await assert.rejects(
    () => decryptRecord(vault.session, envelope),
    VaultLockedError
  );

  // Unlock with valid passphrase
  const unlockedSession = await unlockVault({ manifest: vault.manifest, passphrase: TEST_PASSPHRASE });
  assert.equal(unlockedSession.isUnlocked(), true);

  const decrypted = await decryptRecord(unlockedSession, envelope);
  assert.equal(decrypted.body, 'This should be inaccessible when locked');
});

test('7. rejects incorrect credentials with InvalidCredentialsError', async () => {
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });

  await assert.rejects(
    () => unlockVault({ manifest: vault.manifest, passphrase: WRONG_PASSPHRASE }),
    InvalidCredentialsError
  );
});

test('8. rejects tampered ciphertext (bit-flips and modified auth data)', async () => {
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });
  const envelope = await encryptRecord(vault.session, 'note:tamper-1', { body: 'Authentic content' });

  // 1. Bit flip in ciphertext (flip first character to guarantee altered byte without base64 padding effects)
  const tamperedCiphertext = {
    ...envelope,
    ciphertext: (envelope.ciphertext[0] === 'A' ? 'B' : 'A') + envelope.ciphertext.slice(1),
  };
  await assert.rejects(
    () => decryptRecord(vault.session, tamperedCiphertext),
    TamperedCiphertextError
  );

  // 2. Tampered recordId in auth data
  const tamperedAuthData = {
    ...envelope,
    recordId: 'note:stolen-target-id',
  };
  await assert.rejects(
    () => decryptRecord(vault.session, tamperedAuthData),
    TamperedCiphertextError
  );

  // 3. Tampered epoch
  const tamperedEpoch = {
    ...envelope,
    epoch: 99,
  };
  await assert.rejects(
    () => decryptRecord(vault.session, tamperedEpoch),
    TamperedCiphertextError
  );
});

test('9. recovers vault from approved recovery code', async () => {
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });
  const envelope = await encryptRecord(vault.session, 'note:rec-1', { body: 'Recoverable data' });

  // Simulate complete loss of passphrase by unlocking via recoveryCode
  const recoveredSession = await recoverVault({
    manifest: vault.manifest,
    recoveryCode: vault.recoveryCode,
    iterations: KDF_TEST_ROUNDS,
  });
  assert.equal(recoveredSession.isUnlocked(), true);

  const decrypted = await decryptRecord(recoveredSession, envelope);
  assert.equal(decrypted.body, 'Recoverable data');
});

test('10. demonstrates unrecoverability when recovery code and passphrase are lost', async () => {
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });
  const wrongRecoveryCode = 'XXXX-YYYY-ZZZZ-0000';

  await assert.rejects(
    () => recoverVault({ manifest: vault.manifest, recoveryCode: wrongRecoveryCode, iterations: KDF_TEST_ROUNDS }),
    InvalidCredentialsError
  );
});

test('11. verifies relay cannot decrypt stored note content', async () => {
  const rawStore = createMemoryStore();
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });
  const encStore = createEncryptedStore({ store: rawStore, vaultSession: vault.session, vaultManifest: vault.manifest });

  await encStore.commit({ id: 'note:relay-test', revision: 1, title: 'Top Secret Plan', body: 'Attack vector analysis' }, { id: 'evt-1', itemId: 'note:relay-test', revision: 1 });

  // Relay inspects stored records
  const relayObserved = await rawStore.getItem('note:relay-test');

  // Relay has its own keys or attempts to decrypt without the client VaultKey
  const rogueSession = await createVault({ passphrase: 'rogue-relay-passphrase', iterations: KDF_TEST_ROUNDS });
  await assert.rejects(
    () => decryptRecord(rogueSession.session, relayObserved),
    TamperedCiphertextError
  );
});

test('12. versions encrypted format for future migrations', async () => {
  const vault = await createVault({ passphrase: TEST_PASSPHRASE, iterations: KDF_TEST_ROUNDS });
  const envelope = await encryptRecord(vault.session, 'note:v-test', { body: 'version test' });

  assert.equal(envelope.schemaVersion, 'dex-record.v1');
  assert.equal(vault.manifest.schemaVersion, 'dex-vault.v1');

  // Unsupported future schema rejection
  const futureEnvelope = { ...envelope, schemaVersion: 'dex-record.v99' };
  await assert.rejects(
    () => decryptRecord(vault.session, futureEnvelope),
    /Unsupported record schema/
  );
});
