import { encryptRecord, decryptRecord } from '../crypto/vault.js';
import { toHex, randomBytes } from '../crypto/primitives.js';

export class SyncError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SyncError';
  }
}

export class DeviceRevokedError extends SyncError {
  constructor(message = 'Device has been revoked and cannot sync') {
    super(message);
    this.name = 'DeviceRevokedError';
  }
}

export class SyncConflictError extends SyncError {
  constructor(message = 'Sync conflict detected: concurrent divergent revisions') {
    super(message);
    this.name = 'SyncConflictError';
  }
}

export class SyncEnvelopeTamperedError extends SyncError {
  constructor(message = 'Sync envelope failed authentication') {
    super(message);
    this.name = 'SyncEnvelopeTamperedError';
  }
}

export function createSyntheticRelay() {
  const envelopes = [];
  const peerReceipts = new Map(); // key: `${itemId}:${revision}` -> array of receipts
  const revokedDevices = new Set();
  const authorizedDevices = new Set(['dev-macbook-01', 'dev-phone-02', 'dev-tablet-03']);
  let seqCounter = 0;

  return {
    authorizeDevice(deviceId) {
      revokedDevices.delete(deviceId);
      authorizedDevices.add(deviceId);
    },
    revokeDevice(deviceId) {
      revokedDevices.add(deviceId);
      authorizedDevices.delete(deviceId);
    },
    isDeviceRevoked(deviceId) {
      return revokedDevices.has(deviceId);
    },
    async postPeerAck(receipt) {
      const key = `${receipt.itemId}:${receipt.revision}`;
      if (!peerReceipts.has(key)) peerReceipts.set(key, []);
      peerReceipts.get(key).push(receipt);
      return { status: 'ACK_REGISTERED', receiptSignature: receipt.receiptSignature };
    },
    async getPeerAcks({ itemId, revision }) {
      const key = `${itemId}:${revision}`;
      return peerReceipts.get(key) || [];
    },
    async pushEnvelopes({ deviceId, frames }) {
      if (revokedDevices.has(deviceId)) {
        throw new DeviceRevokedError(`Device ${deviceId} is revoked by vault authority`);
      }
      let uploaded = 0;
      for (const frame of frames) {
        // Idempotency check on (itemId, revision, updateHash)
        const exists = envelopes.some(e =>
          e.itemId === frame.itemId &&
          e.revision === frame.revision &&
          e.updateHash === frame.updateHash
        );
        if (!exists) {
          seqCounter++;
          envelopes.push({
            ...frame,
            seq: seqCounter,
            serverReceivedAt: new Date().toISOString(),
          });
          uploaded++;
        }
      }
      return {
        status: 'RELAY_STORED',
        uploadedCount: uploaded,
        serverSeq: seqCounter,
      };
    },
    async pullEnvelopes({ deviceId, afterSeq = 0, limit = 100 }) {
      if (revokedDevices.has(deviceId)) {
        throw new DeviceRevokedError(`Device ${deviceId} is revoked by vault authority`);
      }
      const candidates = envelopes.filter(e => e.seq > afterSeq && e.deviceId !== deviceId);
      const batch = candidates.slice(0, limit);
      const maxSeq = batch.length ? batch[batch.length - 1].seq : afterSeq;
      return {
        envelopes: batch,
        maxSeq,
      };
    },
    async listStoredEnvelopes() {
      return structuredClone(envelopes);
    },
  };
}

