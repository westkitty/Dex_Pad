import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleNoteReview,
  postponeNoteReview,
  skipNoteReview,
  getPendingReviews,
  flagDownstreamReviewHints,
  SchedulingError,
} from '../src/core/scheduling.js';

test('1. scheduleNoteReview resurfaces notes at explicit intervals with postpone/skip controls (F19)', () => {
  const schedule = scheduleNoteReview({
    noteId: 'note:quarterly-architecture',
    intervalDays: 30,
    startDate: new Date('2026-10-01T00:00:00.000Z'),
  });

  assert.equal(schedule.schemaVersion, 'dex-schedule.v1');
  assert.equal(schedule.noteId, 'note:quarterly-architecture');
  assert.equal(schedule.intervalDays, 30);
  assert.equal(schedule.nextReviewAt, '2026-10-31T00:00:00.000Z');
  assert.equal(schedule.skippedCount, 0);

  // Postpone by 7 days
  const postponed = postponeNoteReview({ schedule, postponeDays: 7 });
  assert.equal(postponed.nextReviewAt, '2026-11-07T00:00:00.000Z');

  // Skip review interval
  const skipped = skipNoteReview({ schedule: postponed });
  assert.equal(skipped.skippedCount, 1);
  assert.equal(skipped.nextReviewAt, '2026-12-07T00:00:00.000Z');
});

test('2. getPendingReviews returns only items due on or before target date (F19)', () => {
  const schedules = [
    { scheduleId: 's1', noteId: 'note:due-now', nextReviewAt: '2026-10-25T00:00:00.000Z' },
    { scheduleId: 's2', noteId: 'note:due-later', nextReviewAt: '2026-11-15T00:00:00.000Z' },
  ];

  const due = getPendingReviews({ schedules, now: new Date('2026-10-26T00:00:00.000Z') });
  assert.equal(due.length, 1);
  assert.equal(due[0].noteId, 'note:due-now');
});

test('3. flagDownstreamReviewHints flags dependent notes without silently rewriting authoritative content (F20)', () => {
  const notes = [
    { id: 'note:derived-1', title: 'Token Handshake Implementation', body: 'Implemented per [[src:oauth-spec]].', references: [{ id: 'src:oauth-spec' }] },
    { id: 'note:unrelated', title: 'Weekly Standup Notes', body: 'Discussed design sprint.', references: [] },
  ];

  const hints = flagDownstreamReviewHints({
    changedSourceId: 'src:oauth-spec',
    items: notes,
    changeDescription: 'OAuth specification updated with PKCE mandatory requirement',
  });

  assert.equal(hints.length, 1);
  assert.equal(hints[0].targetNoteId, 'note:derived-1');
  assert.equal(hints[0].sourceId, 'src:oauth-spec');
  assert.equal(hints[0].reason, 'UPSTREAM_SOURCE_MODIFIED');
  assert.equal(hints[0].requiresReview, true);

  // Crucial invariant: original note body is unchanged (never silently rewritten)
  assert.equal(notes[0].body, 'Implemented per [[src:oauth-spec]].');
});
