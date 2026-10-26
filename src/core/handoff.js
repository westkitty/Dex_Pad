export class HandoffError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HandoffError';
  }
}

/**
 * Creates a bounded, portable One-Tap Agent Handoff packet (F06).
 * Strictly bounds exported context to user-selected items without leaking the vault.
 */
export async function createHandoffPacket({
  workspace,
  selectedItemIds = [],
  constraints = [],
  purpose = 'agent-task-context',
}) {
  if (!workspace) throw new HandoffError('workspace is required');
  if (!Array.isArray(selectedItemIds) || selectedItemIds.length === 0) {
    throw new HandoffError('Selection cannot be empty: at least one item must be chosen for handoff');
  }

  const allItems = await workspace.list({ includeDeleted: true });
  const itemsMap = new Map(allItems.map(i => [i.id, i]));

  const selectedItems = [];
  const evidenceSummary = { proposed: 0, claimed: 0, observed: 0, verified: 0, stale: 0 };

  for (const id of selectedItemIds) {
    const item = itemsMap.get(id);
    if (!item) continue;
    selectedItems.push({
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
      evidence: item.evidence,
      evidenceRef: item.evidenceRef,
      tags: item.tags || [],
      projectId: item.projectId || null,
      nextAction: item.nextAction || null,
      blocker: item.blocker || null,
      repoUrl: item.repoUrl || null,
      revision: item.revision,
      updatedAt: item.updatedAt,
      provenance: item.provenance || { origin: 'human' },
    });

    if (evidenceSummary[item.evidence] !== undefined) {
      evidenceSummary[item.evidence]++;
    }
  }

  return {
    schemaVersion: 'dex-handoff.v1',
    handoffId: `hnd-${crypto.randomUUID()}`,
    purpose,
    createdAt: new Date().toISOString(),
    constraints: [...constraints],
    selectedItemsCount: selectedItems.length,
    evidenceSummary,
    selectedItems,
  };
}
