import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEvidenceFreshness,
  createProjectRadar,
  digestFeedItems,
  getProjectRadarDigest,
  ReadingRadarError,
} from '../src/core/radar.js';

test('1. evaluateEvidenceFreshness marks claim as CURRENT when within expiry and source unchanged (F14)', () => {
  const record = {
    id: 'note:audit-finding',
    title: 'Audit Finding Note',
    evidence: 'verified',
    evidenceRef: 'src:audit-v1',
    sourceHash: 'a'.repeat(64),
    expiresAt: '2026-12-31T00:00:00.000Z',
  };

  const source = {
    sourceId: 'src:audit-v1',
    fileHash: 'a'.repeat(64),
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const result = evaluateEvidenceFreshness({
    record,
    source,
    now: new Date('2026-10-26T12:00:00.000Z'),
  });

  assert.equal(result.freshness, 'CURRENT');
  assert.equal(result.needsReview, false);
});

test('2. evaluateEvidenceFreshness marks claim as NEEDS_REVIEW on expiry (not silently false/true) (F14)', () => {
  const record = {
    id: 'note:old-policy',
    title: 'Policy Note',
    evidence: 'verified',
    evidenceRef: 'src:policy-v1',
    sourceHash: 'b'.repeat(64),
    expiresAt: '2026-10-01T00:00:00.000Z', // Expired
  };

  const source = {
    sourceId: 'src:policy-v1',
    fileHash: 'b'.repeat(64),
  };

  const result = evaluateEvidenceFreshness({
    record,
    source,
    now: new Date('2026-10-26T12:00:00.000Z'),
  });

  assert.equal(result.freshness, 'NEEDS_REVIEW');
  assert.equal(result.needsReview, true);
  assert.equal(result.reason, 'EXPIRED');
  assert.ok(result.details.includes('expired on'));
});

test('3. evaluateEvidenceFreshness marks claim as NEEDS_REVIEW on source revision drift (F14)', () => {
  const record = {
    id: 'decision:arch-choice',
    title: 'Architecture Decision',
    evidence: 'verified',
    evidenceRef: 'src:spec-v1',
    sourceHash: 'c'.repeat(64), // Original hash
    expiresAt: '2027-01-01T00:00:00.000Z',
  };

  const source = {
    sourceId: 'src:spec-v1',
    fileHash: 'd'.repeat(64), // Modified hash (drifted)
    updatedAt: '2026-10-25T00:00:00.000Z',
  };

  const result = evaluateEvidenceFreshness({
    record,
    source,
    now: new Date('2026-10-26T12:00:00.000Z'),
  });

  assert.equal(result.freshness, 'NEEDS_REVIEW');
  assert.equal(result.needsReview, true);
  assert.equal(result.reason, 'SOURCE_UPDATED');
  assert.ok(result.details.includes('Source revision drift'));
});

test('4. createProjectRadar binds feeds strictly to a project context (F17)', () => {
  const radar = createProjectRadar({
    projectId: 'project:dex-pad',
    feeds: [
      { uri: 'https://news.ycombinator.com/rss', label: 'Hacker News RSS' },
      { uri: 'https://github.com/westkitty/Dex_Pad/releases.atom', label: 'GitHub Releases' },
    ],
  });

  assert.equal(radar.schemaVersion, 'dex-radar.v1');
  assert.equal(radar.projectId, 'project:dex-pad');
  assert.equal(radar.feeds.length, 2);
  assert.deepEqual(radar.items, []);
});

test('5. digestFeedItems idempotently ingests items, deduplicates, and tracks digest stats (F17)', () => {
  let radar = createProjectRadar({
    projectId: 'project:dex-pad',
    feeds: [{ uri: 'https://example.org/feed.xml', label: 'Updates' }],
  });

  const feedBatch1 = [
    { id: 'entry-1', title: 'Release 0.1', uri: 'https://example.org/1', publishedAt: '2026-10-20' },
    { id: 'entry-2', title: 'Release 0.2', uri: 'https://example.org/2', publishedAt: '2026-10-25' },
  ];

  radar = digestFeedItems({ radar, feedUri: 'https://example.org/feed.xml', items: feedBatch1 });
  assert.equal(radar.items.length, 2);

  // Re-ingest duplicate and one new item
  const feedBatch2 = [
    { id: 'entry-2', title: 'Release 0.2 (repeat)', uri: 'https://example.org/2', publishedAt: '2026-10-25' },
    { id: 'entry-3', title: 'Release 0.3', uri: 'https://example.org/3', publishedAt: '2026-10-26' },
  ];

  radar = digestFeedItems({ radar, feedUri: 'https://example.org/feed.xml', items: feedBatch2 });
  assert.equal(radar.items.length, 3); // exactly 3 items, no duplicate entry-2

  const digest = getProjectRadarDigest(radar);
  assert.equal(digest.totalItems, 3);
  assert.equal(digest.unreadCount, 3);
  assert.equal(digest.activeFeedsCount, 1);
});

test('6. rejects invalid radar creation with ReadingRadarError', () => {
  assert.throws(() => createProjectRadar({}), {
    name: 'ReadingRadarError',
    message: /projectId is required/,
  });
});
