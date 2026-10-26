# DEX//Pad: Full Feature Program

**50 contracts total: 25 new additions plus 25 core capabilities.**

This table is generated from `planning/features.json`. It is a **development backlog, not proof of delivery**.

Status meanings: `planned` = specification only; `dev-prototype` = development-only partial implementation; `verified` = complete end-to-end proof with evidence.

## Release gates

- **P0** - Trust and sync fault lab
- **P1** - Usable encrypted notes replacement
- **P2** - Project continuity and human knowledge workflow
- **P3** - Scoped integrations and device handoffs
- **P4** - Research evidence and source preservation
- **P5** - Optional advanced capabilities after product use

## Core capabilities

| ID | Capability | Phase | Status | Depends on | Acceptance |
|---|---|---|---|---|---|
| C01 | Durable local notes | P1 | dev-prototype | - | A synthetic note survives reload, forced interruption after acknowledged commit, and exact local search on a supported client. |
| C02 | Encrypted client vault | P0 | planned | - | Ciphertext only is persisted; independent review verifies key lifecycle, nonce management, lock behavior, and tampering rejection. |
| C03 | Encrypted cross-device relay | P0 | planned | C02 | Three real devices converge through a private no-Docker relay under reordered, duplicated, and interrupted encrypted updates. |
| C04 | Local keyword search | P1 | dev-prototype | C01 | Unlocked client searches a 10k-note corpus with measured latency and no server-side plaintext index. |
| C05 | Tags and pinned records | P1 | dev-prototype | C01 | Tags remain portable and consistent across edits; pinning follows explicit, tested order without duplicating records. |
| C06 | Immutable revision history | P1 | dev-prototype | C01 | Every accepted edit creates a recoverable revision; restoring a version appends a new revision instead of deleting history. |
| C07 | Independent encrypted backup restore | P1 | planned | C02, C06 | A fresh client restores an independently held encrypted snapshot and compares full record, attachment, and key-epoch checksums. |
| C08 | Non-destructive Standard Notes migration | P1 | planned | C01, C07 | An isolated import reports unsupported formats and mismatches, round-trips supported records, and never deletes source data. |
| C09 | Universal capture inbox | P1 | dev-prototype | C01 | A titleless synthetic note can be captured without categorization; later adapters use the same validated submission contract. |
| C10 | Typed knowledge objects | P1 | dev-prototype | C01 | Notes, projects, and decisions use stable IDs; new kinds are versioned without breaking existing exported items. |
| C11 | Backlinks and stable relations | P2 | dev-prototype | C10 | Renaming or moving an item preserves incoming links, including cross-space permission checks and broken-target indicators. |
| C12 | Original-source ledger | P4 | planned | C10 | Imported material retains original URI, file hash, timestamps, authority label, and derived-record relationships. |
| C13 | Revocable scoped integration service | P3 | planned | C02, C03, C25 | An external identity cannot read outside its grant, cannot retrieve the vault key, and loses future operations when revoked. |
| C14 | GPT write-only contribution tool | P3 | dev-prototype | C25 | A real MCP tool can create submissions without exposing any read/list/search method, enforced by server authorization. |
| C15 | Encrypted attachments | P4 | planned | C02 | Attachment bytes and metadata are independently recoverable and encrypted, with bounded size and safe previews. |
| C16 | Portable export and import | P1 | dev-prototype | C01 | JSON/Markdown exports round-trip item identities, bodies, provenance, relations, and attachments; plaintext export requires consent. |
| C17 | Authenticated pairing and revocation | P0 | planned | C02 | A new device joins only after authenticated key exchange; revoked credentials cannot authorize future sync. |
| C18 | Truthful sync inspector | P1 | planned | C03 | Saved-local, relay-acknowledged, and peer-applied states are independently demonstrated under interrupted networks. |
| C19 | Android lifecycle and share-sheet bridge | P1 | planned | C03 | On real phone/tablet, force-stop recovery and foreground catch-up pass; share sheet capture preserves content without lost saves. |
| C20 | Optional local semantic retrieval | P5 | planned | C11, C02 | Semantic indexes can be deleted and rebuilt from selected authorized items without endangering notes or requiring a cloud API. |
| C21 | Concurrent-edit semantic recovery | P0 | planned | C03 | Two offline clients editing one item converge or surface a recoverable conflict; no accepted edit silently disappears. |
| C22 | Lost-device and key recovery | P1 | planned | C07, C17 | A simulated lost-device restore succeeds only with authorized recovery material; unrecoverable secrets are disclosed accurately. |
| C23 | Local operation and evidence log | P1 | dev-prototype | C01 | Every accepted revision records identity and action; a failed transaction produces no successful event receipt. |
| C24 | Peer-applied confirmation | P1 | dev-prototype | C03 | A receiving device cryptographically acknowledges applied revision before the sending UI labels it present on that device. |
| C25 | Contribution review inbox | P1 | dev-prototype | C01 | Synthetic write-only submissions have unique receipts, show origin, can be reviewed, and cannot retrieve existing items. |

