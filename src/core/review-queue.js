export class ReviewQueueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReviewQueueError';
  }
}

export class WatcherDisabledError extends ReviewQueueError {
  constructor(message = 'Watcher is disabled') {
    super(message);
    this.name = 'WatcherDisabledError';
  }
}

function tokenize(text) {
  if (typeof text !== 'string') return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Detects potential duplicate or contradictory items without auto-merging (F15).
 * Crucial invariant: Potential duplicates and mismatches are presented with source
 * provenance and never auto-merged or deleted.
 */
export function detectCandidateDuplicates({ items = [], threshold = 0.6 } = {}) {
  const candidates = [];
  const tokenized = items.map(item => ({
    id: item.id,
    title: item.title,
    tokens: tokenize(`${item.title || ''} ${item.body || ''} ${(item.tags || []).join(' ')}`),
  }));

  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const a = tokenized[i];
      const b = tokenized[j];
      const score = jaccardSimilarity(a.tokens, b.tokens);

      if (score >= threshold) {
        candidates.push({
          candidateId: `cand-${crypto.randomUUID().slice(0, 8)}`,
          itemAId: a.id,
          itemBId: b.id,
          similarityScore: Number(score.toFixed(4)),
          autoMerged: false,
        });
      }
    }
  }

  return candidates;
}

/**
 * Creates a human review candidate capturing source provenance for conflicting records (F15).
 */
export function createReviewCandidate({
  candidateId,
  type = 'DUPLICATE',
  itemIds = [],
  rationale = '',
  sources = [],
} = {}) {
  if (!Array.isArray(itemIds) || itemIds.length < 2) {
    throw new ReviewQueueError('Review candidate requires at least two conflicting item IDs');
  }

  return {
    schemaVersion: 'dex-review-candidate.v1',
    candidateId: candidateId || `rev-cand-${crypto.randomUUID()}`,
    type,
    itemIds: [...itemIds],
    rationale: String(rationale || ''),
    sources: [...sources],
    status: 'PENDING_HUMAN_REVIEW',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Resolves a review candidate with explicit user authority.
 * Strictly forbids silent auto-deletion or destructive auto-merge.
 */
export function resolveReviewCandidate({
  candidate,
  resolution,
  preferredItemId = null,
  notes = '',
} = {}) {
  if (!candidate || !candidate.candidateId) {
    throw new ReviewQueueError('Valid candidate is required');
  }

  const validResolutions = new Set(['KEEP_BOTH', 'MARK_SUPERSEDED', 'DISMISS']);
  if (!validResolutions.has(resolution)) {
    throw new ReviewQueueError(
      'Silent auto-delete or automatic merge is prohibited: potential duplicates must be presented with source provenance and human recovery'
    );
  }

  return {
    ...candidate,
    status: 'RESOLVED',
    resolution,
    preferredItemId,
    notes: String(notes || ''),
    resolvedAt: new Date().toISOString(),
  };
}

/**
 * Creates an authorized source watcher (F16).
 */
export function createSourceWatcher({
  sourceId,
  watcherId,
  authToken,
  config = {},
} = {}) {
  if (!sourceId || typeof sourceId !== 'string') {
    throw new ReviewQueueError('sourceId is required');
  }
  if (!watcherId || typeof watcherId !== 'string') {
    throw new ReviewQueueError('watcherId is required');
  }
  if (!authToken || typeof authToken !== 'string') {
    throw new ReviewQueueError('authToken is required');
  }

  return {
    schemaVersion: 'dex-watcher.v1',
    sourceId: sourceId.trim(),
    watcherId: watcherId.trim(),
    authToken,
    config: structuredClone(config),
    enabled: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Submits an authorized change receipt from an approved watcher (F16).
 */
export function submitWatcherReceipt({
  watcher,
  changeEvent = {},
  authToken,
} = {}) {
  if (!watcher || !watcher.watcherId) {
    throw new ReviewQueueError('Valid watcher is required');
  }
  if (!watcher.enabled) {
    throw new WatcherDisabledError('Watcher is disabled: no changes can be submitted');
  }
  if (authToken !== watcher.authToken) {
    throw new ReviewQueueError('Unauthorized watcher receipt submission: invalid auth token');
  }

  return {
    schemaVersion: 'dex-watcher-receipt.v1',
    receiptId: `rcpt-${crypto.randomUUID()}`,
    watcherId: watcher.watcherId,
    sourceId: watcher.sourceId,
    stage: 'CHANGE_SUBMITTED',
    action: changeEvent.action || 'UPDATE',
    changeHash: changeEvent.changeHash || '0'.repeat(64),
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Disables a source watcher while leaving capture and search intact (F16).
 */
export function disableSourceWatcher(watcher) {
  if (!watcher || !watcher.watcherId) {
    throw new ReviewQueueError('Valid watcher is required');
  }
  return {
    ...watcher,
    enabled: false,
    disabledAt: new Date().toISOString(),
  };
}
