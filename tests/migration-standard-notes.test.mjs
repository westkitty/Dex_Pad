import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStandardNotesArchive,
  importStandardNotesToWorkspace,
  StandardNotesMigrationError,
} from '../src/core/migration/standard-notes.js';
import { createMemoryStore } from '../src/storage/memory.js';
import { createWorkspace } from '../src/core/workspace.js';

const SAMPLE_ARCHIVE = {
  version: '1.0.0',
  items: [
    {
      uuid: 'note-uuid-001',
      content_type: 'Note',
      content: {
        title: 'Architecture Overview',
        text: 'This is the main architecture document for DEX//Pad local-first sync.',
        references: [
          { uuid: 'tag-uuid-001', content_type: 'Tag' },
          { uuid: 'tag-uuid-002', content_type: 'Tag' },
        ],
      },
      created_at: '2025-06-01T10:00:00.000Z',
      updated_at: '2025-06-02T15:30:00.000Z',
    },
    {
      uuid: 'note-uuid-002',
      content_type: 'Note',
      content: {
        title: '',
        text: 'Titleless quick capture idea for offline peer acknowledgment.',
        references: [],
      },
      created_at: '2025-06-03T08:00:00.000Z',
      updated_at: '2025-06-03T08:00:00.000Z',
    },
    {
      uuid: 'tag-uuid-001',
      content_type: 'Tag',
      content: {
        title: 'architecture',
        references: [{ uuid: 'note-uuid-001', content_type: 'Note' }],
      },
      created_at: '2025-06-01T09:00:00.000Z',
      updated_at: '2025-06-01T09:00:00.000Z',
    },
    {
      uuid: 'tag-uuid-002',
      content_type: 'Tag',
      content: {
        title: 'offline-first',
        references: [{ uuid: 'note-uuid-001', content_type: 'Note' }],
      },
      created_at: '2025-06-01T09:30:00.000Z',
      updated_at: '2025-06-01T09:30:00.000Z',
    },
    {
      uuid: 'ext-uuid-001',
      content_type: 'SN|Component',
      content: {
        name: 'Vim Editor Extension',
        package_info: { version: '2.1.0' },
      },
      created_at: '2025-05-01T00:00:00.000Z',
      updated_at: '2025-05-01T00:00:00.000Z',
    },
    {
      uuid: 'theme-uuid-001',
      content_type: 'SN|Theme',
      content: {
        name: 'Midnight Dark',
      },
      created_at: '2025-05-01T00:00:00.000Z',
      updated_at: '2025-05-01T00:00:00.000Z',
    },
  ],
};

test('1. parses unencrypted Standard Notes archive and resolves tags', () => {
  const result = parseStandardNotesArchive(SAMPLE_ARCHIVE);

  assert.equal(result.totalItems, 6);
  assert.equal(result.migratedNotes.length, 2);
  assert.equal(result.unsupportedItems.length, 2);

  const note1 = result.migratedNotes.find(n => n.id === 'note-uuid-001');
  assert.ok(note1);
  assert.equal(note1.title, 'Architecture Overview');
  assert.equal(note1.body, 'This is the main architecture document for DEX//Pad local-first sync.');
  assert.deepEqual(note1.tags.sort(), ['architecture', 'offline-first']);
  assert.equal(note1.kind, 'note');
  assert.equal(note1.createdAt, '2025-06-01T10:00:00.000Z');
  assert.equal(note1.updatedAt, '2025-06-02T15:30:00.000Z');

  const note2 = result.migratedNotes.find(n => n.id === 'note-uuid-002');
  assert.ok(note2);
  assert.equal(note2.title, '');
  assert.equal(note2.body, 'Titleless quick capture idea for offline peer acknowledgment.');
  assert.deepEqual(note2.tags, []);
});

test('2. quarantines unsupported content types with descriptive reasons', () => {
  const result = parseStandardNotesArchive(SAMPLE_ARCHIVE);

  assert.equal(result.unsupportedItems.length, 2);
  const comp = result.unsupportedItems.find(u => u.uuid === 'ext-uuid-001');
  assert.ok(comp);
  assert.equal(comp.contentType, 'SN|Component');
  assert.match(comp.reason, /Unsupported Standard Notes component/);

  const theme = result.unsupportedItems.find(u => u.uuid === 'theme-uuid-001');
  assert.ok(theme);
  assert.equal(theme.contentType, 'SN|Theme');
  assert.match(theme.reason, /Unsupported Standard Notes theme/);
});

test('3. detects encrypted Standard Notes archive and reports decryption requirement', () => {
  const encryptedArchive = {
    version: '1.0.0',
    items: [
      {
        uuid: 'enc-uuid-1',
        content_type: 'Note',
        content: '004:base64encryptedPayloadStringThatCannotBeDecryptedWithoutItemsKey==',
      },
    ],
  };

  const result = parseStandardNotesArchive(encryptedArchive);
  assert.equal(result.migratedNotes.length, 0);
  assert.equal(result.unsupportedItems.length, 1);
  assert.match(result.unsupportedItems[0].reason, /Encrypted payload detected: requires Standard Notes decrypted export/);
  assert.ok(result.warnings.some(w => w.includes('Encrypted items require decrypted export')));
});

test('4. strictly non-destructive: original archive object is never mutated', () => {
  const originalCopy = JSON.parse(JSON.stringify(SAMPLE_ARCHIVE));
  parseStandardNotesArchive(SAMPLE_ARCHIVE);
  assert.deepEqual(SAMPLE_ARCHIVE, originalCopy, 'Input archive must remain 100% identical and unmutated');
});

test('5. successfully imports parsed notes into a DEX//Pad workspace', async () => {
  const store = createMemoryStore();
  const workspace = createWorkspace(store);

  const importReport = await importStandardNotesToWorkspace({
    archive: SAMPLE_ARCHIVE,
    workspace,
  });

  assert.equal(importReport.importedCount, 2);
  assert.equal(importReport.skippedCount, 2);
  assert.equal(importReport.errors.length, 0);

  const allItems = await workspace.list({ includeDeleted: true });
  assert.equal(allItems.length, 2);

  const imported1 = allItems.find(item => item.id === 'note-uuid-001');
  assert.ok(imported1);
  assert.equal(imported1.title, 'Architecture Overview');
  assert.equal(imported1.provenance?.origin, 'import');
  assert.equal(imported1.provenance?.source, 'standard-notes');

  const imported2 = allItems.find(item => item.id === 'note-uuid-002');
  assert.ok(imported2);
  assert.equal(imported2.body, 'Titleless quick capture idea for offline peer acknowledgment.');
});

test('6. rejects invalid or non-object archive input with StandardNotesMigrationError', () => {
  assert.throws(
    () => parseStandardNotesArchive(null),
    StandardNotesMigrationError
  );
  assert.throws(
    () => parseStandardNotesArchive({ notItems: [] }),
    StandardNotesMigrationError
  );
  assert.throws(
    () => parseStandardNotesArchive('plain string'),
    StandardNotesMigrationError
  );
});
