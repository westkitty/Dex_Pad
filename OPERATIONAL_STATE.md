# DEX//Pad Operational State

project_id: Dex_Pad
project_name: DEX//Pad
status: development-foundation-in-progress
current_baseline: feat/dexpad-development (branched from main 1e1fca6)
working_scope: isolated synthetic-data browser development slice and full implementation feature map

## Purpose and protected invariants

- Become a fast, trustworthy, offline-first encrypted notes replacement across Android phone, tablet and MacBook.
- Stay independent of other projects and services; Big Mac may act as a private ciphertext relay, never mandatory plaintext authority.
- No lost acknowledged writes; no silent merge/overwrite; backups must be independently restored.
- Integrations require specific grants; GPT must not receive vault-wide read/search/list/export access.
- No personal data, real notes, credentials or secret material in the public source repository or unencrypted development sandbox.

## Current source state

- Planning source: README, AGENTS, PROJECT_STATE, and docs/ are authoritative for intent.
- Code under `src/` is a developer-only demonstration using plaintext browser IndexedDB.
- `planning/features.json` is canonical for 50 feature contracts (25 core, 25 new), all statuses limited to planned/dev-prototype until actual acceptance evidence.
- Source documentation and implementation plans are in `docs/superpowers/`.

## Verified in local runtime (empirically proven)

- Pure domain Node tests (70/70) across workspace, gateway, build, feature registry, synthetic DEX//RELAY ingestion, encrypted vault cryptography, cross-device sync engine, backup & recovery, and Standard Notes migration.
- Independent Encrypted Backup & Recovery Subsystem (`src/core/crypto/backup.js`, `tests/backup-recovery.test.mjs`):
  1. Deterministic encrypted backup archive creation (`dex-backup.v1`) with SHA-256 cryptographic checksum binding over all encrypted record envelopes and manifest metadata.
  2. Bit-level tamper detection: modified ciphertext envelopes or altered record counts are rejected with `CorruptBackupError`.
  3. Independent offline restore: completely restores all encrypted records into a clean, empty store on an independent client without relay or network access.
  4. Key epoch validation: rejects backup archives from mismatched key epochs with `KeyEpochMismatchError`.
  5. Lost-device recovery workflow: restores vault access, recovers the Vault Key, and re-encrypts with a new user passphrase using the emergency recovery code and recovery envelope.
  6. Unrecoverability proof: demonstrates that lost passphrase combined with lost recovery code cannot decrypt or restore records.
  7. Mandatory explicit consent gating: unencrypted export strictly requires explicit user confirmation (`ConsentRequiredError`) and attaches a prominent warning banner.
- Quarantined Standard Notes Migration Processor (`src/core/migration/standard-notes.js`, `tests/migration-standard-notes.test.mjs`):
  1. Non-destructive parsing: input archive data is deep-cloned and never mutated or deleted.
  2. Tag reference resolution: bidirectional tag-to-note and note-to-tag relationships are resolved into DEX//Pad record tag arrays.
  3. Titleless note preservation: titleless notes, markdown content, and original timestamps are preserved.
  4. Unsupported content quarantine: extensions (`SN|Component`) and themes (`SN|Theme`) are quarantined into a structured report with descriptive reasons rather than causing data loss.
  5. Encrypted archive detection: detects encrypted Standard Notes payloads (`004:...`, `003:...`) and surfaces a clear warning requiring decrypted export before import.
- Truthful Sync Inspector & Peer-Applied Confirmation Protocol (`src/core/sync/engine.js`, `src/ui/app.js`, `index.html`, `styles.css`):
  1. Peer confirmation protocol: peer devices cryptographically sign and register delivery receipts (`dex-peer-ack.v1`) upon applying incoming envelopes.
  2. Truthful state tracking: `getItemSyncState` strictly distinguishes `SAVED_LOCALLY` (pending outbox), `RELAY_STORED` (stored on relay, awaiting peer pull), and `PEER_APPLIED` (confirmed by peer device with signature verification).
  3. Interactive UI inspector: dedicated Truthful Sync Inspector panel with local, relay, and peer status cards, push simulation, peer ACK simulation, and network interruption toggling.
