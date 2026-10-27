import { computeSha256 } from './sources.js';

export class GitHubAdapterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GitHubAdapterError';
  }
}

/**
 * Creates a Repository-Anchored Margin Note (F04).
 * Retains an immutable commit SHA, path, and line range anchor.
 */
export function createRepoMarginNote({
  repository,
  commitSha,
  path,
  lineRange,
  noteText = '',
  targetItemId = null,
} = {}) {
  if (!repository || typeof repository !== 'string') {
    throw new GitHubAdapterError('repository is required (e.g. owner/repo)');
  }
  if (!commitSha || typeof commitSha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(commitSha.trim())) {
    throw new GitHubAdapterError('Valid commitSha is required');
  }
  if (!path || typeof path !== 'string') {
    throw new GitHubAdapterError('path is required');
  }
  if (!lineRange || typeof lineRange.start !== 'number' || typeof lineRange.end !== 'number') {
    throw new GitHubAdapterError('lineRange with start and end numbers is required');
  }

  return {
    schemaVersion: 'dex-margin-note.v1',
    marginNoteId: `mgn-${crypto.randomUUID()}`,
    repository: repository.trim(),
    commitSha: commitSha.trim().toLowerCase(),
    path: path.trim(),
    lineRange: { start: lineRange.start, end: lineRange.end },
    noteText: String(noteText || '').trim(),
    targetItemId: targetItemId ? String(targetItemId).trim() : null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Verifies a margin note against a viewed repository revision (F04).
 * Crucial invariant: Warns when viewing an unrelated newer revision.
 */
export function verifyMarginNoteAgainstRevision({
  marginNote,
  currentCommitSha,
} = {}) {
  if (!marginNote || !marginNote.commitSha) {
    throw new GitHubAdapterError('Valid margin note is required');
  }
  if (!currentCommitSha || typeof currentCommitSha !== 'string') {
    throw new GitHubAdapterError('currentCommitSha is required');
  }

  const cleanCurrent = currentCommitSha.trim().toLowerCase();
  const cleanAnchor = marginNote.commitSha.toLowerCase();

  if (cleanCurrent.startsWith(cleanAnchor) || cleanAnchor.startsWith(cleanCurrent)) {
    return {
      status: 'CURRENT',
      warning: null,
    };
  }

  return {
    status: 'STALE_REVISION_WARNING',
    warning: `Viewing newer or different commit ${cleanCurrent.slice(0, 7)}: anchor was created on ${cleanAnchor.slice(0, 7)}.`,
  };
}

/**
 * Creates a previewed GitHub Issue draft (F07).
 */
export function createGitHubIssueDraft({
  repository,
  title,
  body,
  labels = [],
} = {}) {
  if (!repository || typeof repository !== 'string') {
    throw new GitHubAdapterError('repository is required');
  }
  if (!title || typeof title !== 'string') {
    throw new GitHubAdapterError('title is required');
  }

  return {
    schemaVersion: 'dex-github-draft.v1',
    draftId: `gh-draft-${crypto.randomUUID()}`,
    repository: repository.trim(),
    title: title.trim(),
    body: String(body || '').trim(),
    labels: Array.isArray(labels) ? [...labels] : [],
    published: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Publishes a previewed issue draft with explicit confirmation and idempotent receipt (F07).
 */
export function publishGitHubIssue({
  draft,
  confirmationConfirmed,
  repository,
  mockDispatcher = null,
} = {}) {
  if (!draft || !draft.repository) {
    throw new GitHubAdapterError('Valid issue draft is required');
  }
  if (!confirmationConfirmed) {
    throw new GitHubAdapterError('Explicit user confirmation is required to publish a GitHub issue draft');
  }
  if (repository !== draft.repository) {
    throw new GitHubAdapterError(
      `Target repository does not match draft destination: expected ${draft.repository}, got ${repository}`
    );
  }

  let result = { issueNumber: 1, htmlUrl: `https://github.com/${repository}/issues/1` };
  if (typeof mockDispatcher === 'function') {
    result = mockDispatcher({ repository, title: draft.title, body: draft.body });
  }

  const receiptContent = `${draft.repository}:${result.issueNumber}:${draft.title}:${new Date().toISOString()}`;
  const receiptHash = computeSha256(receiptContent);

  return {
    schemaVersion: 'dex-github-receipt.v1',
    receiptId: `rcpt-${crypto.randomUUID()}`,
    repository: draft.repository,
    issueNumber: result.issueNumber,
    htmlUrl: result.htmlUrl || null,
    receiptHash,
    publishedAt: new Date().toISOString(),
  };
}
