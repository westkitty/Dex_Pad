# Architecture decisions and hypotheses

Records here are planning decisions unless marked verified by implementation evidence in PROJECT_STATE.md.

## Accepted for product charter

- Product name: **DEX//Pad**; canonical GitHub repository **westkitty/Dex_Pad** (public at preflight).
- Local-first, fast capture and encrypted synchronization are core requirements.
- Personal knowledge object model is the desired extensibility foundation; simple note editing remains primary.
- Big Mac is the intended private relay, not the sole source of data or a plaintext broker.
- Integrations cannot be granted unconditional vault-level access.
- No Docker, iCloud dependency, public WAN service, or always-on MacBook compute for the initial intended deployment.
- Plan and tests must distinguish local saved state, relay acknowledged state, and other-device observed state.

## Open / do not freeze yet

| ADR | Question | Status | Decision criterion |
|---|---|---|---|
| ADR-001 | Yjs, Automerge, or item revision log? | EXPERIMENT | Sync-lab fault matrix + resource results |
| ADR-002 | Client shell: web/PWA, native Android, or hybrid? | EXPERIMENT | Background restrictions and real device UX |
| ADR-003 | At-rest and in-flight key hierarchy? | SECURITY GATE | Threat model, audits, rotation/recovery proof |
| ADR-004 | Markdown vs blocks as canonical editor storage? | EXPERIMENT | Portability, convergence, import fidelity |
| ADR-005 | Metadata minimization and ciphertext snapshots? | EXPERIMENT | Privacy/GC/long-offline recovery |
| ADR-006 | Repo license/publication? | USER DECISION | Code reuse strategy and intended distribution |
| ADR-007 | Direct file mirror to existing vaults? | DEFER | Source-of-truth authority and safe unidirectional adapter |

## Explicit anti-decisions

- No automatic last-write-wins overwrites for concurrent content without revision recovery.
- No invented cryptography or permanent server-held master key.
- No auto-import replacing existing source files.
- No claim of complete privacy from ciphertext when metadata may leak.
- No Android background timing promise the OS cannot guarantee.

## Development-only architecture decision (2026-10-25)

**ADR-008 — Use a zero-dependency, plaintext, local browser sandbox solely to establish runnable architecture, domain contracts and a development workflow.** This is a strictly synthetic-data experiment and does not supersede ADR-001 through ADR-005. It does not authorize personal-data use, network exposure, real GPT access or any change to the encrypted client requirements. Build/runtime readiness and cryptographic production readiness have separate gates. Reassess final framework packaging after sync/security prototype evidence.
