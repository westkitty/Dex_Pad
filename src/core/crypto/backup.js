import {
  fromHex,
  toHex,
  toBase64,
  fromBase64,
  randomBytes,
  encryptGcm,
  decryptGcm,
  TamperedCiphertextError,
} from './primitives.js';
import {
  deriveKeyHierarchy,
  recoverVault,
  unlockVault,
  createVaultSession,
  InvalidCredentialsError,
  VaultLockedError,
} from './vault.js';

export class BackupError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BackupError';
  }
}

export class CorruptBackupError extends BackupError {
  constructor(message = 'Backup archive is corrupt or has been tampered with') {
    super(message);
    this.name = 'CorruptBackupError';
  }
}

export class KeyEpochMismatchError extends BackupError {
  constructor(message = 'Key epoch mismatch between backup and current vault') {
    super(message);
    this.name = 'KeyEpochMismatchError';
  }
}

export class VaultIdMismatchError extends BackupError {
  constructor(message = 'Backup belongs to a different vault') {
    super(message);
    this.name = 'VaultIdMismatchError';
  }
}

export class ConsentRequiredError extends BackupError {
  constructor(message = 'Explicit user consent required for unencrypted export') {
    super(message);
    this.name = 'ConsentRequiredError';
  }
}

const BACKUP_SCHEMA_V1 = 'dex-backup.v1';

