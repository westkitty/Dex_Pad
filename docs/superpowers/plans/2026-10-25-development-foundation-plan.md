# DEX//Pad Development Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the first runnable, deliberately unencrypted developer sandbox while preparing an evidence-gated backlog for the full project and GPT write-only contribution path.

**Architecture:** Dependency-free browser UI with IndexedDB transaction adapter, pure domain module, and separate write-only contribution facade. A static localhost-only Node server enables development; tests use a memory adapter and real Chromium smoke run. Cross-device encryption and sync remain future gated phases.

**Tech Stack:** Native ES modules; browser IndexedDB; Node.js >= 22; Python 3 for repository documentation verifier and optional Playwright browser smoke.

**Spec:** docs/superpowers/specs/2026-10-25-development-foundation-design.md

## Global Constraints

- Repository: westkitty/Dex_Pad; product name: DEX//Pad.
- Never store real personal notes in this unencrypted development sandbox.
- No Docker, iCloud, public WAN listeners, paid dependencies, or required external services.
- No changes to DEX//REACH, DexVault, WorldsVault, DexDictate, Standard Notes, or actual user data.
- Do not describe features, encryption, synchronization, MCP, backup or Android device tests as implemented unless proven.
- No automatic promotion of agent claims to verified status.

## Review Focus

- Duplicate create requests must not silently create multiple revisions of the same ID; test stable idempotent receipt.
- Stale revision writes must not overwrite newer edits; test mismatch error.
- Soft deletion and restoration must preserve both old and new revision state; test count and content.
- A database/quota failure must never be reported as Saved locally; test rejection through injected adapter.
- Untrusted note body may contain HTML/JS; browser must display it as text and never execute it; test with synthetic payload.

---

### Task 1: Define data invariants and memory-backed tests

**Files:** Create `src/core/workspace.js`, `src/storage/memory.js`, `tests/workspace.test.mjs`.
**Interfaces:** `createWorkspace(store,{now,id}) -> {create,update,remove,restore,history,list,exportData}`; `createMemoryStore() -> Store`; `Store.commit(item,event)`, `Store.getItem(id)`, `Store.listItems()`, `Store.listEvents()`, `Store.listRevisions(id)`.

- [ ] Write tests for create/query, version precondition, evidence reference, delete/restore, and failed store writes.
- [ ] Run `node --test tests/workspace.test.mjs`, confirm RED due to missing implementation.
- [ ] Implement minimal domain and memory store.
- [ ] Run test suite, confirm GREEN.
- [ ] Commit bounded change after full validation.

### Task 2: Build durable browser storage and a submission facade

**Files:** Create `src/storage/indexeddb.js`, `src/core/contributions.js`, `tests/contributions.test.mjs` and browser persistence smoke harness.
**Interfaces:** `openIndexedDbStore(name) -> Promise<Store>`; `createWriteOnlyGateway(workspace) -> {acceptContribution}`.

- [ ] Write tests requiring an opaque receipt, no read methods, and consistent provenance; confirm RED.
- [ ] Implement write-only facade and IndexedDB `commit` transaction spanning item/revision/event stores.
- [ ] Confirm GREEN and browser persistence after reload, using synthetics only.
- [ ] Commit bounded change after full validation.

### Task 3: Deliver accessible local UI and static development server

**Files:** Create `index.html`, `styles.css`, `src/ui/app.js`, `src/ui/dom.js`, `scripts/dev-server.mjs`, `tests/server.test.mjs`, `tests/browser_smoke.py`, `package.json`.
**Interfaces:** UI creates/edits/searches notes, projects, decisions and contribution inbox items through domain. Server exports `createServer({root,host})` and never exposes writing APIs.

- [ ] Write failing server tests and browser journey checks; verify RED.
- [ ] Implement server and UI with semantic controls, status indicators, plain text rendering and development warning.
- [ ] Run all tests, browser smoke and security/console checks; confirm GREEN or report missing evidence.
- [ ] Commit bounded change after full validation.

### Task 4: Full feature map and contributor-ready engineering workflow

**Files:** Create `docs/FEATURE_MATRIX.md`, `docs/DEVELOPER_QUICKSTART.md`, `docs/GPT_WRITE_ONLY.md`, `OPERATIONAL_STATE.md`, `scripts/build.mjs`, `scripts/check.mjs`, `.github/workflows/ci.yml`. Update `README.md`, `PROJECT_STATE.md`, `AGENTS.md`.
**Interfaces:** `npm run dev`, `npm test`, `npm run build`, `npm run check`; all roadmap feature IDs must have a phase, acceptance and status.

- [ ] Write a feature matrix check test that fails if IDs or phase fields are missing; confirm RED.
- [ ] Implement stable, self-contained backlog with explicit dependency and proof gates, no fake completion states.
- [ ] Make build use no network and copy source into dist for offline static deployment.
- [ ] Run full tests/build/documentation check and inspect local Git diff for accidental secrets.
- [ ] Commit bounded change after full validation.

### Task 5: Publish and verify scoped repository update

**Files:** Above only; record final result in `PROJECT_STATE.md`, `OPERATIONAL_STATE.md`, project Bible.

- [ ] Reconcile GitHub `main` head and only the authorized local changes.
- [ ] Publish via GitHub connector after tests; avoid force pushes and external project mutation.
- [ ] Re-fetch target source tree, README, CI, tests and latest commit ID; compare file presence.
- [ ] Verify current CI run if available; otherwise label remote CI unverified.
- [ ] Report completed versus planned features and the next high-priority security/sync experiment.

## Execution checkpoint (2026-10-25)

- Task 1 domain/memory tests: RED module-not-found observed, GREEN 12 core and contribution tests; implementation exists.
- Task 2 contribution facade plus IndexedDB code: unit facade tests passed; native browser IndexedDB durability remains UNVERIFIED because browser navigation was blocked.
- Task 3 static server, UI, responsive styling: server Node tests passed, static desktop/mobile Chromium layout checked; functional Playwright browser journey remains UNVERIFIED and is retained as `tests/browser_smoke.py`.
- Task 4 feature matrix, docs, build and CI: all 25 additions are represented within 50 machine-readable contracts; generator, Node tests and static build pass. CI remote execution remains unverified until the repository is updated.
- Task 5 publish: pending remote verification at this checkpoint. No production encryption, sync or mobile claims.
