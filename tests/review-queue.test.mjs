import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCandidateDuplicates,
  createReviewCandidate,
  resolveReviewCandidate,
  createSourceWatcher,
  submitWatcherReceipt,
  disableSourceWatcher,
  ReviewQueueError,
  WatcherDisabledError,
} from '../src/core/review-queue.js';

test('1. detectCandidateDuplicates identifies potential duplicates without auto-merging or deleting records (F15)', () => {
  const items = [
    { id: 'note:1', title: 'Zero Dependency Runtime Invariant', body: 'The application runtime has zero npm dependencies.', tags: ['security'] },
    { id: 'note:2', title: 'Zero Dependency Runtime Invariant (Copy)', body: 'The application runtime has zero npm dependencies duplicate note.', tags: ['security'] },
    { id: 'note:3', title: 'Android Virtual Device Testing', body: 'Emulator setup and ADB commands.', tags: ['testing'] },
  ];

  const candidates = detectCandidateDuplicates({ items, threshold: 0.6 });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].itemAId, 'note:1');
  assert.equal(candidates[0].itemBId, 'note:2');
  assert.ok(candidates[0].similarityScore >= 0.6);
  assert.equal(candidates[0].autoMerged, false);

  // Original items array is unchanged (non-destructive)
  assert.equal(items.length, 3);
});

test('2. resolveReviewCandidate enforces human recovery and rejects silent auto-merge (F15)', () => {
  const candidate = createReviewCandidate({
    candidateId: 'rev-cand-01',
    type: 'CONTRADICTION',
    itemIds: ['decision:d1', 'decision:d2'],
    rationale: 'Conflicting election timeout configurations detected.',
    sources: ['src:spec-v1', 'src:spec-v2'],
  });

  assert.equal(candidate.status, 'PENDING_HUMAN_REVIEW');
  assert.deepEqual(candidate.sources, ['src:spec-v1', 'src:spec-v2']);

  // Human review resolution
  const resolved = resolveReviewCandidate({
    candidate,
    resolution: 'MARK_SUPERSEDED',
    preferredItemId: 'decision:d2',
    notes: 'Specification v2 supersedes v1.',
  });

  assert.equal(resolved.status, 'RESOLVED');
  assert.equal(resolved.resolution, 'MARK_SUPERSEDED');
  assert.equal(resolved.notes, 'Specification v2 supersedes v1.');

  // Rejects invalid auto-merge resolution attempt
  assert.throws(() => {
    resolveReviewCandidate({ candidate, resolution: 'SILENT_AUTO_DELETE' });
  }, { name: 'ReviewQueueError', message: /Silent auto-delete or automatic merge is prohibited/ });
});

test('3. approved watcher submits authorized change receipt (F16)', () => {
  const watcher = createSourceWatcher({
    sourceId: 'src:rfc-spec',
    watcherId: 'watch:github-releases',
    authToken: 'auth-token-secret-123',
  });

  assert.equal(watcher.enabled, true);
  assert.equal(watcher.sourceId, 'src:rfc-spec');

  const receipt = submitWatcherReceipt({
    watcher,
    changeEvent: {
      action: 'RELEASE_PUBLISHED',
      newVersion: 'v2.1.0',
      changeHash: 'e'.repeat(64),
    },
    authToken: 'auth-token-secret-123',
  });

  assert.equal(receipt.schemaVersion, 'dex-watcher-receipt.v1');
  assert.match(receipt.receiptId, /^rcpt-[a-f0-9-]+$/);
  assert.equal(receipt.watcherId, 'watch:github-releases');
  assert.equal(receipt.sourceId, 'src:rfc-spec');
  assert.equal(receipt.stage, 'CHANGE_SUBMITTED');
  assert.equal(receipt.changeHash, 'e'.repeat(64));
});

test('4. disabling watcher leaves capture intact and rejects further submissions (F16)', () => {
  let watcher = createSourceWatcher({
    sourceId: 'src:blog-feed',
    watcherId: 'watch:blog',
    authToken: 'token-abc',
  });

  watcher = disableSourceWatcher(watcher);
  assert.equal(watcher.enabled, false);

  // Subsequent submission is rejected with WatcherDisabledError
  assert.throws(() => {
    submitWatcherReceipt({
      watcher,
      changeEvent: { action: 'UPDATE' },
      authToken: 'token-abc',
    });
  }, { name: 'WatcherDisabledError', message: /Watcher is disabled/ });
});
