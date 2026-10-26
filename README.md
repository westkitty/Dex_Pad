# DEX//Pad

**A private, local-first knowledge workspace. Notes first. Everything else by permission.**

DEX//Pad is intended to replace slow or unreliable cross-device note synchronization while creating a reusable, encrypted knowledge layer for personal projects, research, and other local-first applications.

> **Status: architecture/bootstrap only.** No notes app, encryption engine, sync service, migration utility, or Android package has been implemented or validated yet. Do not store important information in DEX//Pad until the durability and recovery gates pass.

## Product principles

1. **Acknowledge only durable local writes.** Every accepted edit must survive process termination and restart before it is considered saved.
2. **Offline is normal.** Reading, editing, organizing, and unlocked local search work without Big Mac or the internet.
3. **Fast enough to disappear.** Open-and-write, local search, and foreground sync are independently measured on actual Android and macOS devices.
4. **Encryption is architectural.** The relay normally holds ciphertext and routing information, never a master decryption key or a plaintext note index.
5. **No silent loss.** Concurrent edits, failed imports, and restore mismatches must be visible and recoverable.
6. **Portable by default.** Markdown, JSON manifests, attachments, and stable identifiers survive export and re-import.
7. **Knowledge with provenance.** Every imported or transformed source retains its origin, authority status, and transformation lineage.
8. **Integration by capability, not blanket access.** Other apps use revocable, scoped access through an explicitly unlocked trusted client.
9. **A notes application stays simple.** Powerful object models, project lenses, automation, and AI never obstruct quick capture.
10. **No public-network dependency.** A private, self-hosted relay over Tailscale is the intended first deployment; no Docker requirement.

## The distinct DEX//Pad layers

- **Capture:** titleless quick notes, share-sheet/clipboard capture, snippets, URLs, PDFs, drafts, tasks.
- **Store:** typed objects with immutable IDs, encrypted payloads, relations, attachments, revision events, and tombstones.
- **Find:** fast local keyword retrieval; optional later semantic search only for explicitly permitted unlocked spaces.
- **See:** notebook, inbox, projects, backlinks, saved collections, eventually canvas and timelines over the same objects.
- **Trust:** per-device state, sync inspector, export validation, device pairing and revocation, backups and recovery drills.
- **Bridge:** external read/write/search/event capabilities without importing another project's source-of-truth rules.

## Initial user journey

1. Open DEX//Pad on Android; the editor is immediately available.
2. Write a note without selecting a title or folder; it is durably saved locally.
3. With connectivity, transmit encrypted update events to a private Big Mac relay.
4. Open the MacBook client; catch up, decrypt locally, display the note and source sync state.
5. Turn off connectivity, edit on two devices, reconnect, and inspect or restore revisions if changes conflict semantically.
6. Export notes, attachments, relations, and provenance to interoperable files without a subscription or server dependency.

## Repository map

| File | Role |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Product scope, UX, object model, differentiators |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Proposed trust and storage boundaries |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, encryption and key-management gates |
| [docs/SYNC-LAB.md](docs/SYNC-LAB.md) | Competitive sync experiments and failure-injection matrix |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases, acceptance evidence and stop conditions |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Permissioned interface with other local systems |
| [docs/IMPORT-EXPORT.md](docs/IMPORT-EXPORT.md) | Standard Notes migration and backup safeguards |
| [docs/RESEARCH.md](docs/RESEARCH.md) | Prior-art map and reusable design lessons |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decisions, hypotheses and unresolved architecture |
| [docs/RISKS.md](docs/RISKS.md) | Failure-mode ledger |
| [specs/object-envelope.v0.schema.json](specs/object-envelope.v0.schema.json) | **Draft** interchange envelope, not a live format |
| [PROJECT_STATE.md](PROJECT_STATE.md) | Current verified state and continuity ledger |
| [AGENTS.md](AGENTS.md) | Instructions for future coding agents |

## First build decision

Run the bounded sync/security lab before freezing application framework or building a feature-rich editor. See [docs/SYNC-LAB.md](docs/SYNC-LAB.md).

## Current build state

No runtime code has been chosen or shipped. A green test result on the docs does **not** validate synchronization, security, or mobile behavior. The first technical milestone is a runnable three-device sync experiment.

## License

**License undecided.** The canonical GitHub repository is currently **public** (`westkitty/Dex_Pad`). Do not commit personal notes, exports, credentials, keys, or other private data. Do not assume copying code from referenced projects is licensed or permissible; inspect each license and dependencies before reuse. No third-party application code is included here.