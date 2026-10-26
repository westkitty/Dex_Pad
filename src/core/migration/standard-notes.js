export class StandardNotesMigrationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StandardNotesMigrationError';
  }
}

/**
 * Isolated, non-destructive parser for Standard Notes export archives.
 * Quarantines unsupported types and resolves tag references.
 */
export function parseStandardNotesArchive(rawArchive) {
  if (!rawArchive || typeof rawArchive !== 'object' || !Array.isArray(rawArchive.items)) {
    throw new StandardNotesMigrationError('Invalid Standard Notes archive: items array required');
  }

  // Work on a deep clone to guarantee the source archive is never mutated
  const archive = JSON.parse(JSON.stringify(rawArchive));
  const tagMap = new Map(); // uuid -> tag title
  const noteTagUuids = new Map(); // note uuid -> Set of tag uuids
  const warnings = [];
  const unsupportedItems = [];
  const migratedNotes = [];

  // Pass 1: Collect all Tags and their relationships
  for (const item of archive.items) {
    if (!item || typeof item !== 'object') continue;

    if (item.content_type === 'Tag') {
      const title = (item.content?.title || '').trim();
      if (title && item.uuid) {
        tagMap.set(item.uuid, title);
      }
      // Check if tag references notes
      const refs = Array.isArray(item.content?.references) ? item.content.references : [];
      for (const ref of refs) {
        if (ref?.content_type === 'Note' && ref.uuid) {
          if (!noteTagUuids.has(ref.uuid)) noteTagUuids.set(ref.uuid, new Set());
          noteTagUuids.get(ref.uuid).add(item.uuid);
        }
      }
    }
  }

  // Pass 2: Process Notes and unsupported items
  for (const item of archive.items) {
    if (!item || typeof item !== 'object') continue;

    // Check for encrypted payload strings (e.g. "004:...", "003:...")
    if (typeof item.content === 'string') {
      unsupportedItems.push({
        uuid: item.uuid || 'unknown',
        contentType: item.content_type || 'Unknown',
        reason: 'Encrypted payload detected: requires Standard Notes decrypted export',
      });
      warnings.push(`Item ${item.uuid || ''} is encrypted. Encrypted items require decrypted export.`);
      continue;
    }

    if (item.content_type === 'Note') {
      const content = item.content || {};
      const noteUuid = item.uuid || crypto.randomUUID();

      // Collect tags referenced by the note itself
      const tagsSet = new Set();
      const directRefs = Array.isArray(content.references) ? content.references : [];
      for (const ref of directRefs) {
        if (ref?.content_type === 'Tag' && ref.uuid && tagMap.has(ref.uuid)) {
          tagsSet.add(tagMap.get(ref.uuid));
        }
      }

      // Collect tags pointing to this note
      if (noteTagUuids.has(noteUuid)) {
        for (const tagUuid of noteTagUuids.get(noteUuid)) {
          if (tagMap.has(tagUuid)) {
            tagsSet.add(tagMap.get(tagUuid));
          }
        }
      }

      migratedNotes.push({
        id: noteUuid,
        kind: 'note',
        title: (content.title || '').slice(0, 180),
        body: content.text || '',
        tags: Array.from(tagsSet).sort(),
        evidence: 'proposed',
        evidenceRef: '',
        createdAt: item.created_at || new Date().toISOString(),
        updatedAt: item.updated_at || new Date().toISOString(),
        provenance: {
          origin: 'import',
          source: 'standard-notes',
          sourceUuid: noteUuid,
        },
      });
    } else if (item.content_type === 'Tag') {
      // Tags are handled via note associations
      continue;
    } else if (item.content_type === 'SN|Component') {
      unsupportedItems.push({
        uuid: item.uuid || 'unknown',
        contentType: 'SN|Component',
        reason: `Unsupported Standard Notes component: ${item.content?.name || item.uuid}`,
      });
    } else if (item.content_type === 'SN|Theme') {
      unsupportedItems.push({
        uuid: item.uuid || 'unknown',
        contentType: 'SN|Theme',
        reason: `Unsupported Standard Notes theme: ${item.content?.name || item.uuid}`,
      });
    } else {
      unsupportedItems.push({
        uuid: item.uuid || 'unknown',
        contentType: item.content_type || 'Unknown',
        reason: `Unsupported Standard Notes content type: ${item.content_type}`,
      });
    }
  }

  return {
    totalItems: archive.items.length,
    migratedNotes,
    unsupportedItems,
    warnings,
  };
}

/**
 * Imports parsed Standard Notes items into an active DEX//Pad workspace.
 */
export async function importStandardNotesToWorkspace({ archive, workspace }) {
  const parsed = parseStandardNotesArchive(archive);
  let importedCount = 0;
  const errors = [];

  for (const note of parsed.migratedNotes) {
    try {
      await workspace.create(
        {
          kind: note.kind,
          title: note.title,
          body: note.body,
          tags: note.tags,
          evidence: note.evidence,
          evidenceRef: note.evidenceRef,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          provenance: note.provenance,
        },
        { fixedId: note.id }
      );
      importedCount++;
    } catch (err) {
      errors.push({ id: note.id, error: err.message });
    }
  }

  return {
    importedCount,
    skippedCount: parsed.unsupportedItems.length,
    totalParsed: parsed.migratedNotes.length,
    errors,
    unsupported: parsed.unsupportedItems,
    warnings: parsed.warnings,
  };
}
