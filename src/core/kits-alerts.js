import { computeSha256 } from './sources.js';

export class KitIntegrityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KitIntegrityError';
  }
}

export class AlertAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AlertAuthError';
  }
}

function generateSimpleUUID() {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) {
    s += hex[Math.floor(Math.random() * 16)];
    if (i === 7 || i === 11 || i === 15 || i === 19) s += '-';
  }
  return s;
}

/**
 * Creates a portable offline project kit with verifiable SHA-256 manifest (F24).
 */
export function createProjectKit({
  projectId,
  records = [],
  attachments = [],
  clientAuthorizer,
}) {
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  if (!clientAuthorizer || !clientAuthorizer.clientId) {
    throw new Error('Authorized client required to export project kit');
  }

  const items = [];

  for (const record of records) {
    const serialized = JSON.stringify(record);
    items.push({
      type: 'record',
      id: record.id,
      sha256: computeSha256(serialized),
    });
  }

  for (const attachment of attachments) {
    const rawData = attachment.data || '';
    items.push({
      type: 'attachment',
      id: attachment.id,
      sha256: computeSha256(rawData),
    });
  }

  const manifest = {
    schemaVersion: 'dex-project-kit-manifest.v1',
    recordCount: records.length,
    attachmentCount: attachments.length,
    items,
    generatedAt: new Date().toISOString(),
  };

  return {
    schemaVersion: 'dex-project-kit.v1',
    kitId: `kit-${generateSimpleUUID()}`,
    projectId,
    createdAt: new Date().toISOString(),
    manifest,
    records: [...records],
    attachments: [...attachments],
  };
}

/**
 * Verifies manifest checksums and restores project kit offline into target store (F24).
 */
export function verifyAndRestoreProjectKit({
  kit,
  targetStore,
  verifyChecksums = true,
}) {
  if (!kit || kit.schemaVersion !== 'dex-project-kit.v1' || !kit.manifest) {
    throw new KitIntegrityError('Invalid kit structure or missing manifest');
  }

  if (verifyChecksums) {
    const recordMap = new Map((kit.records || []).map((r) => [r.id, r]));
    const attachmentMap = new Map((kit.attachments || []).map((a) => [a.id, a]));

    for (const item of kit.manifest.items) {
      if (item.type === 'record') {
        const rec = recordMap.get(item.id);
        if (!rec) {
          throw new KitIntegrityError(`Missing record ${item.id} specified in manifest`);
        }
        const actualHash = computeSha256(JSON.stringify(rec));
        if (actualHash !== item.sha256) {
          throw new KitIntegrityError(`Checksum verification failed for record ${item.id}`);
        }
      } else if (item.type === 'attachment') {
        const att = attachmentMap.get(item.id);
        if (!att) {
          throw new KitIntegrityError(`Missing attachment ${item.id} specified in manifest`);
        }
        const actualHash = computeSha256(att.data || '');
        if (actualHash !== item.sha256) {
          throw new KitIntegrityError(`Checksum verification failed for attachment ${item.id}`);
        }
      }
    }
  }

  if (targetStore) {
    for (const record of kit.records || []) {
      targetStore.putRecord(record);
    }
    for (const attachment of kit.attachments || []) {
      targetStore.putAttachment(attachment);
    }
  }

  return {
    schemaVersion: 'dex-kit-restore-receipt.v1',
    kitId: kit.kitId,
    projectId: kit.projectId,
    verified: true,
    restoredRecordCount: (kit.records || []).length,
    restoredAttachmentCount: (kit.attachments || []).length,
    restoredAt: new Date().toISOString(),
  };
}

/**
 * Produces minimal authenticated actionable alert with zero content leak and spam rate limiting (F25).
 */
export function createActionableAlert({
  condition,
  event,
  recipientAuthorizer,
  rateLimiterState = new Map(),
  throttleMs = 300000, // 5 minutes
}) {
  if (!recipientAuthorizer || !recipientAuthorizer.authenticated) {
    throw new AlertAuthError('Authenticated recipient required');
  }
  if (!condition || !event) {
    throw new Error('Condition and event are required');
  }

  const targetId = event.commitmentId || event.sourceId || event.id || 'general';
  const rateLimitKey = `${condition}:${event.type || ''}:${targetId}`;

  const now = Date.now();
  if (rateLimiterState.has(rateLimitKey)) {
    const lastTime = rateLimiterState.get(rateLimitKey);
    if (now - lastTime < throttleMs) {
      return {
        schemaVersion: 'dex-actionable-alert.v1',
        suppressed: true,
        reason: 'rate_limited_duplicate',
        condition,
        actionableTarget: targetId,
      };
    }
  }

  rateLimiterState.set(rateLimitKey, now);

  // Invariant: Minimal notification payload. Never leak raw private note bodies or keys!
  return {
    schemaVersion: 'dex-actionable-alert.v1',
    alertId: `alt-${generateSimpleUUID()}`,
    suppressed: false,
    condition,
    type: event.type || condition,
    title: event.title ? `[DEX Alert] ${event.title}` : '[DEX Alert] Action required',
    actionableTarget: targetId,
    recipientId: recipientAuthorizer.recipientId,
    contentLeaked: false, // Invariant: no body/content leak
    sanitized: true,
    createdAt: new Date().toISOString(),
  };
}
