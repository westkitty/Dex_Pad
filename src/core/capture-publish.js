import { computeSha256 } from './sources.js';

export class PublicationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicationError';
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
 * Ingests an explicitly submitted transcription text into a destination inbox (F22).
 * Strictly requires no shared microphone permission.
 */
export function ingestDictationTranscript({
  transcript,
  destinationInboxId,
  origin = 'dex-dictate-local',
  audioMetadata = {},
}) {
  if (typeof transcript !== 'string' || !transcript.trim()) {
    throw new Error('Explicitly submitted transcript text is required');
  }
  if (!destinationInboxId) {
    throw new Error('Destination inbox ID is required');
  }

  return {
    schemaVersion: 'dex-dictation-receipt.v1',
    receiptId: `dict-${generateSimpleUUID()}`,
    origin,
    destinationInboxId,
    text: transcript.trim(),
    audioMetadata: { ...audioMetadata },
    microphonePermissionRequested: false, // Invariant: no shared dictation microphone permission
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Generates a preview diff with sensitive keyword redaction (F23).
 */
export function generateRedactedDiff({
  document,
  redactedKeywords = [],
}) {
  if (!document || !document.id) {
    throw new Error('Valid document object with id is required');
  }

  const rawBody = document.body || '';
  let redactedBody = rawBody;
  let redactionCount = 0;

  for (const keyword of redactedKeywords) {
    if (!keyword || typeof keyword !== 'string') continue;
    // Replace all occurrences of keyword
    const parts = redactedBody.split(keyword);
    if (parts.length > 1) {
      redactionCount += (parts.length - 1);
      redactedBody = parts.join('[REDACTED]');
    }
  }

  return {
    schemaVersion: 'dex-redacted-diff.v1',
    documentId: document.id,
    title: document.title || 'Untitled',
    originalBodyLength: rawBody.length,
    redactedBody,
    redactionCount,
    approved: false,
    previewedAt: new Date().toISOString(),
  };
}

/**
 * Publishes a scoped document diff after human preview and approval (F23).
 * Prohibits wholesale vault mirroring.
 */
export function publishScopedDocumentDiff({
  diffPreview,
  repository,
  approvedByHuman = false,
  targetBranch = 'main',
}) {
  if (!diffPreview || diffPreview.schemaVersion !== 'dex-redacted-diff.v1') {
    throw new PublicationError('Valid redacted diff preview is required');
  }
  if (!approvedByHuman) {
    throw new PublicationError('Human approval is required before publishing document diff');
  }
  if (!repository || typeof repository !== 'string') {
    throw new PublicationError('Target repository is required');
  }

  const payload = JSON.stringify({
    doc: diffPreview.documentId,
    repo: repository,
    branch: targetBranch,
    body: diffPreview.redactedBody,
  });

  const receiptHash = computeSha256(payload);

  return {
    schemaVersion: 'dex-git-pub-receipt.v1',
    receiptId: `pub-${generateSimpleUUID()}`,
    documentId: diffPreview.documentId,
    repository,
    targetBranch,
    vaultWholesaleMirrored: false, // Invariant: private vault never mirrors wholesale
    publishedBody: diffPreview.redactedBody,
    receiptHash,
    publishedAt: new Date().toISOString(),
    approvedByHuman: true,
  };
}
