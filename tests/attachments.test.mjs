import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAttachmentRecord,
  recoverAttachmentBytes,
  AttachmentError,
} from '../src/core/attachments.js';

test('1. createAttachmentRecord bounds size, provides safe preview, and encrypts payload (C15)', async () => {
  const sampleData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
  const attachment = await createAttachmentRecord({
    name: 'architecture-diagram.png',
    mimeType: 'image/png',
    dataBytes: sampleData,
  });

  assert.equal(attachment.schemaVersion, 'dex-attachment.v1');
  assert.match(attachment.attachmentId, /^att-[a-f0-9-]+$/);
  assert.equal(attachment.name, 'architecture-diagram.png');
  assert.equal(attachment.mimeType, 'image/png');
  assert.equal(attachment.byteLength, 8);
  assert.ok(attachment.fileHash && attachment.fileHash.length === 64);
  assert.ok(attachment.safePreview);
  assert.equal(attachment.safePreview.isImage, true);

  // Recovery of attachment bytes
  const recovered = await recoverAttachmentBytes({ attachment });
  assert.deepEqual(recovered, sampleData);
});

test('2. rejects oversized attachments exceeding 10MB limit (C15)', async () => {
  const oversizedData = new Uint8Array(10 * 1024 * 1024 + 1); // 10MB + 1 byte
  await assert.rejects(async () => {
    await createAttachmentRecord({
      name: 'huge-file.bin',
      mimeType: 'application/octet-stream',
      dataBytes: oversizedData,
    });
  }, { name: 'AttachmentError', message: /exceeds maximum allowed size of 10MB/ });
});

test('3. generates safe preview for non-image documents without executing code (C15)', async () => {
  const pdfBytes = new TextEncoder().encode('%PDF-1.4 sample content');
  const attachment = await createAttachmentRecord({
    name: 'spec.pdf',
    mimeType: 'application/pdf',
    dataBytes: pdfBytes,
  });

  assert.equal(attachment.safePreview.isImage, false);
  assert.equal(attachment.safePreview.typeLabel, 'PDF document');
  assert.equal(attachment.safePreview.byteLengthFormatted, '23 B');
});