## 25 additional capabilities

| ID | Capability | Phase | Status | Depends on | Acceptance |
|---|---|---|---|---|---|
| F01 | Project Resume Capsules | P2 | dev-prototype | C10 | A project opens to the latest recorded next action, blocker, repo reference, and evidence link without searching prior chats. |
| F02 | Evidence-State Labels | P2 | dev-prototype | C01 | Record states distinguish proposed, claimed, observed, verified and stale; verified requires a reference and remains manual. |
| F03 | Decision Memory | P2 | dev-prototype | C10, F02 | A decision records rationale, alternatives and superseding links; discarded decisions are visible without becoming current authority. |
| F04 | Repository-Anchored Margin Notes | P2 | planned | C11 | An annotation retains an immutable commit/path/range anchor and warns when viewing an unrelated newer revision. |
| F05 | Incident Cards | P2 | dev-prototype | F02 | An incident preserves the original failure, reproduction, confirmed repair, and reusable regression proof in one record. |
| F06 | One-Tap Agent Handoff | P2 | dev-prototype | F01, C16 | Only user-selected items become a portable, bounded task packet with constraints, evidence states and exact sources. |
| F07 | Note to GitHub Issue | P3 | planned | C13, F06 | A previewed issue draft is published only to the named repository with explicit confirmation and idempotent receipt. |
| F08 | Outstanding Commitments | P2 | dev-prototype | C10 | A pending obligation has owner, expected outcome and review date without creating a full duplicate task system. |
| F09 | Interactive Runbook Cards | P2 | planned | F08, F02 | A runbook lists steps, expected checks, stop conditions and rollback; execution remains manual unless separately authorized. |
| F10 | Continue on Another Device | P3 | planned | C03, F01 | A second trusted device reopens the same project/item and scroll context only after authentic peer synchronization. |
| F11 | Deep Citation Anchors | P4 | planned | C12 | A citation stores the exact page, line or section when supported, with origin snapshot and stale-target detection. |
| F12 | Image Region Notes | P4 | planned | C15 | An annotation stays attached to normalized image coordinates across device sizes without modifying the source bytes. |
| F13 | Timecoded Media Notes | P4 | planned | C15 | Timestamp annotations open a compatible audio/video source near the selected time and survive export. |
| F14 | Evidence Freshness Rules | P4 | planned | C12 | A source-linked claim becomes needs-review on a configured expiry or source revision, not silently false/true. |
| F15 | Contradiction and Duplicate Review | P4 | planned | C11 | Potential duplicates and mismatches are presented with source provenance and never auto-merged or deleted. |
| F16 | Watch This Source | P4 | planned | C12, C13 | An approved watcher submits only an authorized change receipt; disabling it leaves capture and search intact. |
| F17 | Project Reading Radar | P4 | planned | C12 | Selected source feeds appear in one project context without creating a compulsory general-purpose RSS reader. |
| F18 | What Changed Since I Was Here | P2 | dev-prototype | C23, F01 | A project reopen displays revisions since last visit from actual recorded events, separating observations from inferred impact. |
| F19 | Remember This Later | P5 | planned | F08 | A selected note resurfaces at an explicit interval with skip/postpone controls and no compulsive notification loops. |
| F20 | Downstream Review Hints | P5 | planned | C11, F14 | A changed source flags dependent notes for user review without silently rewriting authoritative material. |
| F21 | DEX//REACH Result Receipts | P3 | dev-prototype | C13, F02 | A sanitized receipt links one verified job result to a project with no raw secrets, delegated terminal access, or invented success. |
| F22 | DexDictate Capture Route | P3 | planned | C13, C25 | Only explicitly submitted transcribed text enters a destination inbox with origin and no shared dictation microphone permission. |
| F23 | Selective Git Publication | P3 | planned | C13, C16 | A redacted diff for a named document is previewed and approved before a scoped commit or draft PR; private vault never mirrors wholesale. |
| F24 | Portable Offline Project Kits | P5 | planned | C15, C02 | An authorized client packs selected encrypted records and attachments with a verifiable manifest and successful offline restore. |
| F25 | Quiet, Actionable Alerts | P5 | planned | F08, C13 | A user-chosen condition produces a minimal authenticated alert, and no body/content leak or persistent spam occurs. |

## Execution rule

One cohort is implemented and validated before widening scope. P0/P1 privacy and durability gates must pass before any personal data or external integrations are allowed.
The synthetic demonstration facade does not grant an actual GPT connection access to the vault.

## Source of truth

Edit `planning/features.json`, then run `node scripts/render-feature-matrix.mjs --write`. `npm run check` refuses stale generated documentation.
