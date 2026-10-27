const KINDS = new Set(['note', 'project', 'decision', 'contribution', 'incident', 'commitment']);
const EVIDENCE = new Set(['proposed', 'claimed', 'observed', 'verified', 'stale']);
const MUTABLE = new Set([
  'kind', 'title', 'body', 'tags', 'projectId', 'evidence', 'evidenceRef',
  'nextAction', 'blocker', 'repoUrl',
  'rationale', 'alternatives', 'supersededBy', 'supersedes', 'reviewDate',
  'failureDescription', 'reproductionSteps', 'confirmedRepair', 'regressionProof',
  'owner', 'expectedOutcome', 'status',
]);

function fail(message) { throw new Error(message); }
function str(value, name, max) {
  if (typeof value !== 'string') fail(`${name} must be text`);
  if (value.length > max) fail(`${name} is too long`);
  return value;
}
function optStr(value, name, max) {
  if (value === undefined || value === null) return null;
  return str(value, name, max);
}
function normalize(input) {
  const kind = input.kind ?? 'note';
  if (!KINDS.has(kind)) fail('Unsupported item kind');
  const evidence = input.evidence ?? 'proposed';
  if (!EVIDENCE.has(evidence)) fail('Unsupported evidence state');
  const evidenceRef = str(input.evidenceRef ?? '', 'Evidence reference', 500).trim();
  if (evidence === 'verified' && !evidenceRef) fail('Verified evidence requires an evidence reference');
  const tags = input.tags ?? [];
  if (!Array.isArray(tags) || tags.length > 16 || tags.some(t => typeof t !== 'string' || t.length > 32)) fail('Invalid tags');
  const projectId = input.projectId ?? null;
  if (projectId !== null && (typeof projectId !== 'string' || projectId.length > 120)) fail('Invalid project reference');
  const provenance = input.provenance ?? { origin: 'human' };
  if (!provenance || typeof provenance !== 'object' || !['human', 'external-simulation', 'import', 'derived'].includes(provenance.origin)) fail('Invalid provenance');

  const alternatives = input.alternatives ?? [];
  if (!Array.isArray(alternatives) || alternatives.some(a => typeof a !== 'string' || a.length > 500)) fail('Invalid alternatives');

  return {
    kind,
    title: str(input.title ?? '', 'Title', 180),
    body: str(input.body ?? '', 'Body', 100_000),
    tags: [...new Set(tags.map(t => t.trim()).filter(Boolean))],
    projectId,
    evidence,
    evidenceRef,
    nextAction: str(input.nextAction ?? '', 'Next action', 500),
    blocker: str(input.blocker ?? '', 'Blocker', 500),
    repoUrl: str(input.repoUrl ?? '', 'Repository link', 500),
    provenance: structuredClone(provenance),
    // Decision Memory (F03)
    rationale: optStr(input.rationale, 'rationale', 5_000),
    alternatives: structuredClone(alternatives),
    supersededBy: optStr(input.supersededBy, 'supersededBy', 120),
    supersedes: optStr(input.supersedes, 'supersedes', 120),
    reviewDate: optStr(input.reviewDate, 'reviewDate', 64),
    // Incident Cards (F05)
    failureDescription: optStr(input.failureDescription, 'failureDescription', 10_000),
    reproductionSteps: optStr(input.reproductionSteps, 'reproductionSteps', 10_000),
    confirmedRepair: optStr(input.confirmedRepair, 'confirmedRepair', 10_000),
    regressionProof: optStr(input.regressionProof, 'regressionProof', 2_000),
    // Commitments (F08)
    owner: optStr(input.owner, 'owner', 120),
    expectedOutcome: optStr(input.expectedOutcome, 'expectedOutcome', 5_000),
    status: optStr(input.status, 'status', 64),
  };
}

export function createWorkspace(store, { now = () => new Date().toISOString(), id = () => crypto.randomUUID() } = {}) {
  const recordEvent = (item, action) => ({ id: `${item.id}:${item.revision}`, itemId: item.id, kind: item.kind, revision: item.revision, action, at: item.updatedAt });
  async function create(raw = {}, { fixedId } = {}) {
    const stamp = now();
    const item = {
      schemaVersion: '0-dev', id: fixedId ?? id(), ...normalize(raw),
      revision: 1, createdAt: stamp, updatedAt: stamp, deletedAt: null,
    };
    return store.commit(item, recordEvent(item, 'created'));
  }
  async function mutate(itemId, expectedRevision, modify, action) {
    const previous = await store.getItem(itemId);
    if (!previous) fail('Item not found');
    if (!Number.isInteger(expectedRevision) || previous.revision !== expectedRevision) fail('Stale revision: reload before editing');
    const next = modify(structuredClone(previous));
    next.updatedAt = now();
    next.revision = previous.revision + 1;
    return store.commit(next, recordEvent(next, action));
  }
  async function update(itemId, patch, expectedRevision) {
    if (!patch || typeof patch !== 'object' || Object.keys(patch).some(key => !MUTABLE.has(key))) fail('Unsupported update fields');
    return mutate(itemId, expectedRevision, (previous) => {
      if (previous.deletedAt) fail('Cannot edit a deleted item');
      return { ...previous, ...normalize({ ...previous, ...patch }), id: previous.id };
    }, 'updated');
  }
  async function remove(itemId, expectedRevision) {
    return mutate(itemId, expectedRevision, (item) => {
      if (item.deletedAt) fail('Already deleted');
      item.deletedAt = now();
      return item;
    }, 'deleted');
  }
  async function restore(itemId, sourceRevision, expectedRevision) {
    const revisions = await store.listRevisions(itemId);
    const selected = revisions.find(r => r.revision === sourceRevision);
    if (!selected) fail('Revision not found');
    return mutate(itemId, expectedRevision, (previous) => ({
      ...previous, ...normalize(selected), deletedAt: null,
      provenance: structuredClone(previous.provenance),
    }), 'restored');
  }
  async function list({ query = '', kind = '', includeDeleted = false } = {}) {
    const all = await store.listItems();
    const q = query.toLowerCase().trim();
    return all.filter(item => {
      if (!includeDeleted && item.deletedAt) return false;
      if (kind && item.kind !== kind) return false;
      return !q || [item.title, item.body, item.nextAction, item.blocker, ...(item.tags ?? [])].some(s => s.toLowerCase().includes(q));
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
  }
  async function exportData() {
    const items = await store.listItems();
    const groups = await Promise.all(items.map(item => store.listRevisions(item.id)));
    return { schemaVersion: '0-dev', unencrypted: true, exportedAt: now(), items, revisions: groups.flat(), events: await store.listEvents() };
  }
  async function submitContribution({ requestId, title = '', body = '' }) {
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,72}$/.test(requestId)) fail('Invalid request id');
    const existingId = `contribution:${requestId}`;
    const existing = await store.getItem(existingId);
    if (existing) {
      if (existing.title !== title || existing.body !== body) fail('Idempotency conflict: request id already used');
      return { receiptId: requestId, state: 'saved-locally' };
    }
    try {
      await create({ kind: 'contribution', title, body, provenance: { origin: 'external-simulation' } }, { fixedId: existingId });
    } catch (error) {
      // Handle a concurrent duplicate only after checking the actual committed record.
      const concurrent = await store.getItem(existingId);
      if (!concurrent || concurrent.title !== title || concurrent.body !== body) throw error;
    }
    return { receiptId: requestId, state: 'saved-locally' };
  }
  return { create, update, remove, restore, list, history: (itemId) => store.listRevisions(itemId), activity: () => store.listEvents(), exportData, submitContribution };
}
