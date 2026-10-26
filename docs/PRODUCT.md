# Product charter — DEX//Pad

## Thesis

A notes app that feels immediate, becomes a personal knowledge system when invited, and remains useful without its server or integrations. It must not turn a quick thought into a form-filling exercise.

## Target devices and operating principles

- Samsung Android phone and Galaxy Tab S9 Ultra: touch-first, responsive, readable, reliable through process suspension. Stylus later, not first-run critical.
- MacBook Air (M1, 8 GB RAM): low memory overhead, responsive keyboard navigation, no local model inference requirement.
- Big Mac: optional always-on private relay and encrypted backups, not the authoritative copy of plaintext.
- Local-first and tailnet-available. Never assume permanent WAN or iCloud.

## Differentiating product mechanisms

### Capture-first home

Open directly into a usable composer. A capture can be untitled and unclassified. One inbox accepts notes, web URLs, snippets, tasks, files and imported items. Capture surfaces eventually include Android share sheet, desktop hotkey, clipboard, browser extension and scoped API.

### Knowledge objects + lenses

Underlying objects have stable IDs, typed properties, encrypted payloads, revision lineage and references. Lenses show the same objects as notebook, inbox, project, timeline, filtered table, board or canvas. Views never fork the source item. Default note mode stays intentionally simple.

### The source ledger

Every imported source can retain original URI, original bytes/hash where legitimate, capture time, transform history, authority label, and links to derivative notes. A summary is never silently promoted to the original source. For canonical external files, store a reference and declared ownership rather than auto-replacing that project's authority.

### Recovery console

Expose exact local/remote revision state, pending updates, failure reasons, last successful backup, restore options, and per-device diagnostics. Phrase errors in actions users can take, not technical jargon alone. The simple status may say Saved locally, Syncing, Synced, or Needs attention; never say Synced before confirmed acknowledgment.

### Privacy cockpit

Show trusted devices, per-space access grants, decrypted-session status, app-level capabilities, key-rotation/revocation history, and local-only integration approvals. No third-party code obtains a master vault key.

### Discovery without lock-in

Keyword search runs over permitted local decrypted content while unlocked. Backlinks and stable object references enrich navigation. Semantic search is a separable, optional derived index; deleting it must not delete any notes.

### Quiet automation

Explicitly authorized incoming capture rules can label, route or enqueue records for review. No silent AI edits or opaque write agents. Changes produced by automation carry provenance and are reversible.

## First-run UX

1. Create or unlock encrypted vault locally.
2. Display editor immediately and enable a saved-local feedback state.
3. Offer pairing to Big Mac relay without making it mandatory.
4. Pair additional devices with authenticated key exchange and clear trust confirmation.
5. Let users inspect the sync/backup state without entering admin panels.
6. Keep imports in an isolated verification staging area until counts and content checks pass.

## Explicit non-goals for v1

Multiuser collaboration; public publishing; AI-required editing; hosted SaaS; vector-search infrastructure; rich whiteboards; arbitrary plugins; integrated browser automation; attachment OCR; paid accounts; cloud cross-account sync; complex custom databases.

## Proposed UX acceptance targets — unmeasured

- On a warmed and unlocked real device, first editable interaction begins within 350 ms p95 after app foregrounding (hardware-dependent; measure and refine).
- Locally persisted simple edits survive forced termination before any server acknowledgment.
- Foreground encrypted small-note sync targets 1 s p95 over healthy tailnet, measured separately for phone ↔ relay ↔ MacBook; background is best effort, not instant-guaranteed.
- Search over 10,000 indexed short notes targets 200 ms p95 on a supported warmed client. Exclude decrypt/unlock time and report dataset/device.
- Every destructive action offers undo or recovery appropriate to its semantics.
- Starting a note requires zero mandatory tags, project selection, or title entry.