export function createSyncEngine({
  deviceId,
  vaultSession,
  workspace,
  store,
  relay,
} = {}) {
  if (!deviceId) throw new Error('deviceId is required');
  if (!vaultSession) throw new Error('vaultSession is required');
  if (!workspace) throw new Error('workspace is required');
  if (!store) throw new Error('store is required');
  if (!relay) throw new Error('relay is required');

  let lastSyncedSeq = 0;
  const bufferedFrames = new Map(); // key: `${itemId}:${revision}`
  const pushedFrames = new Set(); // key: `${itemId}:${revision}:${updateHash}`
  const pushedRevisions = new Set(); // key: `${itemId}:${revision}`
  const conflicts = [];

  async function computeUpdateHash(ciphertext) {
    const data = new TextEncoder().encode(ciphertext);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return toHex(new Uint8Array(digest));
  }

  async function getPendingFrames() {
    const items = await store.listItems();
    const pending = [];

    for (const item of items) {
      if (item.kind === 'relay-event') continue; // Scoped relay events stay local to project
      const revisions = await store.listRevisions(item.id);
      for (const rev of revisions) {
        const revKey = `${rev.id}:${rev.revision}`;
        if (pushedRevisions.has(revKey)) continue;

        const sensitive = {
          title: rev.title ?? '',
          body: rev.body ?? '',
          tags: rev.tags ?? [],
          evidence: rev.evidence ?? 'proposed',
          evidenceRef: rev.evidenceRef ?? '',
          nextAction: rev.nextAction,
          blocker: rev.blocker,
          repoUrl: rev.repoUrl,
        };

        const ciphertextEnvelope = await encryptRecord(vaultSession, rev.id, sensitive);
        const updateHash = await computeUpdateHash(ciphertextEnvelope.ciphertext);

        pending.push({
          schemaVersion: 'dex-sync.v1',
          deviceId,
          itemId: rev.id,
          revision: rev.revision,
          kind: rev.kind ?? 'note',
          createdAt: rev.createdAt,
          updatedAt: rev.updatedAt,
          deletedAt: rev.deletedAt,
          updateHash,
          envelope: {
            schemaVersion: 'dex-sync.v1',
            ciphertext: ciphertextEnvelope.ciphertext,
            iv: ciphertextEnvelope.iv,
            authData: ciphertextEnvelope.authData,
            ciphertextEnvelope,
          },
        });
      }
    }
    return pending;
  }

  async function push() {
    if (relay.isDeviceRevoked(deviceId)) {
      throw new DeviceRevokedError(`Device ${deviceId} is revoked by vault authority`);
    }
    const frames = await getPendingFrames();
    if (!frames.length) {
      return { status: 'RELAY_STORED', uploadedCount: 0 };
    }

    const receipt = await relay.pushEnvelopes({ deviceId, frames });
    for (const f of frames) {
      pushedRevisions.add(`${f.itemId}:${f.revision}`);
      pushedFrames.add(`${f.itemId}:${f.revision}:${f.updateHash}`);
    }
    return {
      status: 'RELAY_STORED',
      uploadedCount: receipt.uploadedCount,
    };
  }

  async function applyFrame(frame) {
    const decrypted = await decryptRecord(vaultSession, frame.envelope.ciphertextEnvelope);
    const existing = await store.getItem(frame.itemId);

    if (!existing) {
      if (frame.revision === 1) {
        // Direct creation from peer
        const item = {
          id: frame.itemId,
          revision: 1,
          kind: frame.kind,
          createdAt: frame.createdAt,
          updatedAt: frame.updatedAt,
          deletedAt: frame.deletedAt,
          ...decrypted,
        };
        const evt = { id: `${item.id}:1`, itemId: item.id, kind: item.kind, revision: 1, action: 'synced', at: item.updatedAt };
        await store.commit(item, evt);
        pushedRevisions.add(`${frame.itemId}:1`);
        pushedFrames.add(`${frame.itemId}:1:${frame.updateHash}`);
        return true;
      }
      return false;
    }

    if (frame.revision === existing.revision + 1) {
      // Clean forward progress
      const next = {
        ...existing,
        ...decrypted,
        revision: frame.revision,
        updatedAt: frame.updatedAt,
        deletedAt: frame.deletedAt,
      };
      const evt = { id: `${next.id}:${next.revision}`, itemId: next.id, kind: next.kind, revision: next.revision, action: 'synced', at: next.updatedAt };
      await store.commit(next, evt);
      pushedRevisions.add(`${frame.itemId}:${frame.revision}`);
      pushedFrames.add(`${frame.itemId}:${frame.revision}:${frame.updateHash}`);
      return true;
    }

    if (frame.revision === existing.revision) {
      // Check if identical update
      if (existing.body === decrypted.body && existing.title === decrypted.title) {
        return true; // Already applied
      }
      // Concurrent divergent edit at same revision: Conflict!
      const conflictRecord = {
        itemId: frame.itemId,
        baseRevision: frame.revision - 1,
        localRevision: existing.revision,
        peerRevision: frame.revision,
        peerDeviceId: frame.deviceId,
        detectedAt: new Date().toISOString(),
      };
      conflicts.push(conflictRecord);

      // Preserve peer version as a conflict fork revision
      const forked = {
        ...existing,
        revision: existing.revision + 1,
        body: `${existing.body}\n\n[CONFLICT FORK from ${frame.deviceId}]:\n${decrypted.body}`,
        conflict: conflictRecord,
        updatedAt: new Date().toISOString(),
      };
      const evt = { id: `${forked.id}:${forked.revision}`, itemId: forked.id, kind: forked.kind, revision: forked.revision, action: 'conflict-fork', at: forked.updatedAt };
      await store.commit(forked, evt);
      return true;
    }

    return false;
  }

  async function checkBuffered(itemId) {
    let appliedAny = false;
    let progressed = true;
    while (progressed) {
      progressed = false;
      const current = await store.getItem(itemId);
      const nextRevision = current ? current.revision + 1 : 1;
      const key = `${itemId}:${nextRevision}`;
      if (bufferedFrames.has(key)) {
        const frame = bufferedFrames.get(key);
        bufferedFrames.delete(key);
        const ok = await applyFrame(frame);
        if (ok) {
          progressed = true;
          appliedAny = true;
        }
      }
    }
    return appliedAny;
  }

  async function receiveFrame(frame) {
    const existing = await store.getItem(frame.itemId);

    if (!existing) {
      if (frame.revision === 1) {
        await applyFrame(frame);
        await checkBuffered(frame.itemId);
        return { status: 'APPLIED' };
      }
      // Out of order! Predecessor Rev 1 is missing
      bufferedFrames.set(`${frame.itemId}:${frame.revision}`, frame);
      return { status: 'BUFFERED', reason: 'MISSING_PREDECESSOR' };
    }

    if (frame.revision <= existing.revision) {
      if (frame.revision === existing.revision) {
        await applyFrame(frame);
        return { status: 'APPLIED' };
      }
      return { status: 'IDEMPOTENT_IGNORED' };
    }

    if (frame.revision === existing.revision + 1) {
      await applyFrame(frame);
      await checkBuffered(frame.itemId);
      return { status: 'APPLIED' };
    }

    // Gap: frame.revision > existing.revision + 1
    bufferedFrames.set(`${frame.itemId}:${frame.revision}`, frame);
    return { status: 'BUFFERED', reason: 'GAP_DETECTED' };
  }

  async function pull({ maxBatch = 100 } = {}) {
    const { envelopes, maxSeq } = await relay.pullEnvelopes({
      deviceId,
      afterSeq: lastSyncedSeq,
      limit: maxBatch,
    });

    let count = 0;
    for (const env of envelopes) {
      const res = await receiveFrame(env);
      if (res.status === 'APPLIED') {
        count++;
        // Post peer acknowledgment receipt to relay
        if (typeof relay.postPeerAck === 'function') {
          const ackData = new TextEncoder().encode(`${env.itemId}:${env.revision}:${env.updateHash}:${deviceId}`);
          const ackHash = await globalThis.crypto.subtle.digest('SHA-256', ackData);
          const receiptSignature = toHex(new Uint8Array(ackHash));
          await relay.postPeerAck({
            schemaVersion: 'dex-peer-ack.v1',
            itemId: env.itemId,
            revision: env.revision,
            updateHash: env.updateHash,
            appliedByDeviceId: deviceId,
            appliedAt: new Date().toISOString(),
            receiptSignature,
          });
        }
      }
    }
    lastSyncedSeq = maxSeq;
    return {
      status: 'PEER_APPLIED',
      appliedCount: count,
      cursor: lastSyncedSeq,
    };
  }

  async function getItemSyncState(itemId, revision = 1) {
    const item = await store.getItem(itemId);
    if (!item) return { state: 'UNKNOWN', itemId, revision };

    // Check if pending frames exist for this item
    const pending = await getPendingFrames();
    const isPending = pending.some(f => f.itemId === itemId && f.revision === revision);

    if (isPending) {
      return {
        state: 'SAVED_LOCALLY',
        itemId,
        revision,
        pendingUpload: true,
        relayStored: false,
        peerApplied: false,
        details: 'Record saved in local storage; pending relay upload',
      };
    }

    // Check peer acknowledgments from relay
    if (typeof relay.getPeerAcks === 'function') {
      const acks = await relay.getPeerAcks({ itemId, revision });
      const peerAck = acks.find(a => a.appliedByDeviceId !== deviceId);

      if (peerAck) {
        return {
          state: 'PEER_APPLIED',
          itemId,
          revision,
          pendingUpload: false,
          relayStored: true,
          peerApplied: true,
          appliedByDeviceId: peerAck.appliedByDeviceId,
          appliedAt: peerAck.appliedAt,
          receiptSignature: peerAck.receiptSignature,
          details: `Applied and confirmed by peer device ${peerAck.appliedByDeviceId}`,
        };
      }
    }

    // Pushed to relay, waiting for peer device pull
    return {
      state: 'RELAY_STORED',
      itemId,
      revision,
      pendingUpload: false,
      relayStored: true,
      peerApplied: false,
      details: 'Stored on relay; awaiting peer confirmation',
    };
  }

  async function sync() {
    await push();
    await pull();
    return {
      status: 'SYNC_COMPLETE',
      conflicts: [...conflicts],
    };
  }

  async function issuePairingToken(targetDeviceId) {
    const token = `pair-${toHex(randomBytes(16))}`;
    relay.authorizeDevice(targetDeviceId);
    return {
      token,
      targetDeviceId,
      issuedAt: new Date().toISOString(),
    };
  }

  async function revokeDevice(targetDeviceId) {
    relay.revokeDevice(targetDeviceId);
    return {
      revokedDeviceId: targetDeviceId,
      revokedAt: new Date().toISOString(),
      note: 'Device revoked from future sync; note that revocation cannot erase previously acquired offline plaintext.',
    };
  }

  return {
    getPendingFrames,
    push,
    pull,
    sync,
    receiveFrame,
    getItemSyncState,
    issuePairingToken,
    revokeDevice,
    getBufferedCount: () => bufferedFrames.size,
    getLastSyncedSeq: () => lastSyncedSeq,
  };
}
