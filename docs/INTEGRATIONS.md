# Permissioned integration contract (proposal)

## First rule

DEX//Pad is useful even if no integration exists. Integrations use narrow capabilities supplied through an unlocked trusted client, not a master-key-bearing server-side superuser.

## Permission draft

- `items:create` — create in one selected inbox/space.
- `items:read` — read explicitly selected item IDs or an approved space.
- `items:update` — mutate only declared IDs/scopes with revision preconditions.
- `search:query` — search permitted locally unlocked content; separate semantic index permission.
- `events:subscribe` — change-notice events with content redacted unless explicitly granted.
- `attachments:write` — upload to one explicitly designated space.
- `exports:request` — bounded export with user-visible audit record.

Permissions should be scoped by space, operation, expiry, and app identity where possible. Revocation must be testable, including while offline, with clear limits.

## Proposed system links

- DEX//REACH: orchestrate approved actions, not run its own unrestricted vault index.
- DexVault: consume explicitly approved exports or scoped retrieval; index is derived and rebuildable.
- WorldsVault: link to existing authoritative Markdown files and canon rules; never automatically overwrite originals or reassign canonical authority.
- Local models on Big Mac: optional search agent connects only to an authorized decrypting client, and Big Mac is not implicitly trusted to hold vault plaintext keys.

## Audit and observability

Show when an app requests access, grants, last use, revoked state and item-level modification receipts. No hidden automation edits, no opaque mass write permissions, no remote provider fallbacks.

## Protocol requirements before implementation

Mutations are idempotent and revision-conditional. The API exposes provenance (human, imported, automated, derived), import batch ID and safe rollback references. Every request returns explicit error classes: locked, denied, stale, quota, offline, conflict, not found.