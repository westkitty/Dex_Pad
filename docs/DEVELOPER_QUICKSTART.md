# DEX//Pad Developer Quickstart

## First, know the boundary

This is a **DEVELOPMENT SANDBOX** with plaintext IndexedDB storage. It accepts synthetic data only. Do not enter real passwords, personal notes, private research, credentials, or vault material. It is not an encrypted note replacement, has no cross-device sync, and does not connect to ChatGPT or Big Mac.

The public repository is `https://github.com/westkitty/Dex_Pad`. No Docker, paid account, iCloud or always-on MacBook service is required to develop the local prototype.

## Requirements

- Node.js 22 or newer, git, a current Chromium-class browser.
- Python 3 is used for documentation validation only. The local development server uses Node's standard library.
- No `npm install` is required: the foundation intentionally has **zero third-party runtime or development dependencies**.

## Start on the MacBook

From a terminal, clone the repository with one command:

```sh
git clone https://github.com/westkitty/Dex_Pad.git
```

From within the cloned folder, run:

```sh
npm run dev
```

Open `http://127.0.0.1:4173` in the MacBook browser. The server intentionally binds **loopback only**. No public exposure or tailnet serving is configured.

## Verify

From within the repo:

```sh
npm run check
```

This checks the feature registry, validates local documentation links, executes Node unit/contract tests, and builds static frontend assets into the ignored `dist/` folder. It does not prove any cryptography or device synchronization.

For a local browser smoke test on a machine with Python Playwright and Chromium available, start the dev server and then run:

```sh
python3 tests/browser_smoke.py
```

If a browser's network policy blocks localhost, use the static visual check instead. Static visual checks do **not** prove app functionality:

```sh
python3 tests/visual_smoke.py
```

## File map

| Path | Purpose |
|---|---|
| `src/core/workspace.js` | Record validation, revisions, decisions, search and export domain |
| `src/core/contributions.js` | Simulated write-only contribution facade (not a real plugin) |
| `src/storage/indexeddb.js` | Browser-local atomic transaction adapter; currently plaintext |
| `src/storage/memory.js` | Deterministic test data store |
| `src/ui/app.js` | Browser interactions, error/status views, project resume card |
| `index.html`, `styles.css` | Static responsive application interface |
| `scripts/dev-server.mjs` | Read-only static HTTP server, loopback-only |
| `scripts/build.mjs` | Copies only allowlisted browser assets into `dist/` |
| `planning/features.json` | Canonical 50-feature development roster with dependencies |
| `docs/FEATURE_MATRIX.md` | Generated human-readable feature matrix |
| `docs/superpowers/specs/` | Design contracts with trust boundaries |
| `docs/superpowers/plans/` | Task-by-task development plans |
| `docs/GPT_WRITE_ONLY.md` | Deferred GPT write-only integration architecture |
| `OPERATIONAL_STATE.md` | Current truth of tested versus unverified functionality |
| `PROJECT_STATE.md` | Append-only project history and source continuity |

## Day-one development workflow

1. Read `AGENTS.md`, `OPERATIONAL_STATE.md`, the active design specification and the relevant plan.
2. Pick **one** feature ID from `planning/features.json`. Check its dependencies, security gate and acceptance condition.
3. Work in an isolated branch/worktree. Write a failing test and observe the expected failure.
4. Implement only that feature's bounded behavior. Preserve offline/UX invariants and old user data.
5. Run `npm run check`, browser smoke on intended hardware when relevant, and diff/secret review.
6. Update the feature status **only** when the stated acceptance has real proof. `dev-prototype` is not `verified`.
7. Update `OPERATIONAL_STATE.md` and append an entry to `PROJECT_STATE.md` as needed. Push only to the intended repository and branch.

## Building the complete product without an endless rewrite

- **Stage 0:** Prove local encrypted storage, key lifecycle, independent restore and a multi-device sync protocol with synthetic data.
- **Stage 1:** Replace this plaintext data store with an encrypted adapter. Only after the security gate passes may the app be used for real notes.
- **Stage 2:** Implement core notes, import/export and source-of-truth protection to production quality.
- **Stage 3:** Add the six high-value Project Continuity capabilities, then the GPT write-only bridge and selected external adapters.
- **Stage 4:** Execute the remaining feature backlog one feature at a time. Every entry in `planning/features.json` has acceptance criteria, but no feature is considered shipped merely because it is planned.

## Common failure modes

- **Browser says storage unavailable:** IndexedDB denied, blocked or unsupported. Do not fall back to an unsafe/in-memory fake and claim a save.
- **Stale revision:** Another view has committed a newer record. Reload/reconcile; do not overwrite without consent.
- **Save rejected:** Nothing is stored until transaction completion. Correct validation errors and press Save again.
- **No notes appear on Android:** The prototype has NO cross-device sync. Do not expose the server or claim mobile functionality.
- **Lost browser profile:** Unencrypted development records may be lost. Use synthetic fixtures and export only for tests. Proper backup/restore remains a gated future capability.

## No implicit permission to operate real systems

The source references DEX//REACH, GitHub, DexVault, WorldsVault and DexDictate as future adapters. It does not modify those projects or grant their credentials to any new code. Any adapter must be authorized, scoped, reversible and independently validated.
