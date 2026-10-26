# DEX//Pad Operational State

project_id: Dex_Pad
project_name: DEX//Pad
status: development-foundation-in-progress
current_baseline: westkitty/Dex_Pad main, initial planning scaffold (17 files before this work)
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

## Verified in local container (limited scope)

- Pure domain Node tests for creating records, search, immutable revisions, optimistic concurrency, evidence references, simulated contribution idempotency and failing writes.
- Static read-only server unit tests reject unsafe paths/write requests and serve required file types with CSP.
- Build/feature registry tests ensure source assets and all 25 expansions are present.
- Static Chromium renders were checked at desktop and mobile widths for clipping; these do not exercise IndexedDB or JavaScript execution.

## Implemented but unverified

- End-to-end browser UI local persistence and interactions across reload. Real Chromium navigation in the container was blocked by administrator policy; browser smoke test must be run on an authorized machine.
- Native IndexedDB transaction behavior and mobile lifecycle. Unit tests use a memory adapter; no native browser IDB transaction proof is claimed.

## Known not implemented / do not claim

- Production E2EE and client-at-rest encryption; device key lifecycle and independent restore.
- Multi-device sync, server, conflict convergence, Android packaging/background behavior.
- Actual GPT MCP connector, external integrations, Standard Notes migration.
- Production-ready backups, rich knowledge features, release deployment.

## Next proof gate

On a machine that can browse localhost, run `npm run dev` and `python3 tests/browser_smoke.py` (with Playwright installed). Resolve any observed UI/IDB defects before trusting even synthetic local use. Then run the independent cryptographic/key-recovery and sync protocols lab described in `docs/SYNC-LAB.md`, with synthetic data and real devices.

## Current authority and delivery

Main GitHub repo `westkitty/Dex_Pad` is public. No real private data belongs there. Publication and CI verification need a fresh readback after updating the source. New source files and docs are not evidence of successful deployed behavior.
