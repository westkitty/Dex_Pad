import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocalSemanticIndex,
  querySemanticIndex,
  deleteSemanticIndex,
  SemanticIndexError,
} from '../src/core/local-retrieval.js';

test('1. buildLocalSemanticIndex indexes authorized items locally without cloud API (C20)', () => {
  const authorizedItems = [
    { id: 'note:1', title: 'Cryptographic AEAD Primitives', body: 'AES-256-GCM authenticated encryption and PBKDF2 key derivation.' },
    { id: 'note:2', title: 'Synchronous Relay Protocol', body: 'Encrypted relay queues and device pairing keys.' },
    { id: 'note:3', title: 'Project Continuity Capsule', body: 'Decisions, blockers, and next actions for active work.' },
  ];

  const index = buildLocalSemanticIndex({ items: authorizedItems });

  assert.equal(index.schemaVersion, 'dex-semantic-index.v1');
  assert.equal(index.indexedItemCount, 3);
  assert.ok(index.termsCount > 0);

  // Querying index
  const results = querySemanticIndex({ index, query: 'cryptographic encryption', topK: 2 });
  assert.equal(results.length, 1);
  assert.equal(results[0].itemId, 'note:1');
  assert.ok(results[0].score > 0);
});

test('2. deleteSemanticIndex completely deletes index without endangering underlying notes (C20)', () => {
  const notes = [
    { id: 'note:secret', title: 'Confidential Key Agreement', body: 'Private keys remain local.' },
  ];

  let index = buildLocalSemanticIndex({ items: notes });
  assert.equal(index.indexedItemCount, 1);

  // Purge index
  index = deleteSemanticIndex(index);
  assert.equal(index.indexedItemCount, 0);
  assert.equal(index.termsCount, 0);

  // Underlying note is intact
  assert.equal(notes.length, 1);
  assert.equal(notes[0].id, 'note:secret');
});

test('3. excludes unauthorized or unselected notes from semantic index (C20)', () => {
  const items = [
    { id: 'note:public', title: 'Public architecture guide', body: 'Overview of system', isAuthorized: true },
    { id: 'note:private', title: 'Unselected draft note', body: 'Draft details', isAuthorized: false },
  ];

  const index = buildLocalSemanticIndex({
    items: items.filter(i => i.isAuthorized),
  });

  assert.equal(index.indexedItemCount, 1);
  const results = querySemanticIndex({ index, query: 'draft details' });
  assert.equal(results.length, 0); // private note never indexed
});
