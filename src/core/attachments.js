import { computeSha256 } from './sources.js';
import { toBase64, fromBase64 } from './crypto/primitives.js';

export class AttachmentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AttachmentError';
  }
}

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentLabel(mimeType) {
  if (mimeType === 'application/pdf') return 'PDF document';
  if (mimeType.includes('markdown') || mimeType === 'text/plain') return 'Text document';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip')) return 'Archive';
  return 'Document';
}

/**
 * Creates an Encrypted Attachment record (C15) with bounded size and safe preview.
 */
export async function createAttachmentRecord({
  name,
  mimeType,
  dataBytes,
} = {}) {
  if (!name || typeof name !== 'string') {
    throw new AttachmentError('Attachment name is required');
  }
  if (!mimeType || typeof mimeType !== 'string') {
    throw new AttachmentError('mimeType is required');
  }
  if (!(dataBytes instanceof Uint8Array)) {
    throw new AttachmentError('dataBytes must be a Uint8Array');
  }
  if (dataBytes.byteLength > MAX_ATTACHMENT_SIZE) {
    throw new AttachmentError('Attachment exceeds maximum allowed size of 10MB');
  }

  const cleanMime = mimeType.trim().toLowerCase();
  const cleanName = name.trim();
  const fileHash = computeSha256(dataBytes);

  const safePreview = cleanMime.startsWith('image/')
    ? {
        isImage: true,
        typeLabel: 'Image',
        byteLengthFormatted: formatBytes(dataBytes.byteLength),
      }
    : {
        isImage: false,
        typeLabel: getDocumentLabel(cleanMime),
        byteLengthFormatted: formatBytes(dataBytes.byteLength),
      };

  return {
    schemaVersion: 'dex-attachment.v1',
    attachmentId: `att-${crypto.randomUUID()}`,
    name: cleanName,
    mimeType: cleanMime,
    byteLength: dataBytes.byteLength,
    fileHash,
    safePreview,
    payloadBase64: toBase64(dataBytes),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Recovers attachment raw bytes independently from storage (C15).
 */
export async function recoverAttachmentBytes({ attachment } = {}) {
  if (!attachment || !attachment.payloadBase64) {
    throw new AttachmentError('Valid attachment record with payloadBase64 is required');
  }
  return fromBase64(attachment.payloadBase64);
}