- Cross-Device Encrypted Sync Engine & Fault Matrix Harness (`src/core/sync/engine.js`, `tests/sync-engine.test.mjs`):
  1. Offline writing: local transactions commit durably while offline; pending encrypted sync frames (`dex-sync.v1`) queue reliably.
  2. Private ciphertext-only relay transport: relay stores and forwards encrypted sync blobs without plaintext decryption capability.
  3. Scrambled/reordered frame buffering: frames arriving out-of-order wait in a holding buffer and apply cleanly without state corruption once predecessors arrive.
  4. 100x duplicate replay idempotency: duplicate sync deliveries result in exactly-once application.
  5. Interrupted transfer recovery: sync cursor resumes from the last confirmed server sequence without data loss.
  6. Concurrent divergent edits: concurrent offline edits at the same base revision fork cleanly with full historical revision recovery; zero silent overwrites.
  7. Device pairing & revocation enforcement: authentic pairing tokens, immediate revocation enforcement on relay, documented limitation that revocation governs future sync and cannot erase previously downloaded offline plaintext.
  8. Truthful acknowledgment: strict architectural distinction between `RELAY_STORED` (relay receipt) and `PEER_APPLIED` (actual target peer application).
- Cryptographic proof suite (`src/core/crypto/primitives.js`, `src/core/crypto/vault.js`, `tests/vault-crypto.test.mjs`):
  1. Unique vault identity (`vlt-...`) and versioned format (`dex-vault.v1`).
  2. Domain-separated key hierarchy derived via PBKDF2 + HKDF-SHA256: Master Key (MK), Vault Key (VK), Auth Key (AK), Recovery Key (RK), Device Pairing Key (PK), and Integration Key (IK).
  3. Authenticated encryption (AES-256-GCM) with canonical AAD binding (`vaultId`, `schemaVersion`, `recordId`, `epoch`).
  4. Ciphertext-only storage adapter (`createEncryptedStore`) persisting zero plaintext notes/titles/bodies at rest.
  5. Guaranteed unique nonces (96-bit CSPRNG) per write.
  6. Lock/unlock state machine: zero plaintext in locked state, immediate memory clearing on lock.
  7. Rejection of invalid credentials (`InvalidCredentialsError`).
  8. Cryptographic tamper detection on bit-flips in ciphertext or metadata (`TamperedCiphertextError`).
  9. Emergency recovery code unwrapping (`recoverVault`).
  10. Proof of unrecoverability without recovery material or passphrase.
  11. Proof of relay confidentiality: untrusted relay cannot decrypt record envelopes.
  12. Format versioning (`dex-record.v1`, `dex-vault.v1`) for forward migration safety.
- Synthetic DEX//RELAY event ingestion bridge (`src/integrations/relay/`): deterministic schema validation (`dex-relay.event.v1`, `dex-relay.task.v1`), sequence continuity and hash-chain tracking (`streamIntegrity`), idempotency preservation with conflict rejection on payload mismatch, strict project isolation, secret/credential payload sanitization, separation of claims from independent cryptographic proof, and project timeline visualization with explicit `SYNTHETIC RELAY EVENTS — NOT LIVE EXECUTION` disclaimer.
- Static read-only server unit tests reject unsafe paths/write requests and serve required file types with CSP.
- Build/feature registry tests ensure source assets, crypto modules, sync modules, migration modules, and all 25 expansions are present.
- Real Chromium browser smoke (tests/browser_smoke.py): verified end-to-end UI rendering, IndexedDB write and reload persistence, revision increments, local full-text search, archive/unarchive revision restoration, project resume cards, relay timeline card rendering, decision evidence gate, incident card lifecycle, commitment tracking, backlinks index rendering, one-tap agent handoff download, contribution inbox idempotency, mobile (390px) and desktop (1280px) responsive layouts without horizontal overflow, Truthful Sync Inspector interactive cycle (`SAVED_LOCALLY` -> `RELAY_STORED` -> `PEER_APPLIED` -> `Offline buffered`), zero console errors, zero cross-origin leaks.
- Repaired baseline UI defect where revision restore buttons remained disabled after saving.

