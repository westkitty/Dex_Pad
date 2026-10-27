export class SemanticIndexError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SemanticIndexError';
  }
}

function extractTerms(text) {
  if (typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

/**
 * Builds an in-memory local semantic retrieval index from authorized items (C20).
 * Invariant: Completely local, zero cloud API calls, zero external data leakage.
 */
export function buildLocalSemanticIndex({ items = [] } = {}) {
  if (!Array.isArray(items)) {
    throw new SemanticIndexError('items must be an array');
  }

  const invertedIndex = new Map();
  const itemTermCounts = new Map();
  const itemTitles = new Map();

  for (const item of items) {
    if (!item || !item.id) continue;
    const content = `${item.title || ''} ${item.body || ''}`;
    const terms = extractTerms(content);
    const counts = new Map();

    for (const t of terms) {
      counts.set(t, (counts.get(t) || 0) + 1);

      if (!invertedIndex.has(t)) {
        invertedIndex.set(t, new Map());
      }
      const postings = invertedIndex.get(t);
      postings.set(item.id, (postings.get(item.id) || 0) + 1);
    }

    itemTermCounts.set(item.id, { totalTerms: terms.length, termFrequencies: counts });
    itemTitles.set(item.id, item.title || 'Untitled');
  }

  return {
    schemaVersion: 'dex-semantic-index.v1',
    indexId: `idx-${crypto.randomUUID()}`,
    indexedItemCount: itemTermCounts.size,
    termsCount: invertedIndex.size,
    invertedIndex,
    itemTermCounts,
    itemTitles,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Queries the local index with ranked BM25/TF-IDF relevance scores (C20).
 */
export function querySemanticIndex({ index, query, topK = 5 } = {}) {
  if (!index || !index.invertedIndex) {
    throw new SemanticIndexError('Valid semantic index is required');
  }
  if (!query || typeof query !== 'string') {
    return [];
  }

  const queryTerms = extractTerms(query);
  if (queryTerms.length === 0) return [];

  const scores = new Map();
  const totalDocs = index.indexedItemCount || 1;

  for (const term of queryTerms) {
    const postings = index.invertedIndex.get(term);
    if (!postings) continue;

    const docFreq = postings.size;
    const idf = Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5));

    for (const [itemId, freq] of postings) {
      const docStats = index.itemTermCounts.get(itemId);
      const tf = freq / (docStats?.totalTerms || 1);
      const score = tf * idf;
      scores.set(itemId, (scores.get(itemId) || 0) + score);
    }
  }

  return Array.from(scores.entries())
    .map(([itemId, score]) => ({
      itemId,
      title: index.itemTitles.get(itemId) || 'Untitled',
      score: Number(score.toFixed(4)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Completely purges and deletes the local semantic index without endangering notes (C20).
 */
export function deleteSemanticIndex(index) {
  if (index && index.invertedIndex) {
    index.invertedIndex.clear();
    index.itemTermCounts.clear();
    index.itemTitles.clear();
  }

  return {
    schemaVersion: 'dex-semantic-index.v1',
    indexId: null,
    indexedItemCount: 0,
    termsCount: 0,
    deleted: true,
    deletedAt: new Date().toISOString(),
  };
}
