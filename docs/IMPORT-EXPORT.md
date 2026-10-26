# Import, export, migration, and recoverability

## Standard Notes migration

Standard Notes documents support a decrypted backup ZIP export; inspect actual file format and counts on a *synthetic or redacted test export* before coding a parser. See https://standardnotes.com/help/14/how-do-i-create-and-import-backups-of-my-standard-notes-data

Migration must be staged, non-destructive and verifiable:

1. Export an original backup on an already trusted device; preserve original bytes in a separate offline safe location.
2. Inventory note counts, identifiers, timestamps, tags, content types and attachments. Record unsupported elements and unknowns.
3. Import into an isolated DEX//Pad staging space; do not overwrite an existing item with a matching title.
4. Compute content/attachment checks, compare note counts and sample rendered meaning, inspect rich-text loss and malformed entries.
5. Commit imported records as one identifiable batch only after preview/acceptance; retain quarantine and rollback IDs.
6. Re-export and independently re-import into an empty test vault. Verify notes, metadata, links and binaries match the supported source scope.
7. Keep original Standard Notes account and backups untouched until full recovery verification and explicit retirement decision.

## Native export

- UTF-8 Markdown with stable ID frontmatter where representable.
- JSON manifest for object types, identity, relationships, revisions, provenance and attachment references.
- Attachment bytes with cryptographic checksums.
- Export manifest version and unsupported element report.
- Optional encrypted snapshot for whole-vault restore. Never export plaintext without an explicit human confirmation.

## Recovery requirements

- Recovery keys controlled by user; loss semantics documented.
- At least two independent encrypted backups, including one not on the live relay.
- Routine restore test in an isolated empty environment, not proof by file existence.
- Safe schema migration, backwards compatibility for exports, and read-only fallback on unknown future versions.
- Deleted notes must follow explicit tombstone/retention policy. Deletion propagated to peers does not retroactively erase third-party backups.