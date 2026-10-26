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

Local evidence: `npm run check` passed (20/20 Node tests, documentation, feature roster and static build). Chromium static render at 1440px and 390px widths passed without horizontal overflow. **Functional browser smoke not run successfully:** the container's Chromium returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` when navigating to localhost, even when routing static responses through Playwright. Native IndexedDB, real Android lifecycle, E2EE, cross-device sync, actual GPT MCP, Standard Notes migration and backup/restore remain unverified/unimplemented.

Do **not** infer GitHub publication from local files: wait for a remote commit receipt and source-tree readback. The repo is public and contains no real vault material.
