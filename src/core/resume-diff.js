/**
 * Reopen Diff & Event Timeline for DEX//Pad (F18).
 * Analyzes revisions since last visit and separates empirical recorded observations from inferred impact.
 */

export async function getChangesSinceLastVisit({
  store,
  workspace,
  projectId,
  lastVisitUtc,
}) {
  if (!store && !workspace) throw new Error('store or workspace is required');
  if (!projectId) throw new Error('projectId is required');

  const visitTimestamp = lastVisitUtc ? new Date(lastVisitUtc).getTime() : 0;
  const projectItem = workspace
    ? (await workspace.list({ includeDeleted: true })).find(i => i.id === projectId)
    : await store.getItem(projectId);

  const allItems = workspace
    ? await workspace.list({ includeDeleted: true })
    : await store.listItems();

  // Find all items associated with this project (or the project item itself)
  const projectItems = allItems.filter(i => i.id === projectId || i.projectId === projectId);
  const projectItemIds = new Set(projectItems.map(i => i.id));

  // Get events since last visit
  const allEvents = store && store.listEvents ? await store.listEvents() : [];
  const eventsSinceVisit = allEvents.filter(e => {
    const eventTime = new Date(e.at).getTime();
    return eventTime > visitTimestamp && projectItemIds.has(e.itemId);
  });

  // Revisions since last visit
  const revisionsSinceLastVisit = [];
  const recordedObservations = [];

  for (const item of projectItems) {
    const itemUpdateTime = new Date(item.updatedAt).getTime();
    if (itemUpdateTime > visitTimestamp) {
      revisionsSinceLastVisit.push({
        itemId: item.id,
        title: item.title,
        kind: item.kind,
        revision: item.revision,
        updatedAt: item.updatedAt,
        evidence: item.evidence,
      });

      if (item.evidence === 'verified' || item.evidence === 'observed') {
        recordedObservations.push({
          itemId: item.id,
          title: item.title,
          evidence: item.evidence,
          evidenceRef: item.evidenceRef,
          updatedAt: item.updatedAt,
        });
      }
    }
  }

  // Inferred impact summary (synthesized observation vs interpretation)
  const inferredImpact = {
    newRevisionsCount: revisionsSinceLastVisit.length,
    eventsCount: eventsSinceVisit.length,
    summary: `${revisionsSinceLastVisit.length} revision(s) updated since ${lastVisitUtc || 'initial visit'}.`,
  };

  return {
    projectId,
    projectTitle: projectItem?.title || 'Unknown Project',
    latestNextAction: projectItem?.nextAction || null,
    currentBlocker: projectItem?.blocker || null,
    repoUrl: projectItem?.repoUrl || null,
    lastVisitUtc,
    revisionsSinceLastVisit,
    recordedObservations,
    inferredImpact,
  };
}
