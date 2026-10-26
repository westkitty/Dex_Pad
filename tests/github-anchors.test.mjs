import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRepoMarginNote,
  verifyMarginNoteAgainstRevision,
  createGitHubIssueDraft,
  publishGitHubIssue,
  GitHubAdapterError,
} from '../src/core/github-anchors.js';

test('1. createRepoMarginNote retains immutable commit/path/range anchor (F04)', () => {
  const note = createRepoMarginNote({
    repository: 'westkitty/Dex_Pad',
    commitSha: '1e1fca6d26b59e3b1e0f23dbf5810b370e685850',
    path: 'src/core/workspace.js',
    lineRange: { start: 20, end: 45 },
    noteText: 'Evidence gate normalization logic must remain strict.',
  });

  assert.equal(note.schemaVersion, 'dex-margin-note.v1');
  assert.match(note.marginNoteId, /^mgn-[a-f0-9-]+$/);
  assert.equal(note.repository, 'westkitty/Dex_Pad');
  assert.equal(note.commitSha, '1e1fca6d26b59e3b1e0f23dbf5810b370e685850');
  assert.equal(note.path, 'src/core/workspace.js');
  assert.deepEqual(note.lineRange, { start: 20, end: 45 });
  assert.equal(note.noteText, 'Evidence gate normalization logic must remain strict.');
});

test('2. verifyMarginNoteAgainstRevision warns when viewing an unrelated newer revision (F04)', () => {
  const note = createRepoMarginNote({
    repository: 'westkitty/Dex_Pad',
    commitSha: '1e1fca6d26b59e3b1e0f23dbf5810b370e685850',
    path: 'src/ui/app.js',
    lineRange: { start: 10, end: 20 },
    noteText: 'Check category definitions',
  });

  // Same commit
  const currentCheck = verifyMarginNoteAgainstRevision({
    marginNote: note,
    currentCommitSha: '1e1fca6d26b59e3b1e0f23dbf5810b370e685850',
  });
  assert.equal(currentCheck.status, 'CURRENT');
  assert.equal(currentCheck.warning, null);

  // Newer or different commit
  const newerCheck = verifyMarginNoteAgainstRevision({
    marginNote: note,
    currentCommitSha: '3bd75166d2a99d5224438710ce011e5ac280561b',
  });
  assert.equal(newerCheck.status, 'STALE_REVISION_WARNING');
  assert.ok(newerCheck.warning.includes('newer or different commit'));
  assert.ok(newerCheck.warning.includes('3bd7516'));
});

test('3. createGitHubIssueDraft creates preview draft bounded to named repo (F07)', () => {
  const draft = createGitHubIssueDraft({
    repository: 'westkitty/Dex_Pad',
    title: 'Tighten Base64 Padding Verification in Cryptographic Proofs',
    body: 'Bit flip tests at index 0 guarantee corruption detection.',
    labels: ['security', 'testing'],
  });

  assert.equal(draft.schemaVersion, 'dex-github-draft.v1');
  assert.equal(draft.repository, 'westkitty/Dex_Pad');
  assert.equal(draft.title, 'Tighten Base64 Padding Verification in Cryptographic Proofs');
  assert.equal(draft.published, false);
});

test('4. publishGitHubIssue requires explicit confirmation and returns idempotent receipt (F07)', () => {
  const draft = createGitHubIssueDraft({
    repository: 'westkitty/Dex_Pad',
    title: 'Document Zero-Dependency Runtime Floor',
    body: 'Clarify that runtime packages must remain 0.',
  });

  // Rejects publication without explicit user confirmation
  assert.throws(() => {
    publishGitHubIssue({
      draft,
      confirmationConfirmed: false,
      repository: 'westkitty/Dex_Pad',
    });
  }, { name: 'GitHubAdapterError', message: /Explicit user confirmation is required/ });

  // Rejects publication to wrong repository
  assert.throws(() => {
    publishGitHubIssue({
      draft,
      confirmationConfirmed: true,
      repository: 'other-org/other-repo',
    });
  }, { name: 'GitHubAdapterError', message: /Target repository does not match/ });

  // Successful publishing with mock dispatcher
  let dispatched = false;
  const receipt = publishGitHubIssue({
    draft,
    confirmationConfirmed: true,
    repository: 'westkitty/Dex_Pad',
    mockDispatcher: (req) => {
      dispatched = true;
      return { issueNumber: 42, htmlUrl: 'https://github.com/westkitty/Dex_Pad/issues/42' };
    },
  });

  assert.ok(dispatched);
  assert.equal(receipt.schemaVersion, 'dex-github-receipt.v1');
  assert.equal(receipt.repository, 'westkitty/Dex_Pad');
  assert.equal(receipt.issueNumber, 42);
  assert.ok(receipt.receiptHash && receipt.receiptHash.length === 64);
});
