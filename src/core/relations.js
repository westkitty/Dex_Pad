/**
 * Knowledge Graph & Relations Engine for DEX//Pad (C11).
 * Extracts forward links, indexes incoming backlinks, and detects broken targets.
 */

const WIKILINK_REGEX = /\[\[([a-zA-Z0-9_\-.:#]+)\]\]/g;

/**
 * Extracts all referenced target IDs from an item's body and structured relation fields.
 */
export function extractItemReferences(item) {
  if (!item || typeof item !== 'object') return [];

  const refs = [];
  const seenTargets = new Set();

  function addRef(targetId, relation, sourceField) {
    if (!targetId || typeof targetId !== 'string') return;
    const cleanId = targetId.trim();
    if (!cleanId || seenTargets.has(cleanId)) return;
    seenTargets.add(cleanId);
    refs.push({ targetId: cleanId, relation, sourceField });
  }

  // 1. Wikilinks in markdown body: [[target-id]]
  if (typeof item.body === 'string') {
    const matches = item.body.matchAll(WIKILINK_REGEX);
    for (const match of matches) {
      if (match[1]) {
        addRef(match[1], 'wikilink', 'body');
      }
    }
  }

  // 2. Structured project association
  if (item.projectId) {
    addRef(item.projectId, 'project', 'projectId');
  }

  // 3. Decision Memory relationships (F03)
  if (item.supersededBy) {
    addRef(item.supersededBy, 'supersededBy', 'supersededBy');
  }
  if (item.supersedes) {
    addRef(item.supersedes, 'supersedes', 'supersedes');
  }

  // 4. Explicit references array
  if (Array.isArray(item.references)) {
    for (const r of item.references) {
      if (r && typeof r === 'object' && r.id) {
        addRef(r.id, r.relation || 'related', 'references');
      }
    }
  }

  return refs;
}

/**
 * Builds an in-memory knowledge graph over a collection of workspace items.
 */
export function buildKnowledgeGraph(items = []) {
  const itemsMap = new Map();
  const outgoingMap = new Map();
  const backlinksMap = new Map();

  for (const item of items) {
    if (item && item.id) {
      itemsMap.set(item.id, item);
      outgoingMap.set(item.id, []);
      backlinksMap.set(item.id, []);
    }
  }

  for (const item of items) {
    if (!item || !item.id) continue;

    const refs = extractItemReferences(item);
    const outgoingList = [];

    for (const ref of refs) {
      const targetItem = itemsMap.get(ref.targetId);
      const isBroken = !targetItem || Boolean(targetItem.deletedAt);

      const linkDetail = {
        targetId: ref.targetId,
        targetTitle: targetItem?.title ?? null,
        targetKind: targetItem?.kind ?? null,
        relation: ref.relation,
        sourceField: ref.sourceField,
        brokenTarget: isBroken,
      };

      outgoingList.push(linkDetail);

      // Register incoming backlink on target
      if (!backlinksMap.has(ref.targetId)) {
        backlinksMap.set(ref.targetId, []);
      }
      backlinksMap.get(ref.targetId).push({
        sourceId: item.id,
        sourceTitle: item.title,
        sourceKind: item.kind,
        relation: ref.relation,
        brokenTarget: Boolean(item.deletedAt),
      });
    }

    outgoingMap.set(item.id, outgoingList);
  }

  return {
    itemsMap,
    outgoingMap,
    backlinksMap,
  };
}

/**
 * Retrieves all incoming backlinks pointing to a specific item.
 */
export function getBacklinksForItem({ graph, itemId }) {
  if (!graph || !graph.backlinksMap || !itemId) return [];
  return graph.backlinksMap.get(itemId) || [];
}

/**
 * Retrieves all outgoing links from a specific item.
 */
export function getOutgoingLinksForItem({ graph, itemId }) {
  if (!graph || !graph.outgoingMap || !itemId) return [];
  return graph.outgoingMap.get(itemId) || [];
}
