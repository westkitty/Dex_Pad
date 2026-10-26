# DEX//Pad: GPT Write-Only Integration Contract

**Status: architecture design and simulation only. No MCP server or production integration has been built or verified.**

## Goal

Permit GPT to *submit* new documents, append content to one explicitly authorized existing document, or propose a bounded edit. Do not permit GPT to search, list, fetch, read, export or delete personal vault content.

## The core separation

1. **Contributor:** GPT produces a new submission using data already present in its conversation. Existing DEX//Pad content is unavailable.
2. **Ingress gateway:** Authenticates the contributor; validates bounded payload, idempotency key, destination and size; emits an opaque receipt. It has no vault master key, search index or general read API.
3. **Encrypted queue:** A production gateway must encrypt to a destination public key or use another reviewed recipient-encryption design before it persists a submission. No plaintext ingestion log.
4. **Trusted client:** Authenticated DEX//Pad device unlocks the destination space, reviews the submission, applies a selected operation, and records an immutable revision.
5. **Synchronization:** The resulting revision uses the normal encrypted sync protocol. If a trusted device is offline, response is `queued` rather than falsely `applied`.

## Proposed tool interfaces (not live)

| Tool | Input | Response | Allowed effect |
|---|---|---|---|
| `capture_to_inbox` | requestId, title, body, optional project hint | opaque receiptId + queued/denied | New item in explicitly authorized contributions inbox |
| `append_to_selected` | requestId, one-use grantId, appendText, expectedRevision | receiptId + queued/conflict/denied | Trusted client appends to the single selected item |
| `propose_revision` | requestId, one-use grantId, replacement, expectedRevision and approved selection hash | receiptId + queued/review/denied | A previewable change proposal, never blind global rewrite |

**No tools:** `get_note`, `list_notes`, `search_notes`, `read_vault`, `export_vault`, `get_note_titles`, `delete_note`, `execute_command`.

The server must also lack authority to run those operations. Merely omitting read tool names from the MCP manifest is NOT a security boundary.

## One-use grant properties

- Bound to authenticated user and contributor identity, destination item/space, operation, expected revision, bounded payload and expiry.
- Single use: atomically marked consumed upon first successful application; duplicate requestId returns only an idempotent receipt.
- Not recoverable by guessing item IDs or walking a list endpoint. A grant cannot be escalated to a different item or space.
- Stored by trusted authorization service, not revealed as an unrestricted bearer key inside the conversation text.
- Revocation invalidates all unused grants; queued but unapplied actions are rechecked at application time.

## Editing without reading

True semantic rewriting requires knowing text. DEX//Pad therefore uses one of three explicit modes:

- Append-only: GPT supplies new text; trusted DEX//Pad client appends without exposing existing content.
- User-selected excerpt: user voluntarily provides selected text to GPT for a revised proposal. No broader vault access follows.
- Local processing: GPT supplies instructions; a separately authorized local transformation engine reads only the selected excerpt and applies a previewable proposal.

If there is no trustworthy selected target, the action must become a new contribution. Never silently rewrite a note based on a guessed name.

## GPT/ChatGPT platform adapter

The adapter should be a private custom MCP plugin if the current eligible ChatGPT environment exposes the required controls. Check OpenAI's latest custom MCP documentation before implementation; plan and entitlement can change. For a private Big Mac, consider an **outbound** tunnel if officially supported. This optional path makes outgoing contact with OpenAI but must never open a public inbound vault listener.

The plugin response contains **only** operation result, opaque receipt and coarse failure class. A successful encrypted queue submission is not proof that a device received or applied the change.

## Present demonstration state

`src/core/contributions.js` exposes an in-process `acceptContribution` operation and nothing else. It is used by the local synthetic demonstration button. The corresponding `src/core/workspace.js` implementation internally reads only the deterministic contribution ID to enforce idempotency. This is **not** cryptographic isolation, external authorization, cross-process sandboxing or an installed GPT plugin.

## Test contract before activation

1. All forbidden read/list/search/export routes are absent from the plugin surface AND unreachable under its server identity.
2. Authorization can be revoked, expires, and is limited to a space/item/operation; forged grant is denied.
3. Duplicate submissions do not create duplicates or change existing receipts.
4. Queue payloads are encrypted under a reviewed design and do not leak contents through logs, errors or receipt metadata.
5. Offline and locked clients never falsely report an edit applied.
6. Simultaneous local updates cannot be overwritten by stale GPT proposals.
7. A malicious submission is inert text, never executed as an instruction by another subsystem.
8. User can disable the integration without breaking ordinary note capture or encrypted sync.

## Privacy honesty

A write-only API prevents retrieval of **existing** notes. It does not conceal content that a user voluntarily sends into ChatGPT or content GPT generates as a submission. The ingress service may briefly process that new content in plaintext unless the reviewed protocol encrypts it before the service receives it. The local notes vault and an OpenAI-connected contribution tool are distinct trust environments.
