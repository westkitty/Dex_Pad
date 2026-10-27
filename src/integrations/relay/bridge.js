import { validateRelayEvent, RelayError } from './validator.js';

export { RelayError, validateRelayEvent };

export function createRelayBridge({ store, workspace, enabled = true } = {}) {
  if (!store) throw new Error('store is required');
  if (!workspace) throw new Error('workspace is required');

  async function ingestEvent(projectId, rawEvent) {
    if (!enabled) {
      throw new RelayError('Bridge disabled: relay event ingestion is inactive');
    }

    if (!projectId || typeof projectId !== 'string') {
      throw new RelayError('Project not found: explicit projectId is required');
    }

    // Verify project exists in workspace
    const items = await workspace.list({ kind: 'project', includeDeleted: true });
    const project = items.find(item => item.id === projectId);
    if (!project) {
      throw new RelayError(`Project not found: no project exists with id ${projectId}`);
    }

    // Validate and sanitize event
    const validated = validateRelayEvent(rawEvent);

    // Check for existing event with same eventId
    const existingKey = `relay-event:${validated.eventId}`;
    const existing = await store.getItem(existingKey);
    if (existing) {
      const isIdentical =
        existing.eventHash === validated.eventHash &&
        existing.action === validated.action &&
        existing.stage === validated.stage &&
        existing.idempotencyKey === validated.idempotencyKey &&
        existing.projectId === projectId;

      if (isIdentical) {
        return { ...existing, idempotentDuplicate: true };
      }
      throw new RelayError(`Idempotency conflict: event id ${validated.eventId} already used with conflicting payload`);
    }

    // Check sequence chain for this task within this project
    const allItems = await store.listItems();
    const taskEvents = allItems
      .filter(item => item.kind === 'relay-event' && item.projectId === projectId && item.taskId === validated.taskId)
      .sort((a, b) => a.sequence - b.sequence);

    let streamIntegrity = 'VALID';
    let isCompleteStream = true;

    if (validated.sequence === 1) {
      streamIntegrity = 'VALID';
      isCompleteStream = true;
    } else {
      const predecessor = taskEvents.find(e => e.sequence === validated.sequence - 1);
      if (!predecessor) {
        streamIntegrity = 'MISSING_PREDECESSOR';
        isCompleteStream = false;
      } else if (predecessor.eventHash !== validated.previousEventHash) {
        streamIntegrity = 'HASH_CHAIN_MISMATCH';
        isCompleteStream = false;
      } else {
        streamIntegrity = 'VALID';
        isCompleteStream = true;
      }
    }

    // Determine verification status
    // A claim from the source node (even VERIFICATION_PASSED) is NOT independent local proof.
    let verificationStatus = 'CLAIMED';
    let trustedProof = false;

    if (validated.action === 'VERIFICATION_PASSED' || validated.stage === 'VERIFIED') {
      verificationStatus = 'UNVERIFIED_CLAIM';
      trustedProof = false;
    } else if (validated.action === 'BLOCKED' || validated.stage === 'BLOCKED') {
      verificationStatus = 'BLOCKED';
    } else if (validated.action === 'MARK_AMBIGUOUS' || validated.stage === 'AMBIGUOUS') {
      verificationStatus = 'AMBIGUOUS';
    } else if (validated.receiptHash) {
      verificationStatus = 'EVIDENCE_REFERENCED';
    }

    const stamp = new Date().toISOString();
    const record = {
      id: existingKey,
      kind: 'relay-event',
      schemaVersion: validated.schemaVersion,
      eventId: validated.eventId,
      projectId,
      taskId: validated.taskId,
      correlationId: validated.correlationId,
      sourceNodeId: validated.sourceNodeId,
      targetNodeId: validated.targetNodeId,
      idempotencyKey: validated.idempotencyKey,
      sequence: validated.sequence,
      previousEventHash: validated.previousEventHash,
      eventHash: validated.eventHash,
      receiptHash: validated.receiptHash,
      resultHash: validated.resultHash,
      action: validated.action,
      stage: validated.stage,
      atUtc: validated.atUtc,
      payload: validated.payload,
      streamIntegrity,
      isCompleteStream,
      isAmbiguous: validated.stage === 'AMBIGUOUS' || validated.action === 'MARK_AMBIGUOUS',
      isBlocked: validated.stage === 'BLOCKED' || validated.action === 'BLOCKED',
      verificationStatus,
      trustedProof,
      revision: 1,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };

    const auditEvent = {
      id: `${record.id}:1`,
      itemId: record.id,
      kind: 'relay-event',
      revision: 1,
      action: 'ingested',
      at: stamp,
    };

    return store.commit(record, auditEvent);
  }

  async function getProjectTimeline(projectId) {
    if (!projectId) return [];
    const allItems = await store.listItems();
    return allItems
      .filter(item => item.kind === 'relay-event' && item.projectId === projectId)
      .sort((a, b) => a.atUtc.localeCompare(b.atUtc) || a.sequence - b.sequence);
  }

  return {
    ingestEvent,
    getProjectTimeline,
    isEnabled() { return enabled; },
  };
}