async function computeChecksum(payload) {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function canonicalRecordsString(records) {
  const sorted = [...records].sort((a, b) => {
    const idA = a.recordId || a.id || '';
    const idB = b.recordId || b.id || '';
    return idA.localeCompare(idB);
  });
  return JSON.stringify(sorted);
}

/**
 * Creates an encrypted, deterministic backup snapshot of all records in the store.
 */
export async function createEncryptedBackup({ vault, vaultSession, vaultManifest, store, exportedBy = 'client-offline' }) {
  const session = vaultSession || vault?.session || vault;
  const manifest = vaultManifest || vault?.manifest || vault?.envelope || {
    vaultId: vault?.identity?.vaultId || (session?.getVaultId && session.getVaultId()),
    keyEpoch: vault?.identity?.keyEpoch || 1,
  };

  if (!session || typeof session.isUnlocked !== 'function' || !session.isUnlocked()) {
    throw new VaultLockedError('Cannot create backup: vault is locked');
  }

  const vaultId = manifest.vaultId || session.getVaultId();
  const keyEpoch = manifest.keyEpoch || (manifest.kdfParams ? 1 : (vault?.identity?.keyEpoch || 1));

  // Retrieve raw encrypted records from store
  let rawRecords = [];
  if (typeof store.listItems === 'function') {
    rawRecords = await store.listItems();
  } else if (typeof store.list === 'function') {
    rawRecords = await store.list();
  } else if (typeof store.getAll === 'function') {
    rawRecords = await store.getAll();
  }

  // Filter and format records for backup
  const backupRecords = rawRecords.map(item => {
    const recordId = item.id || item.recordId;
    // If item is already an encrypted envelope (from encStore), keep encrypted fields
    if (item.ciphertext && item.iv) {
      return {
        id: recordId,
        recordId,
        schemaVersion: item.schemaVersion || 'dex-record.v1',
        vaultId: item.vaultId || vaultId,
        epoch: item.epoch || keyEpoch,
        iv: item.iv,
        ciphertext: item.ciphertext,
        tag: item.tag || null,
        authData: item.authData || null,
        revision: item.revision || 1,
        kind: item.kind || 'note',
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        deletedAt: item.deletedAt || null,
      };
    }
    // If raw record is stored directly
    return {
      id: recordId,
      recordId,
      ...item,
    };
  });

  const sortedJson = canonicalRecordsString(backupRecords);
  const canonicalPayload = JSON.stringify({
    schemaVersion: BACKUP_SCHEMA_V1,
    vaultId,
    keyEpoch,
    recordsCount: backupRecords.length,
    recordsJson: sortedJson,
  });

  const checksum = await computeChecksum(canonicalPayload);

  return {
    schemaVersion: BACKUP_SCHEMA_V1,
    vaultId,
    keyEpoch,
    createdAt: new Date().toISOString(),
    exportedBy,
    recordsCount: backupRecords.length,
    checksum,
    records: backupRecords,
  };
}

/**
 * Validates the cryptographic checksum and schema of a backup archive.
 */
export async function verifyBackupIntegrity(backupArchive) {
  if (!backupArchive || typeof backupArchive !== 'object') {
    throw new CorruptBackupError('Invalid backup archive object');
  }

  if (backupArchive.schemaVersion !== BACKUP_SCHEMA_V1) {
    throw new CorruptBackupError(`Unsupported backup schema: ${backupArchive.schemaVersion}`);
  }

  if (!Array.isArray(backupArchive.records)) {
    throw new CorruptBackupError('Backup missing records collection');
  }

  if (backupArchive.records.length !== backupArchive.recordsCount) {
    throw new CorruptBackupError(
      `Record count mismatch: metadata states ${backupArchive.recordsCount}, found ${backupArchive.records.length}`
    );
  }

  const sortedJson = canonicalRecordsString(backupArchive.records);
  const canonicalPayload = JSON.stringify({
    schemaVersion: backupArchive.schemaVersion,
    vaultId: backupArchive.vaultId,
    keyEpoch: backupArchive.keyEpoch,
    recordsCount: backupArchive.recordsCount,
    recordsJson: sortedJson,
  });

  const calculatedChecksum = await computeChecksum(canonicalPayload);
  if (calculatedChecksum !== backupArchive.checksum) {
    throw new CorruptBackupError('Backup checksum mismatch: archive contents have been modified or corrupted');
  }

  return {
    valid: true,
    vaultId: backupArchive.vaultId,
    keyEpoch: backupArchive.keyEpoch,
    recordsCount: backupArchive.recordsCount,
    checksum: backupArchive.checksum,
  };
}

/**
 * Restores all encrypted records from a verified backup archive into a target store.
 */
export async function restoreEncryptedBackup({ backupArchive, vault, vaultSession, vaultManifest, store, allowDifferentVault = false }) {
  const session = vaultSession || vault?.session || vault;
  const manifest = vaultManifest || vault?.manifest || vault?.envelope || {
    vaultId: vault?.identity?.vaultId || (session?.getVaultId && session.getVaultId()),
    keyEpoch: vault?.identity?.keyEpoch || 1,
  };

  const currentVaultId = manifest.vaultId || (session?.getVaultId && session.getVaultId());
  const currentKeyEpoch = manifest.keyEpoch || 1;

  await verifyBackupIntegrity(backupArchive);

  if (!allowDifferentVault && currentVaultId && backupArchive.vaultId !== currentVaultId) {
    throw new VaultIdMismatchError(`Backup vaultId (${backupArchive.vaultId}) does not match current vault (${currentVaultId})`);
  }

  if (backupArchive.keyEpoch !== currentKeyEpoch) {
    throw new KeyEpochMismatchError(
      `Backup key epoch (${backupArchive.keyEpoch}) does not match current vault key epoch (${currentKeyEpoch})`
    );
  }

  let restoredCount = 0;
  for (const record of backupArchive.records) {
    const recordId = record.id || record.recordId;
    const itemToStore = {
      ...record,
      id: recordId,
      recordId,
    };
    if (typeof store.set === 'function') {
      await store.set(recordId, itemToStore);
      restoredCount++;
    } else if (typeof store.put === 'function') {
      await store.put(itemToStore);
      restoredCount++;
    } else if (typeof store.commit === 'function') {
      await store.commit(itemToStore, {
        id: `${recordId}:restore`,
        itemId: recordId,
        kind: itemToStore.kind || 'note',
        revision: itemToStore.revision || 1,
        action: 'restored_from_backup',
        at: new Date().toISOString(),
      });
      restoredCount++;
    }
  }

  return {
    restoredCount,
    vaultId: backupArchive.vaultId,
    keyEpoch: backupArchive.keyEpoch,
  };
}

/**
 * Recovers a vault using an emergency recovery code, allowing passphrase reset.
 */
export async function recoverVaultWithCode({ envelope, manifest, recoveryCode, newPassphrase, iterations = 100_000 }) {
  const targetManifest = manifest || envelope;
  if (!targetManifest) {
    throw new InvalidCredentialsError('Recovery requires a valid vault manifest or envelope');
  }

  // Recover session and vaultKey using recovery credentials
  let session;
  try {
    session = await recoverVault({ manifest: targetManifest, recoveryCode, iterations });
  } catch (err) {
    throw new InvalidCredentialsError(`Invalid recovery code or tampered recovery envelope: ${err.message}`);
  }

  const vaultKey = session.getVaultKey();
  const rawVaultKeyBytes = await globalThis.crypto.subtle.exportKey('raw', vaultKey);
  const vaultId = targetManifest.vaultId;

  // Derive new key hierarchy from new passphrase
  const newSalt = randomBytes(16);
  const newHierarchy = await deriveKeyHierarchy({
    passphrase: newPassphrase,
    salt: newSalt,
    iterations,
  });

  // Re-wrap VaultKey with new authKey
  const newAuthIv = randomBytes(12);
  const newWrappedByAuth = await encryptGcm({
    key: newHierarchy.authKey,
    plaintext: rawVaultKeyBytes,
    iv: newAuthIv,
    additionalData: `auth-wrap:${vaultId}`,
  });

  // Re-create authCheck with new authKey
  const checkIv = randomBytes(12);
  const newAuthCheck = await encryptGcm({
    key: newHierarchy.authKey,
    plaintext: JSON.stringify({ valid: true, vaultId }),
    iv: checkIv,
    additionalData: `auth-check:${vaultId}`,
  });

  const newEnvelope = {
    ...targetManifest,
    updatedAt: new Date().toISOString(),
    kdfParams: {
      algorithm: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: toHex(newSalt),
    },
    wrappedVaultKey: {
      iv: toHex(newAuthIv),
      ciphertext: toBase64(newWrappedByAuth),
    },
    authCheck: {
      iv: toHex(checkIv),
      ciphertext: toBase64(newAuthCheck),
    },
  };

  return {
    vaultId,
    newEnvelope,
    newManifest: newEnvelope,
    session,
  };
}

/**
 * Export unencrypted data with mandatory explicit consent gating.
 */
export async function exportUnencryptedWithConsent({ workspace, consentGiven, reason = 'manual-export' }) {
  if (consentGiven !== true) {
    throw new ConsentRequiredError(
      'Unencrypted export strictly requires explicit user confirmation. Plaintext data leaves the secure boundary.'
    );
  }

  let data = {};
  if (typeof workspace.exportData === 'function') {
    data = await workspace.exportData();
  } else if (typeof workspace.list === 'function') {
    data = { items: await workspace.list({ includeDeleted: true }) };
  }

  return {
    warning: 'UNENCRYPTED_DEVELOPMENT_EXPORT_SYNTHETIC_DATA_ONLY',
    exportedAt: new Date().toISOString(),
    consentReason: reason,
    ...data,
  };
}
