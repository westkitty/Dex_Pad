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

- Pure domain Node tests (33/33) for creating records, search, immutable revisions, optimistic concurrency, evidence references, simulated contribution idempotency, failing writes, and synthetic DEX//RELAY event ingestion.
- Synthetic DEX//RELAY event ingestion bridge (`src/integrations/relay/`): deterministic schema validation (`dex-relay.event.v1`, `dex-relay.task.v1`), strict sequence continuity and hash-chain tracking (`streamIntegrity`), idempotency preservation with conflict rejection on payload mismatch, strict project isolation, secret/credential payload sanitization, separation of claims from independent cryptographic proof, and project timeline visualization with explicit `SYNTHETIC RELAY EVENTS — NOT LIVE EXECUTION` disclaimer.
- Static read-only server unit tests reject unsafe paths/write requests and serve required file types with CSP.
- Build/feature registry tests ensure source assets, integration files, and all 25 expansions are present.
- Real Chromium browser smoke (tests/browser_smoke.py and 18-step interactive test): verified end-to-end UI rendering, IndexedDB write and reload persistence, revision increments, local full-text search, archive/unarchive revision restoration, project resume cards, relay timeline card rendering and blocker state display, decision evidence gate, contribution inbox idempotency, mobile (390px) and desktop (1280px) responsive layouts without horizontal overflow, zero console errors, zero cross-origin leaks.
- Repaired baseline UI defect where revision restore buttons remained disabled after saving.

## Implemented development prototypes (unverified against production)

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
