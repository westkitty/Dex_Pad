import {
  deriveHkdfMasterKey,
  deriveSubKey,
  encryptGcm,
  decryptGcm,
  toHex,
  fromHex,
  toBase64,
  fromBase64,
  randomBytes,
  TamperedCiphertextError,
} from './primitives.js';

export { TamperedCiphertextError };

export class VaultError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VaultError';
  }
}

export class VaultLockedError extends VaultError {
  constructor(message = 'Vault is locked: key material unavailable') {
    super(message);
    this.name = 'VaultLockedError';
  }
}

export class InvalidCredentialsError extends VaultError {
  constructor(message = 'Invalid credentials or recovery code') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

const RECORD_SCHEMA_V1 = 'dex-record.v1';
const VAULT_SCHEMA_V1 = 'dex-vault.v1';

export async function deriveKeyHierarchy({ passphrase, salt, iterations = 100_000 }) {
  const masterKey = await deriveHkdfMasterKey({ passphrase, salt, iterations });

  const [vaultKey, authKey, recoveryKey, pairingKey, integrationKey] = await Promise.all([
    deriveSubKey(masterKey, { info: 'dex-pad/vault-key-v1' }),
    deriveSubKey(masterKey, { info: 'dex-pad/auth-key-v1' }),
    deriveSubKey(masterKey, { info: 'dex-pad/recovery-key-v1' }),
    deriveSubKey(masterKey, { info: 'dex-pad/pairing-key-v1' }),
    deriveSubKey(masterKey, { info: 'dex-pad/integration-key-v1' }),
  ]);

  return { vaultKey, authKey, recoveryKey, pairingKey, integrationKey };
}

function generateRecoveryCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 Crockford subset, avoiding 0/O 1/I
  const bytes = randomBytes(16);
  let raw = '';
  for (let i = 0; i < 16; i++) {
    raw += chars[bytes[i] % chars.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

export function createVaultSession({ vaultId, vaultKey }) {
  let activeKey = vaultKey;
  let unlocked = true;

  return {
    getVaultId() { return vaultId; },
    isUnlocked() { return unlocked && activeKey !== null; },
    getVaultKey() {
      if (!unlocked || !activeKey) throw new VaultLockedError();
      return activeKey;
    },
    lock() {
      unlocked = false;
      activeKey = null;
    },
  };
}

export async function createVault({ passphrase, iterations = 100_000 } = {}) {
  if (!passphrase || typeof passphrase !== 'string') {
    throw new VaultError('Passphrase is required to create a vault');
  }

  const vaultId = `vlt-${crypto.randomUUID()}`;
  const salt = randomBytes(16);

  // 1. Derive hierarchy from user passphrase
  const hierarchy = await deriveKeyHierarchy({ passphrase, salt, iterations });

  // 2. Generate a dedicated VaultKey (AES-GCM 256)
  const rawVaultKeyBytes = await globalThis.crypto.subtle.exportKey('raw', hierarchy.vaultKey);

  // 3. Wrap VaultKey with authKey
  const authIv = randomBytes(12);
  const wrappedByAuth = await encryptGcm({
    key: hierarchy.authKey,
    plaintext: rawVaultKeyBytes,
    iv: authIv,
    additionalData: `auth-wrap:${vaultId}`,
  });

  // 4. Generate recovery credentials
  const recoveryCode = generateRecoveryCode();
  const recoverySalt = randomBytes(16);
  const recoveryHierarchy = await deriveKeyHierarchy({
    passphrase: recoveryCode,
    salt: recoverySalt,
    iterations,
  });

  const recoveryIv = randomBytes(12);
  const wrappedByRecovery = await encryptGcm({
    key: recoveryHierarchy.recoveryKey,
    plaintext: rawVaultKeyBytes,
    iv: recoveryIv,
    additionalData: `rec-wrap:${vaultId}`,
  });

  // 5. Auth check block to verify correct passphrase
  const checkIv = randomBytes(12);
  const authCheck = await encryptGcm({
    key: hierarchy.authKey,
    plaintext: JSON.stringify({ valid: true, vaultId }),
    iv: checkIv,
    additionalData: `auth-check:${vaultId}`,
  });

  const manifest = {
    schemaVersion: VAULT_SCHEMA_V1,
    vaultId,
    createdAt: new Date().toISOString(),
    kdfParams: {
      algorithm: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: toHex(salt),
    },
    wrappedVaultKey: {
      iv: toHex(authIv),
      ciphertext: toBase64(wrappedByAuth),
    },
    recoveryEnvelope: {
      kdfParams: {
        algorithm: 'PBKDF2',
        hash: 'SHA-256',
        iterations,
        salt: toHex(recoverySalt),
      },
      iv: toHex(recoveryIv),
      ciphertext: toBase64(wrappedByRecovery),
    },
    authCheck: {
      iv: toHex(checkIv),
      ciphertext: toBase64(authCheck),
    },
  };

  const session = createVaultSession({
    vaultId,
    vaultKey: hierarchy.vaultKey,
  });

  return { manifest, recoveryCode, session };
}

export async function unlockVault({ manifest, passphrase }) {
  if (manifest.schemaVersion !== VAULT_SCHEMA_V1) {
    throw new VaultError(`Unsupported vault schema version: ${manifest.schemaVersion}`);
  }

  const salt = fromHex(manifest.kdfParams.salt);
  const iterations = manifest.kdfParams.iterations;
  const hierarchy = await deriveKeyHierarchy({ passphrase, salt, iterations });

  // Verify authCheck
  try {
    const checkDecrypted = await decryptGcm({
      key: hierarchy.authKey,
      ciphertext: manifest.authCheck.ciphertext,
      iv: manifest.authCheck.iv,
      additionalData: `auth-check:${manifest.vaultId}`,
    });
    const parsed = JSON.parse(new TextDecoder().decode(checkDecrypted));
    if (!parsed.valid || parsed.vaultId !== manifest.vaultId) {
      throw new InvalidCredentialsError();
    }
  } catch {
    throw new InvalidCredentialsError();
  }

  // Unwrap VaultKey
  try {
    const rawKeyBytes = await decryptGcm({
      key: hierarchy.authKey,
      ciphertext: manifest.wrappedVaultKey.ciphertext,
      iv: manifest.wrappedVaultKey.iv,
      additionalData: `auth-wrap:${manifest.vaultId}`,
    });

    const vaultKey = await globalThis.crypto.subtle.importKey(
      'raw',
      rawKeyBytes,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    return createVaultSession({ vaultId: manifest.vaultId, vaultKey });
  } catch {
    throw new InvalidCredentialsError();
  }
}

export async function recoverVault({ manifest, recoveryCode, iterations }) {
  if (manifest.schemaVersion !== VAULT_SCHEMA_V1) {
    throw new VaultError(`Unsupported vault schema version: ${manifest.schemaVersion}`);
  }

  const recoveryEnv = manifest.recoveryEnvelope;
  const salt = fromHex(recoveryEnv.kdfParams.salt);
  const kdfIterations = iterations ?? recoveryEnv.kdfParams.iterations;

  try {
    const recoveryHierarchy = await deriveKeyHierarchy({
      passphrase: recoveryCode,
      salt,
      iterations: kdfIterations,
    });

    const rawKeyBytes = await decryptGcm({
      key: recoveryHierarchy.recoveryKey,
      ciphertext: recoveryEnv.ciphertext,
      iv: recoveryEnv.iv,
      additionalData: `rec-wrap:${manifest.vaultId}`,
    });

    const vaultKey = await globalThis.crypto.subtle.importKey(
      'raw',
      rawKeyBytes,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    return createVaultSession({ vaultId: manifest.vaultId, vaultKey });
  } catch {
    throw new InvalidCredentialsError('Recovery code incorrect or corrupted');
  }
}

function canonicalAad({ vaultId, schemaVersion, recordId, epoch }) {
  return JSON.stringify({ vaultId, schemaVersion, recordId, epoch });
}

export async function encryptRecord(session, recordId, payload) {
  if (!session || !session.isUnlocked()) {
    throw new VaultLockedError('Cannot encrypt record: vault is locked');
  }
  if (!recordId || typeof recordId !== 'string') {
    throw new VaultError('recordId must be a valid string');
  }

  const vaultKey = session.getVaultKey();
  const vaultId = session.getVaultId();
  const epoch = 1;
  const iv = randomBytes(12);
  const aad = canonicalAad({ vaultId, schemaVersion: RECORD_SCHEMA_V1, recordId, epoch });

  const plainTextBytes = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBytes = await encryptGcm({
    key: vaultKey,
    plaintext: plainTextBytes,
    iv,
    additionalData: aad,
  });

  return {
    schemaVersion: RECORD_SCHEMA_V1,
    recordId,
    vaultId,
    epoch,
    iv: toHex(iv),
    ciphertext: toBase64(cipherBytes),
    authData: { vaultId, recordId, epoch },
    encryptedAt: new Date().toISOString(),
  };
}

export async function decryptRecord(session, envelope) {
  if (!session || !session.isUnlocked()) {
    throw new VaultLockedError('Cannot decrypt record: vault is locked');
  }
  if (!envelope || typeof envelope !== 'object') {
    throw new VaultError('Invalid record envelope');
  }
  if (envelope.schemaVersion !== RECORD_SCHEMA_V1) {
    throw new VaultError(`Unsupported record schema version: ${envelope.schemaVersion}`);
  }

  const vaultKey = session.getVaultKey();
  const aad = canonicalAad({
    vaultId: envelope.vaultId,
    schemaVersion: envelope.schemaVersion,
    recordId: envelope.recordId,
    epoch: envelope.epoch,
  });

  const plainBytes = await decryptGcm({
    key: vaultKey,
    ciphertext: envelope.ciphertext,
    iv: envelope.iv,
    additionalData: aad,
  });

  const json = new TextDecoder().decode(plainBytes);
  return JSON.parse(json);
}

export function createEncryptedStore({ store, vaultSession, vaultManifest }) {
  if (!store) throw new Error('store is required');
  if (!vaultSession) throw new Error('vaultSession is required');

  async function getItem(id) {
    const raw = await store.getItem(id);
    if (!raw) return null;
    if (raw.schemaVersion === RECORD_SCHEMA_V1) {
      const decrypted = await decryptRecord(vaultSession, raw);
      return {
        ...raw,
        ...decrypted,
        id: raw.recordId,
      };
    }
    return raw;
  }

  async function listItems() {
    const all = await store.listItems();
    return Promise.all(
      all.map(async item => {
        if (item.schemaVersion === RECORD_SCHEMA_V1) {
          const decrypted = await decryptRecord(vaultSession, item);
          return {
            ...item,
            ...decrypted,
            id: item.recordId,
          };
        }
        return item;
      })
    );
  }

  async function listRevisions(id) {
    const all = await store.listRevisions(id);
    return Promise.all(
      all.map(async rev => {
        if (rev.schemaVersion === RECORD_SCHEMA_V1) {
          const decrypted = await decryptRecord(vaultSession, rev);
          return {
            ...rev,
            ...decrypted,
            id: rev.recordId,
          };
        }
        return rev;
      })
    );
  }

  async function commit(item, event) {
    // Encrypt sensitive content fields
    const sensitiveFields = {
      title: item.title ?? '',
      body: item.body ?? '',
      tags: item.tags ?? [],
      nextAction: item.nextAction,
      blocker: item.blocker,
      repoUrl: item.repoUrl,
      payload: item.payload,
    };

    const envelope = await encryptRecord(vaultSession, item.id, sensitiveFields);

    // Persist envelope with only unencrypted routing metadata
    const atRest = {
      id: item.id,
      revision: item.revision,
      kind: item.kind,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt,
      ...envelope,
    };

    await store.commit(atRest, event);
    return item;
  }

  return {
    getItem,
    listItems,
    listRevisions,
    listEvents: () => store.listEvents(),
    commit,
    close: () => store.close(),
  };
}
