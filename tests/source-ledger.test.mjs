import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSourceRecord,
  linkDerivedRecord,
  createCitationAnchor,
  verifyCitationAnchor,
  SourceLedgerError,
} from '../src/core/sources.js';

test('1. createSourceRecord preserves URI, file hash, timestamps, authority label, and derived relationships (C12)', () => {
  const source = createSourceRecord({
    uri: 'https://spec.example.org/rfc-9999.txt',
    title: 'RFC 9999 Distributed Consensus Specification',
    contentSnapshot: 'Section 4.1: Heartbeat intervals MUST NOT exceed 500ms.\nSection 4.2: Election timeouts MUST be randomized.',
    authorityLabel: 'primary-specification',
    metadata: { mimeType: 'text/plain', author: 'IETF Working Group' },
  });

  assert.equal(source.schemaVersion, 'dex-source.v1');
  assert.match(source.sourceId, /^src-[a-f0-9-]+$/);
  assert.equal(source.uri, 'https://spec.example.org/rfc-9999.txt');
  assert.equal(source.authorityLabel, 'primary-specification');
  assert.ok(source.fileHash && source.fileHash.length === 64, 'fileHash must be SHA-256');
  assert.ok(source.capturedAt);
  assert.deepEqual(source.derivedRecordIds, []);
  assert.equal(source.metadata.author, 'IETF Working Group');
});

test('2. linkDerivedRecord associates DEX//Pad records with source provenance (C12)', () => {
  const source = createSourceRecord({
    uri: 'file:///workspace/docs/DECISIONS.md',
    title: 'Architecture Decisions',
    contentSnapshot: 'All records must be encrypted before transmission.',
    authorityLabel: 'primary-specification',
  });

  const updated1 = linkDerivedRecord({ source, recordId: 'note:101' });
  const updated2 = linkDerivedRecord({ source: updated1, recordId: 'decision:202' });

  // Idempotent re-add
  const updated3 = linkDerivedRecord({ source: updated2, recordId: 'note:101' });

  assert.deepEqual(updated3.derivedRecordIds, ['note:101', 'decision:202']);
});

test('3. createCitationAnchor stores line/section anchors, origin snapshot, and exact quote (F11)', () => {
  const snapshotText = 'Line 1: preamble\nLine 2: crucial invariant\nLine 3: conclusion';
  const source = createSourceRecord({
    uri: 'https://standards.org/core.txt',
    title: 'Core Standard',
    contentSnapshot: snapshotText,
    authorityLabel: 'primary-specification',
  });

  const citation = createCitationAnchor({
    source,
    targetItemId: 'decision:consensus-timeout',
    anchor: {
      type: 'line',
      start: 2,
      end: 2,
      label: 'Line 2',
    },
    exactQuote: 'Line 2: crucial invariant',
  });

  assert.equal(citation.schemaVersion, 'dex-citation.v1');
  assert.match(citation.citationId, /^cite-[a-f0-9-]+$/);
  assert.equal(citation.sourceId, source.sourceId);
  assert.equal(citation.targetItemId, 'decision:consensus-timeout');
  assert.equal(citation.anchor.type, 'line');
  assert.equal(citation.anchor.start, 2);
  assert.equal(citation.exactQuote, 'Line 2: crucial invariant');
  assert.ok(citation.snapshotHash && citation.snapshotHash.length === 64);
});

test('4. verifyCitationAnchor detects stale target when source text drifts or mutates (F11)', () => {
  const originalText = 'Section A: Maximum retry limit is 3 attempts.';
  const source = createSourceRecord({
    uri: 'https://api.example.com/spec.txt',
    title: 'API Spec',
    contentSnapshot: originalText,
    authorityLabel: 'external-doc',
  });

  const citation = createCitationAnchor({
    source,
    targetItemId: 'note:retry-policy',
    anchor: { type: 'section', start: 'A', end: 'A', label: 'Section A' },
    exactQuote: 'Maximum retry limit is 3 attempts.',
  });

  // Verify against untampered source snapshot
  const validCheck = verifyCitationAnchor({
    citation,
    currentSourceSnapshot: originalText,
  });
  assert.equal(validCheck.status, 'VALID');
  assert.equal(validCheck.driftDetected, false);

  // Verify against modified source snapshot (stale target detection)
  const modifiedText = 'Section A: Maximum retry limit is 5 attempts.';
  const staleCheck = verifyCitationAnchor({
    citation,
    currentSourceSnapshot: modifiedText,
  });
  assert.equal(staleCheck.status, 'STALE');
  assert.equal(staleCheck.driftDetected, true);
  assert.ok(staleCheck.reason.includes('drift'));
});

test('5. rejects invalid source records and malformed inputs with SourceLedgerError', () => {
  assert.throws(() => createSourceRecord({}), {
    name: 'SourceLedgerError',
    message: /URI is required/,
  });

  assert.throws(() => createSourceRecord({ uri: 'http://test.com', authorityLabel: 'invalid-label' }), {
    name: 'SourceLedgerError',
    message: /Unsupported authority label/,
  });

  assert.throws(() => createCitationAnchor({}), {
    name: 'SourceLedgerError',
    message: /source is required/,
  });
});
