# DEX//Pad agent contract

Read README.md, OPERATIONAL_STATE.md, PROJECT_STATE.md, docs/DECISIONS.md, docs/SECURITY.md, docs/SYNC-LAB.md, docs/ROADMAP.md, and planning/features.json before any substantive change.

## Protected invariants

- Never claim notes are saved until the local write is durable. A UI timer or pending Promise is not proof of persistence.
- Do not commit credentials, tokens, raw exports, decrypted user notes, private keys, test secrets, or actual personal content.
- Keep E2EE cryptography and its public metadata model explicit; never design a server pathway to plaintext for convenience.
- A device's cryptographic revocation cannot erase previously acquired plaintext; state this limitation in UX and docs.
- Do not add cloud-based AI, telemetry, exposed WAN listeners, Docker dependency, or payment services without specific authorization.
- Never make project integrations a precondition for opening or editing notes.
- Do not silently import, overwrite, delete, or normalize Standard Notes originals.
- No changes to existing DEX//REACH, DexVault, or WorldsVault repositories without separately scoped authorization.
- If a CRDT merges mechanically but changes meaning, retain an inspectable revision path and offer human recovery.
- Treat the product's visible name as DEX//Pad; the canonical GitHub repository is westkitty/Dex_Pad.

## Evidence discipline

Classify each nontrivial assertion as **proposed**, **implemented**, **observed**, or **verified**. Maintain test commands, environment identity, dates, and failures in PROJECT_STATE.md. Do not label planning docs as a deployed app.

## Development order

1. Threat model and key hierarchy design review.
2. Minimal local durable write + restart proof.
3. Two independent sync engine experiments with the same harness.
4. Three real-device convergence, crash, failure, and restore proof.
5. Minimum reliable notes UX and tested migration.
6. Typed knowledge, source provenance, and scoped integrations only after the core is safe.

## Git hygiene

Use small commits tied to explicit acceptance criteria. Run repository-specific tests before committing. No automatic push, release, public exposure, or deployment unless authorized. Keep rollback and existing user data protected.

## Development sandbox boundary

The browser application in `src/` is an unencrypted **synthetic-only** development scaffold. Never present the demo as production E2EE, cross-device sync, Standard Notes replacement, or working GPT integration. The source feature roster is `planning/features.json` and the generated `docs/FEATURE_MATRIX.md`. Execute `npm run check` and, on supported machines, the Playwright browser smoke. A browser policy failure must remain UNVERIFIED, not be reclassified as PASS.
