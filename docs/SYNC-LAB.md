# Sync & encryption lab — Stage 0

**Purpose:** choose a verified sync foundation, not a popular library by reputation.

## Candidate routes

- **A — Yjs:** fast incremental text CRDT + local persistence. Evaluate ciphertext framing, rich-text migration, replay and compaction.
- **B — Automerge:** document CRDT and offline repo adapters. Evaluate ciphertext framing, update size, crash safety and compatibility.
- **C — simple item revision journal:** stable per-item versions with explicit conflicts for nonconcurrent editing; a useful counterexample for smaller datasets. Cannot claim automatic safe same-paragraph merging.

Structured-data libraries such as TinyBase may inform client views independently of the content CRDT choice. These are candidates, not endorsed architecture.

## Controlled test setup

- MacBook, Samsung phone, Samsung tablet, private Big Mac relay over Tailscale.
- Same corpus: 10,000 short notes; 50 longer Markdown notes; 100 attachments of mixed sizes; linked/referenced records; deliberately malformed updates.
- Verify environment IDs, versions, protocol, local DB schema, power settings, storage headroom and network conditions for every test.
- Capture traces without decrypted note bodies or credentials. Synthetic data only.
- Baseline and candidate measurements matched for hardware, workload, data size and foreground/background state.

## Mandatory fault matrix

| Test | Procedure | Pass condition |
|---|---|---|
| Local durability | Save then kill app before sync | Exact accepted edit survives restart |
| Offline create/edit/delete | Disconnect all clients then reconnect | No object permanently lost or unexpectedly duplicated |
| Concurrent paragraph | Edit same text on two devices | Deterministic convergence plus revision recovery |
| Concurrent metadata | Rename/tag/move from different devices | Explicit semantic rule and recoverable history |
| Replay/duplication | Deliver same event 100x | Exactly-once effect from at-least-once transport |
| Reordering | Deliver events out of order | No data loss; stable causal interpretation |
| Relay crash | Kill relay before/after fsync acknowledgment | Only persisted events acknowledged |
| Android termination | Terminate app during local write/transmit | No falsely acknowledged save; reconnect retries |
| Storage pressure | Fill client quota / exhaust relay disk | Visible error and no false saved/synced state |
| Offline for 30 days | Resume stale device after snapshot/GC | Safe reconciliation or explicit non-destructive recovery |
| Device revocation | Revoke, then replay stolen credential | No future authorized sync; limitation on prior plaintext documented |
| Key recovery | Lose device and restore on fresh client | Verified ability to decrypt permitted backup data |
| Snapshot corruption | Damage latest snapshot | Detect corruption and recover from prior verified state |
| Ciphertext tamper | Flip bytes or alter scope metadata | Authentication failure; no accepted bogus content |
| Import mismatch | Corrupt sample Standard Notes export | Incomplete import flagged, originals preserved |
| Schema forward compatibility | Load future fields on older client | Unknown data preserved or safe read-only mode |

## Metrics (targets, not achieved results)

- Foreground small-note end-to-end: p50 < 300 ms, p95 < 1 s under healthy tailnet; report actual per device.
- Warm unlocked local open-to-edit: p95 < 350 ms.
- Search over 10k synthetic short notes: p95 < 200 ms on each supported device.
- No acknowledged edit lost in 10,000 randomized crash/disconnect/replay operations (strong evidence, not a mathematical guarantee).
- No plaintext in relay database, snapshots or relay logs in instrumented inspection.
- Peak client memory, encrypted update bytes, relay CPU and battery usage compared across candidates.

## Winner selection

Mandatory gates (all must pass): correct persistence and restore, authenticated encryption, idempotent replay, semantic conflict recovery, acceptable Android lifecycle behavior, supportable no-Docker relay. Rank qualifying approaches on cold load time, foreground latency, memory, storage, implementation complexity and maintainability.

Stop after a bounded representative experiment; do not prototype elaborate UI before a security/durability winner exists.

## Source anchors

- https://docs.yjs.dev/getting-started/allowing-offline-editing
- https://automerge.org/docs/tutorial/local-sync/
- https://developer.android.com/develop/background-work/background-tasks/bg-work-restrictions