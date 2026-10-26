# DEX//Pad Development Foundation: Design Contract

Date: 2026-10-25
Status: provisional implementation design for a developer sandbox, not approval of an encrypted production vault.
Canonical repository: westkitty/Dex_Pad

## Purpose

Build a fast, independent notes application that becomes a private project-continuity and contribution surface. It must eventually work offline across Android phone, Android tablet, and MacBook through a private encrypted relay. The repository currently has architecture documents only. The immediate milestone is a runnable, testable development foundation that can grow without swallowing DEX//REACH, DexVault, WorldsVault, GitHub, or DexDictate.

## Three approaches evaluated

1. Full encrypted, cross-device, AI-integrated production application immediately: rejects safe scope and verification reality. Too many unproven security and lifecycle decisions.
2. Thin native browser development app, dependency-free, modular, with transactional local IndexedDB storage and a testable domain core: **chosen as the fastest reversible foundation**. A public sandbox is not an encrypted vault. It is not suitable for sensitive personal notes.
3. Fork an existing notes app: plausible later if sync/security proof finds a decisively better reusable base, but adds upstream licensing and migration costs before this project's fundamental contracts are proven.

## User-visible first slice

- A functional browser-openable interface running locally from an explicit loopback-only development server.
- Create, edit, search and classify local synthetic notes, projects, decisions, and inbox contributions.
- A note saves only after its IndexedDB transaction completes; revisions remain available for restore.
- Record evidence state and a reference when marking information verified. Never convert a model's claim into verification automatically.
- Support a minimal project resume card and export of selected development records.
- Accept simulated, write-only contribution submissions through a narrow local facade. The GPT connector itself is NOT implemented or authorized to access the vault.
- Display an unavoidable development warning: **UNENCRYPTED DEVELOPMENT STORAGE; SYNTHETIC DATA ONLY**.
- No analytics, network third-party calls, public server, iCloud, Docker, paid dependencies, or forced use of external apps.

## Data architecture

- Native JavaScript modules with contracts appropriate for later TypeScript migration. No runtime external libraries in foundation.
- Domain: item { schemaVersion, id, kind, title, body, projectId, evidence, evidenceRef, tags, provenance, createdAt, updatedAt, revision, deletedAt }.
- Kinds: note, project, decision, contribution. Items have stable IDs. Later kinds are tracked in the feature matrix, not faked as complete.
- Storage adapter contract: listItems, listEvents, getItem, listRevisions, commit(item, event), close. `commit` atomically writes the current item, its immutable revision, and an event metadata record; resolve only on successful transaction completion.
- Domain layer: create, update-if-revision, soft-delete, restore-by-revision (new revision), query, and portable JSON export.
- A single write-only `acceptContribution` facade creates a contribution record and returns a receipt. It exposes no list, search, export, or get operation.
- No merge/sync/cryptography claims. The sync lab must select a protocol before data gets shared across devices.

## UI and accessibility

- Restrained editorial UI, dense enough for laptop and touch-friendly on Android.
- Keyboard and pointer actions are equivalent. Search and new shortcuts use Cmd/Ctrl+K and Cmd/Ctrl+N.
- Never render note contents with unsafe HTML interpolation; use textContent or safe native textarea values.
- Empty, loading, saved, pending, error and deleted states must be visible and accurate.
- Do not use color alone to communicate state. Keep readable contrast and reduce motion under user preference.
- Responsive design includes small widths. Status and destructive actions use labels and confirmations.

## Trust and privacy boundary

- This first slice deliberately stores development fixture content unencrypted in browser IndexedDB. Do NOT market it as private or E2EE.
- No external service can read local content. The dev server serves static files and accepts no write endpoint.
- Only synthetic test notes may be entered before cryptography, key lifecycle, restore, and sync are independently validated.
- Write-only GPT integration design remains a separate bounded project. For existing-note editing, obtain an explicit one-time target grant, version precondition, and trusted-client application; never insert a backdoor read API.
- Source repository is public; no user notes, exports, credentials, keys, or real device metadata may be committed.

## Non-goals of foundation slice

- Production encryption, cross-device sync, Standard Notes import, native Android background service, actual MCP endpoint, privileged GitHub writes, automatic source watcher, AI retrieval, or third-party data collection.
- Automatic execution of terminal commands or modifying external repositories.
- Meaningful statements that all 25 candidate features have shipped.

## Deferred feature program

Every previously accepted feature, including the 25 new project-continuity concepts and the original privacy/knowledge capabilities, appears with owner, phase, acceptance and state in docs/FEATURE_MATRIX.md. The sequence is gated by evidence, not arbitrary calendar promises.

## Acceptance and proof

1. Open `npm run dev` at http://127.0.0.1:4173 and create a synthetic note, then reload and recover it.
2. Update/soft-delete/restore a note and observe increasing immutable revision history.
3. Marking a decision verified without evidence must be rejected; a verified record must retain the evidence reference.
4. A stale revision update must fail and preserve the newer state.
5. A GPT-simulated contribution can create a new inbox item but the exposed facade cannot read or list anything.
6. `npm test`, `npm run build`, `npm run check` and documentation verifier finish with zero unexpected failures.
7. Browser smoke checks keyboard, phone-width layout, no external requests, and visible unencrypted warning.
8. Publish only with clear README / OPERATIONAL_STATE / Project Bible labeling unverified encryption and sync.

## Future decision gates

- Select security/key hierarchy and sync engine via matched destructive fault tests, not preference.
- Decide native Android shell versus browser packaging after real device lifecycle evidence.
- Preserve a simple notes UI even if advanced objects and projects grow.
- Refuse data migration until independent encrypted backup restore and source import roundtrip pass.
