import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ingestDictationTranscript,
  generateRedactedDiff,
  publishScopedDocumentDiff,
  PublicationError,
} from '../src/core/capture-publish.js';

test('1. ingestDictationTranscript captures explicitly submitted text with origin and zero mic permission (F22)', () => {
  const result = ingestDictationTranscript({
    transcript: 'Met with cryptographer to verify zero-plaintext recovery envelope.',
    destinationInboxId: 'inbox:dictation',
    origin: 'dex-dictate-local',
    audioMetadata: { durationSeconds: 4.5, sampleRate: 16000 },
  });

  assert.equal(result.schemaVersion, 'dex-dictation-receipt.v1');
  assert.match(result.receiptId, /^dict-[a-f0-9-]+$/);
  assert.equal(result.origin, 'dex-dictate-local');
  assert.equal(result.destinationInboxId, 'inbox:dictation');
  assert.equal(result.text, 'Met with cryptographer to verify zero-plaintext recovery envelope.');
  assert.equal(result.microphonePermissionRequested, false);
});

test('2. generateRedactedDiff redacts sensitive keywords and previews diff (F23)', () => {
  const document = {
    id: 'note:architecture',
    title: 'Security Architecture',
    body: 'Master password is SECRET_KEY_999. Relay server operates on localhost:4173.',
  };

  const preview = generateRedactedDiff({
    document,
    redactedKeywords: ['SECRET_KEY_999'],
  });

  assert.equal(preview.schemaVersion, 'dex-redacted-diff.v1');
  assert.ok(preview.redactedBody.includes('[REDACTED]'));
  assert.ok(!preview.redactedBody.includes('SECRET_KEY_999'));
  assert.equal(preview.approved, false);
});

test('3. publishScopedDocumentDiff requires human approval and prohibits wholesale vault mirror (F23)', () => {
  const preview = generateRedactedDiff({
    document: { id: 'note:spec', title: 'Open Spec', body: 'Public RFC draft.' },
    redactedKeywords: [],
  });

  // Rejects unapproved publication
  assert.throws(() => {
    publishScopedDocumentDiff({
      diffPreview: preview,
      repository: 'westkitty/Dex_Pad',
      approvedByHuman: false,
    });
  }, { name: 'PublicationError', message: /Human approval is required/ });

  // Approves publication of ONLY the named document diff
  const receipt = publishScopedDocumentDiff({
    diffPreview: preview,
    repository: 'westkitty/Dex_Pad',
    approvedByHuman: true,
    targetBranch: 'main',
  });

  assert.equal(receipt.schemaVersion, 'dex-git-pub-receipt.v1');
  assert.equal(receipt.documentId, 'note:spec');
  assert.equal(receipt.repository, 'westkitty/Dex_Pad');
  assert.equal(receipt.vaultWholesaleMirrored, false);
  assert.ok(receipt.receiptHash && receipt.receiptHash.length === 64);
});