## Implemented development prototypes (unverified against production)

- Media Annotations & Timecoded References (F12, F13 prototypes): normalized image region bounding boxes projecting consistently across desktop and mobile screens while preserving original media bytes; timecoded media notes linking seconds and durations surviving archive export.
- Contradiction Review & Source Watcher (F15, F16 prototypes): automated candidate duplicate detection presenting source provenance and enforcing human recovery without silent deletion or auto-merging; authorized source watchers with verifiable change receipts and disabled state isolation.
- Original-Source Ledger & Deep Citation Anchors (C12, F11 prototypes): immutable source records preserving original URI, SHA-256 snapshot file hash, timestamps, authority labels, and derived-record relationships; deep citation anchors with exact page/line/section coordinates, quote hashes, and drift detection.
- Evidence Freshness Rules & Project Reading Radar (F14, F17 prototypes): expiration and source-drift policy marking claims as needs-review rather than silently true/false; project-scoped reading radar digests with idempotent feed item ingestion.
- Knowledge Graph & Stable Relations (C11 prototype): bidirectional wikilink indexing, stable item ID relation anchors across renames, broken target detection for deleted/missing notes, superseding link tracking.
- Project Continuity Records (F03, F05, F08 prototypes): structured Decision Memory with rationale, alternatives considered, review dates, superseding audit trail; Incident Cards with failure description, reproduction steps, confirmed repair, and regression proof; Outstanding Commitments with owner, expected outcome, and review date.
- Agent Handoff & Resume Diff (F06, F18 prototypes): One-Tap Agent Handoff context exporter strictly bounded to user selection with evidence breakdown; resume diff analyzer strictly isolating empirical recorded events from inferred impacts.
- Cross-Device Encrypted Sync Engine & Peer Confirmation (C03/C18/C24 harness). 10/10 fault matrix tests pass against synthetic relay. Physical multi-device validation across MacBook, Android phone, and Galaxy Tab over live Tailscale remains UNVERIFIED.
- Independent Encrypted Backup & Restore (C07 prototype). 9/9 unit tests pass. External independent security audit and hardware key-storage review remain UNVERIFIED.
- Standard Notes Migration Processor (C08 prototype). 6/6 tests pass. Large multi-megabyte real production archive test remains UNVERIFIED.
- Encrypted Vault Cryptographic Proof (C02 foundation). 12/12 unit tests pass on Web Crypto API primitives. MUST NOT be claimed as production E2EE until external security audit, hardware key storage review, side-channel analysis, and production key rotation are verified.
- Synthetic DEX//RELAY Event Ingestion Bridge (F21 prototype, scoped to C13/F02 contracts). Not production-ready; live Big Mac witness/daemon execution remains blocked.
- Write-only contribution gateway (C13 prototype). No external GPT MCP connection is active.

## Known not implemented / do not claim

- Production E2EE and client-at-rest encryption; device key lifecycle and independent restore.
- Multi-device sync, server, conflict convergence, Android packaging/background behavior.
- Actual GPT MCP connector, external integrations, Standard Notes migration.
- Production-ready backups, rich knowledge features, release deployment.

## Next proof gate

On a machine that can browse localhost, run `npm run dev` and `python3 tests/browser_smoke.py` (with Playwright installed). Resolve any observed UI/IDB defects before trusting even synthetic local use. Then run the independent cryptographic/key-recovery and sync protocols lab described in `docs/SYNC-LAB.md`, with synthetic data and real devices.

## Current authority and delivery

Main GitHub repo `westkitty/Dex_Pad` is public. No real private data belongs there. Publication and CI verification need a fresh readback after updating the source. New source files and docs are not evidence of successful deployed behavior.
