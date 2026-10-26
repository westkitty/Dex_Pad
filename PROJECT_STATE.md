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