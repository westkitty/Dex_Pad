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

- Pure domain Node tests (45/45) across workspace, gateway, build, feature registry, synthetic DEX//RELAY ingestion, and encrypted vault cryptography.
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
- Build/feature registry tests ensure source assets, crypto modules, integration files, and all 25 expansions are present.
- Real Chromium browser smoke (tests/browser_smoke.py and 18-step interactive test): verified end-to-end UI rendering, IndexedDB write and reload persistence, revision increments, local full-text search, archive/unarchive revision restoration, project resume cards, relay timeline card rendering and blocker state display, decision evidence gate, contribution inbox idempotency, mobile (390px) and desktop (1280px) responsive layouts without horizontal overflow, zero console errors, zero cross-origin leaks.
- Repaired baseline UI defect where revision restore buttons remained disabled after saving.

## Implemented development prototypes (unverified against production)

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
