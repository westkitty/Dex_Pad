# DEX//Pad Project State

Date: 2026-10-25 (initial planning/bootstrap)

## Verified scope

- Product name selected: **DEX//Pad**.
- Canonical GitHub repository: **westkitty/Dex_Pad** (public; observed empty before bootstrap publication on 2026-10-25).
- Explicit goal: dependable synchronization between an Android phone, Android tablet, and MacBook; private encrypted storage; later integration with other user-owned software.
- First intended relay host: Big Mac, on private Tailscale access only.
- Repo content at bootstrap is architecture, specifications, research and governance only; not a functioning application.

## Proposed, not yet implemented

- End-to-end encryption; offline editing; local search; durable op log; conflict recovery; native Android/PWA selection; source provenance; project lenses; integration API; migration.
- Candidate engines: Yjs and Automerge; TinyBase considered for structured data only. No winner chosen.

## Open critical decisions

1. Exact key hierarchy, device pairing, local-at-rest encryption and recovery protocol.
2. Encryption wrapper for incremental CRDT updates, compaction and rekeying.
3. Sync-engine and client-packaging choice based on measured three-device tests.
4. File/object data model interoperability without premature rich-text lock-in.
5. Backup and restore strategy that works when the relay is unavailable.
6. Repository license remains undecided; publication visibility is public.

## Chronological ledger

### 2026-10-25 — Bootstrap specification

Created a non-executable foundation packet and deterministic documentation/schema verifier. No sync/security/performance claims are made. GitHub publication status must be independently verified; do not infer that a remote repository exists from an initialized local .git directory or a configured origin URL.

### 2026-10-25 — Canonical GitHub target selected

The owner supplied `https://github.com/westkitty/Dex_Pad` as the authoritative project repository. GitHub confirmed `main`, push permission, public visibility, and no files at preflight. Scaffold files are intended for initial publication there; the precise remote commit and publication outcome require a verified GitHub readback. Keep actual user notes, credentials, and vault material out of this public repository.

### 2026-10-25 — Local development-foundation implementation (sandbox evidence)

In an isolated container worktree, created a dependency-free local browser UI and modular JS domain for **synthetic data only**: notes, projects, decisions, simulated contributions, immutable revision records, evidence states, optimistic revision checks, local full-text filtering, archive/restore, JSON export and local IndexedDB adapter. Created a 50-item machine-readable feature roster (25 core, 25 new), human-readable matrix, Superpowers design and implementation plan, developer quickstart, GPT write-only architecture, CI workflow and operational state.

### 2026-10-26 — Empirical browser smoke validation and baseline repair

Established isolated implementation branch `feat/dexpad-development`. Successfully ran `tests/browser_smoke.py` and the 18-step interactive browser verification suite on macOS with native Playwright Chromium against loopback server `http://127.0.0.1:4173`. Diagnosed and resolved a baseline defect in `src/ui/app.js` where revision restore buttons remained disabled following save operations due to `saving` flag lifecycle scoping. IndexedDB persistence across reload, revision restoration, full-text search, evidence gate enforcement, and responsive layout verified empirically on live browser runtime.

### 2026-10-26 — Synthetic DEX//RELAY event ingestion bridge delivered

Implemented synthetic read-only DEX//RELAY event ingestion bridge in `src/integrations/relay/` and project activity timeline in the UI. Created 13 automated tests in `tests/relay-bridge.test.mjs` verifying schema validation (`dex-relay.event.v1`, `dex-relay.task.v1`), sequence chain tracking, hash continuity, duplicate idempotency, conflict rejection on mismatched payload, oversized payload rejection, out-of-order handling, cross-project isolation, secret/credential sanitization, unverified claim status separation, and bridge disabling isolation. Integrated interactive timeline into project view in `src/ui/app.js` and `index.html` labeled with `SYNTHETIC RELAY EVENTS — NOT LIVE EXECUTION`. F21 status advanced to `dev-prototype`. Full test suite passing (33/33 tests).

### 2026-10-26 — Encrypted vault cryptographic proof delivered

Implemented complete Web Crypto API cryptographic subsystem in `src/core/crypto/primitives.js` and `src/core/crypto/vault.js` with 12 automated proof tests in `tests/vault-crypto.test.mjs`. Verified: (1) vault identity creation and versioning (`dex-vault.v1`), (2) PBKDF2 + HKDF-SHA256 separated key hierarchy (MK, VK, AK, RK, PK, IK), (3) AES-256-GCM AEAD encryption with canonical AAD record binding, (4) ciphertext-only storage at rest (`createEncryptedStore`), (5) unique CSPRNG nonces per write, (6) lock/unlock memory hygiene, (7) rejection of incorrect credentials (`InvalidCredentialsError`), (8) tamper detection on bit-flips and metadata alteration (`TamperedCiphertextError`), (9) emergency recovery code unwrapping (`recoverVault`), (10) unrecoverability without recovery material, (11) proof of relay confidentiality against unauthorized decryption, and (12) format versioning (`dex-record.v1`). Full test suite passing (45/45 tests). C02 remains marked `planned` pending external security audit and production key lifecycle review.

### 2026-10-26 — Cross-device encrypted sync engine and fault matrix delivered

Implemented deterministic encrypted synchronization protocol and synthetic relay in `src/core/sync/engine.js` with 8 comprehensive fault-injection tests in `tests/sync-engine.test.mjs`. Verified: (1) offline writing and durable local operations, (2) private ciphertext-only relay transport, (3) scrambled/reordered frame buffering without state corruption, (4) 100x duplicate replay idempotency, (5) interrupted transfer resume from cursor, (6) concurrent offline divergent edit conflict branching with zero data loss, (7) device pairing and immediate revocation enforcement, and (8) truthful acknowledgment distinction (`RELAY_STORED` vs `PEER_APPLIED`). Full test suite passing (53/53 tests). C03 remains marked `planned` until live three-device convergence over Tailscale is verified on physical hardware.

Local evidence: `npm run check` passed (20/20 Node tests, documentation, feature roster and static build). Chromium static render at 1440px and 390px widths passed without horizontal overflow. **Functional browser smoke not run successfully:** the container's Chromium returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` when navigating to localhost, even when routing static responses through Playwright. Native IndexedDB, real Android lifecycle, E2EE, cross-device sync, actual GPT MCP, Standard Notes migration and backup/restore remain unverified/unimplemented.

Do **not** infer GitHub publication from local files: wait for a remote commit receipt and source-tree readback. The repo is public and contains no real vault material.
