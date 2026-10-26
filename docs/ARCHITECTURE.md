# Proposed architecture — NOT IMPLEMENTED

## Trust boundaries

```
 Android phone          Android tablet           MacBook
 [client + local DB]    [client + local DB]     [client + local DB]
  private keys           private keys            private keys
  decrypt + search       decrypt + search        decrypt + search
         \                    |                     /
          \----- encrypted delta transport ------/
                           |
                [Big Mac relay over tailnet]
            auth + opaque event log + snapshots
                 no normal plaintext access
                           |
                 encrypted off-host backup
```

No encryption key should be shared with the relay merely to implement search, indexing, or integrations. Integration readers run inside a separate explicitly unlocked, authorized client context.

## Components

- **Client core:** item store; durable local transaction journal; ciphertext layer; sync adapter; local search (unlocked only); recovery/version presentation; import/export.
- **Relay:** device authentication; append-only encrypted update ingestion; monotonic sequencing or per-document cursors; encrypted object storage; ciphertext snapshots and compaction coordination; health endpoints with no private content.
- **Device onboarding:** device identity verification, recipient key wrapping, epoch management, recovery secret procedures, revoke and notify.
- **Application shell:** shared UI where practical; Android-specific shell or native app evaluated for system scheduling/share sheet; MacBook thin client as needed.
- **Integration gateway:** explicit capability grants, item/space scopes, revocation, local audit receipts; no blanket vault read API on the server.
- **Backup worker:** encrypted snapshots plus checked restore path independent of live event log.

## Data separation

- **Stable object envelope:** immutable ID, type, version, creator device, timestamps, relation IDs, key epoch, opaque payload reference. The JSON Schema in `specs/` is a draft public-facing interchange **proposal**, not an on-wire encryption envelope.
- **Content payload:** Markdown/plain text initially. Rich blocks must not be forced into the storage contract before interoperability and migration experiments.
- **Relations:** typed references with stable IDs and optional provenance. Cross-space relationships respect decrypt permissions.
- **Revision ledger:** immutable logical operations, explicit local durability state, acknowledged server state and idempotency key.
- **Tombstones:** deletion is a revision with retention and propagation policy; never physical erase while peers may be offline.
- **Derived indexes:** search/semantic caches rebuilt from authorized decrypted content; never treated as the source of truth.

## Sync protocol invariants

1. Local client must not acknowledge a save until its durable journal commit succeeds.
2. Each outgoing logical operation has a stable ID and is safe to retry without duplicate application.
3. Relay acknowledgments identify persisted ciphertext, not merely bytes received in memory.
4. Pull and push cursors are monotonic per clear scope; reconnects can replay safely.
5. Conflict handling distinguishes transport convergence from semantic correctness.
6. Snapshots/compaction cannot invalidate a device that has been offline longer than retention without a safe recovery path.
7. Schema migrations are versioned and do not destroy unknown fields or data.
8. Quota exhaustion, corruption, deleted browser storage and device loss have explicit user-facing outcomes.

## Source-of-truth discipline

DEX//Pad owns its native knowledge items and user edits. DEX//REACH is an optional orchestration client, DexVault an optional derived index, WorldsVault retains its file/canon authority. Importing a reference never silently changes the authoritative original.

## Performance and installation

Prefer a small no-Docker self-hosted Node service and SQLite database if the sync lab validates it. Avoid requiring MacBook to run models or always-on servers. Relay binds loopback and/or a scoped tailnet interface according to a separately verified network policy. Work with eventual offline device resumption; do not imply Android permits arbitrary uninterrupted background execution.

## Pending ADRs

- P1: Yjs vs Automerge vs simpler per-item protocol for non-coedited objects.
- P2: E2EE at rest across browser and native shells, key-management audit.
- P3: Shared web core vs Android native shell.
- P4: Long-term Markdown-first vs block editor compatibility.
- P5: Ciphertext compaction, metadata minimization and epoch rotation.

## Development foundation (2026-10-25)

A dependency-free browser **simulation** exists under `src/`. It provides a local IndexedDB adapter and separate domain/contribution modules. The local server is static, read-only and loopback-bound. This is not the encrypted client architecture above: IndexedDB is currently plaintext, and there is no remote relay. All work must honor the security and sync gates before real user data. See `OPERATIONAL_STATE.md` and `docs/DEVELOPER_QUICKSTART.md`.
