# Build roadmap - gate-driven, not calendar promises

## Development preview (synthetic-only exception)

The first repository runnable browser code deliberately uses plaintext development storage. This is a tool for developing UI and transactional logic; it is not an encrypted vault and does not satisfy Phase 0. See [Developer Quickstart](DEVELOPER_QUICKSTART.md), [Full Feature Matrix](FEATURE_MATRIX.md) and [GPT Write-Only Contract](GPT_WRITE_ONLY.md).

## Phase 0 — Security/sync proof (must precede production notes)

Deliver: threat model review, key lifecycle specification, two competing local-first sync prototypes, fault-injection harness, performance matrix, explicit ADR. Gate: crash/replay/restore tests meet SYNC-LAB acceptance criteria. Stop if data loss is observed until diagnosed.

## Phase 1 — Trustworthy Standard Notes replacement

Deliver: unlocked editor; durable local journal; local full-text search; tags and pinned items; encrypted pair/revoke UX; foreground sync + inspector; verified backup restore; Standard Notes isolated import. Gate: three real devices can edit offline, converge safely, recover historical versions, and export all records with zero silent import losses.

## Phase 2 — Knowledge objects and connections

Deliver: stable typed objects; link references; backlinks; spaces; saved filtered views; command palette; lightweight project dashboards. Gate: multiple views reference one underlying item, with correct permissions and no duplicated record divergence.

## Phase 3 — Evidence and capture

Deliver: Android share sheet / desktop capture; link and article clipping; original source metadata; attachments; file hashes and provenance; read-it-later. Gate: recover source text and original metadata from offline export; no unauthorized network fetches.

## Phase 4 — Capability integrations

Deliver: typed read/create/query/event API; per-space app grants; audit receipts; local AI index bridge behind explicit unlock; DEX//REACH, DexVault and WorldsVault adapters in independently authorized repositories. Gate: restricted client cannot read another space or retrieve vault key; disabling integrations never blocks basic notes.

## Phase 5 — Optional advanced lenses

Deliver only after usage proves value: spatial canvas, research collections, blocks, stylus ink, automation, local semantic search, collaborative sharing. Gate: opt-in complexity; no regression in capture/latency/recovery/security.

## Release readiness

- Functional: all affected journeys tested on actual Android phone/tablet and MacBook, including force-stop and cold start.
- Cryptography: external review needed before trustworthy E2EE marketing claims.
- Data safety: successful repeatable independent encrypted backup restore and cross-version migration.
- Operations: one-command private install path; easy upgrades, rollback, health checks, logs without content leakage.
- Licensing: dependency/license audit and explicit repository license decision before opening to public contributions.
- Evidence: tracked CI and local test commands, environment/versions, unverified areas explicitly labeled.
