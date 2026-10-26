export class SchedulingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SchedulingError';
  }
}

/**
 * Creates an explicit note review resurfacing schedule (F19).
 * Crucial invariant: Resurfaces at an explicit interval with skip/postpone
 * controls and no compulsive notification loops.
 */
export function scheduleNoteReview({
  noteId,
  intervalDays = 7,
  startDate = new Date(),
} = {}) {
  if (!noteId || typeof noteId !== 'string') {
    throw new SchedulingError('noteId is required');
  }
  if (typeof intervalDays !== 'number' || intervalDays <= 0) {
    throw new SchedulingError('intervalDays must be a positive number');
  }

  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const nextReviewMs = start.getTime() + intervalDays * 24 * 60 * 60 * 1000;

  return {
    schemaVersion: 'dex-schedule.v1',
    scheduleId: `sch-${crypto.randomUUID()}`,
    noteId: noteId.trim(),
    intervalDays,
    nextReviewAt: new Date(nextReviewMs).toISOString(),
    skippedCount: 0,
    postponedCount: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Postpones a scheduled note review by an explicit number of days (F19).
 */
export function postponeNoteReview({ schedule, postponeDays = 7 } = {}) {
  if (!schedule || !schedule.nextReviewAt) {
    throw new SchedulingError('Valid schedule is required');
  }

  const current = new Date(schedule.nextReviewAt);
  const nextMs = current.getTime() + postponeDays * 24 * 60 * 60 * 1000;

  return {
    ...schedule,
    nextReviewAt: new Date(nextMs).toISOString(),
    postponedCount: (schedule.postponedCount || 0) + 1,
  };
}

/**
 * Skips the current review interval, advancing to the next cycle (F19).
 */
export function skipNoteReview({ schedule } = {}) {
  if (!schedule || !schedule.nextReviewAt) {
    throw new SchedulingError('Valid schedule is required');
  }

  const current = new Date(schedule.nextReviewAt);
  const nextMs = current.getTime() + (schedule.intervalDays || 7) * 24 * 60 * 60 * 1000;

  return {
    ...schedule,
    nextReviewAt: new Date(nextMs).toISOString(),
    skippedCount: (schedule.skippedCount || 0) + 1,
  };
}

/**
 * Retrieves all scheduled reviews due on or before target date (F19).
 */
export function getPendingReviews({ schedules = [], now = new Date() } = {}) {
  const currentDate = now instanceof Date ? now : new Date(now);

  return schedules.filter(s => {
    if (!s || !s.nextReviewAt) return false;
    const reviewDate = new Date(s.nextReviewAt);
    return !Number.isNaN(reviewDate.getTime()) && reviewDate <= currentDate;
  });
}

/**
 * Flags downstream notes for review when an upstream source changes (F20).
 * Crucial invariant: Flags dependent notes for review without silently
 * rewriting authoritative material.
 */
export function flagDownstreamReviewHints({
  changedSourceId,
  items = [],
  changeDescription = '',
} = {}) {
  if (!changedSourceId || typeof changedSourceId !== 'string') {
    throw new SchedulingError('changedSourceId is required');
  }

  const cleanSourceId = changedSourceId.trim();
  const hints = [];

  for (const item of items) {
    if (!item || !item.id) continue;

    let isDependent = false;

    // 1. Explicit references array
    if (Array.isArray(item.references)) {
      isDependent = item.references.some(r => r && (r.id === cleanSourceId || r.sourceId === cleanSourceId));
    }

    // 2. Wikilinks in markdown body
    if (!isDependent && typeof item.body === 'string') {
      isDependent = item.body.includes(`[[${cleanSourceId}]]`);
    }

    // 3. Evidence reference
    if (!isDependent && item.evidenceRef === cleanSourceId) {
      isDependent = true;
    }

    if (isDependent) {
      hints.push({
        hintId: `hint-${crypto.randomUUID()}`,
        targetNoteId: item.id,
        targetTitle: item.title || 'Untitled',
        sourceId: cleanSourceId,
        reason: 'UPSTREAM_SOURCE_MODIFIED',
        requiresReview: true,
        changeDescription: String(changeDescription || 'Upstream source was updated').trim(),
        flaggedAt: new Date().toISOString(),
      });
    }
  }

  return hints;
}
