export class ReadingRadarError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReadingRadarError';
  }
}

/**
 * Evaluates evidence freshness against configured expiry dates and source revision drift (F14).
 * Crucial invariant: A source-linked claim becomes needs-review on expiry or drift,
 * never silently false or true.
 */
export function evaluateEvidenceFreshness({ record, source, now = new Date() } = {}) {
  if (!record || typeof record !== 'object') {
    throw new ReadingRadarError('Valid record is required');
  }

  const currentDate = now instanceof Date ? now : new Date(now);

  // 1. Check expiration date rule
  if (record.expiresAt) {
    const expiryDate = new Date(record.expiresAt);
    if (!Number.isNaN(expiryDate.getTime()) && expiryDate <= currentDate) {
      return {
        freshness: 'NEEDS_REVIEW',
        needsReview: true,
        reason: 'EXPIRED',
        details: `Claim expired on ${record.expiresAt}; requires human verification review.`,
      };
    }
  }

  // 2. Check source revision drift rule
  if (record.sourceHash && source && source.fileHash) {
    if (record.sourceHash !== source.fileHash) {
      return {
        freshness: 'NEEDS_REVIEW',
        needsReview: true,
        reason: 'SOURCE_UPDATED',
        details: `Source revision drift detected: recorded hash ${record.sourceHash.slice(0, 12)}… does not match current source hash ${source.fileHash.slice(0, 12)}….`,
      };
    }
  }

  return {
    freshness: 'CURRENT',
    needsReview: false,
    reason: 'IN_FORCE',
    details: 'Claim evidence is current and within active review window.',
  };
}

/**
 * Creates a project-scoped Reading Radar instance (F17).
 * Strictly bounds feeds to one project context without creating a compulsory global reader.
 */
export function createProjectRadar({ projectId, feeds = [] } = {}) {
  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    throw new ReadingRadarError('projectId is required');
  }

  const cleanFeeds = Array.isArray(feeds)
    ? feeds.map(f => ({
        uri: String(f.uri || '').trim(),
        label: String(f.label || f.uri || '').trim(),
      })).filter(f => Boolean(f.uri))
    : [];

  return {
    schemaVersion: 'dex-radar.v1',
    radarId: `rdr-${crypto.randomUUID()}`,
    projectId: projectId.trim(),
    feeds: cleanFeeds,
    items: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Idempotently ingests feed entries into a project radar (F17).
 */
export function digestFeedItems({ radar, feedUri, items = [] } = {}) {
  if (!radar || typeof radar !== 'object' || !radar.radarId) {
    throw new ReadingRadarError('Valid radar instance is required');
  }

  const existingMap = new Map();
  for (const item of radar.items || []) {
    const key = item.id || item.uri;
    if (key) existingMap.set(key, item);
  }

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const key = raw.id || raw.uri;
    if (!key) continue;

    if (!existingMap.has(key)) {
      existingMap.set(key, {
        id: String(raw.id || `entry-${crypto.randomUUID()}`),
        feedUri: String(feedUri || ''),
        title: String(raw.title || 'Untitled Entry').trim(),
        uri: String(raw.uri || '').trim(),
        summary: String(raw.summary || '').trim(),
        publishedAt: raw.publishedAt || new Date().toISOString(),
        read: Boolean(raw.read),
        starred: Boolean(raw.starred),
        ingestedAt: new Date().toISOString(),
      });
    }
  }

  return {
    ...radar,
    items: Array.from(existingMap.values()),
  };
}

/**
 * Summarizes active feeds, unread items, and radar statistics for project resume (F17).
 */
export function getProjectRadarDigest(radar) {
  if (!radar || typeof radar !== 'object') {
    throw new ReadingRadarError('Valid radar instance is required');
  }

  const items = radar.items || [];
  const unreadCount = items.filter(i => !i.read).length;

  return {
    projectId: radar.projectId,
    totalItems: items.length,
    unreadCount,
    activeFeedsCount: (radar.feeds || []).length,
    items: [...items],
  };
}
