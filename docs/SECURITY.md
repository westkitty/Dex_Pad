# Security & privacy threat model (draft)

**Status:** design obligations only. No encryption has been implemented, audited, or validated.

## Security goal

The private relay can coordinate encrypted data without ordinarily learning note content, attachments, or local full-text indexes. Compromise of one integration does not automatically grant all-vault access. Loss of the server does not destroy the only copy. Security depends on device integrity and key management as well as encryption.

## Trust assumptions and adversaries

- Attacker can observe internet/tailnet connection patterns, compromise relay storage, replay old updates, or induce crashes.
- Attacker may steal a device or a stale backup; stolen unlocked device and local malware are higher-severity threats not solved by E2EE alone.
- A malicious client may send malformed events; the relay must validate envelopes, authorization and resource limits without decrypting them.
- A third-party integration or AI application is untrusted unless it receives an explicit narrow capability from an unlocked trusted context.
- Device clocks are unreliable for causal ordering; do not use timestamps alone as conflict arbiter.

## Cryptographic design gate — no implementation before review

1. Select audited cross-platform primitive/library and supported parameter sets (AEAD, KDF, key wrapping, device identity); never invent cryptography.
2. Define root recovery secret, per-vault keys, optionally per-space keys, per-device wrapping and key epochs.
3. Specify exact authenticated-data fields and metadata intentionally left visible to the relay.
4. Define unique nonce guarantees and replay protection for retries, concurrent devices, restore and compaction.
5. Implement encrypted incremental update framing so an untrusted relay cannot decrypt CRDT updates.
6. Explicitly design key rotation and device revocation; revocation affects future authorization, not already-copied plaintext.
7. Test key recovery under lost device, forgotten credential, server loss and corrupted snapshot. Avoid falsely promising recovery where keys are gone.
8. Audit local-at-rest threats: IndexedDB persistent plaintext, browser storage eviction, unencrypted caches, screenshots, OS backups, logs, crash reports, clipboard and indexing.
9. Run dependency review, fuzz malformed ciphertext, test tamper detection and ensure no secrets in telemetry or debug output.
10. Obtain external security review before handling irreplaceable data or claiming cryptographic safety.

## Data categories and exposure

| Item | Intended location | Relay exposure |
|---|---|---|
| Note bodies and attachments | Encrypted client storage / encrypted relay blobs | Ciphertext only |
| Search index | Unlocked client, encrypted when persisted | Not uploaded |
| User-defined tags/relationships | Encrypted where possible | Any routing requirement must be enumerated |
| Device identifiers and sync cursors | Clients and relay | Minimal routing metadata unavoidable |
| Connection times and payload sizes | Transport/relay | Potentially observable |
| Integration tokens/capabilities | Local trusted client / narrowly scoped verifier | Never a general vault master key |
| Recovery secret | User-controlled offline medium | Never held in plaintext on relay |

## Zero-data-loss boundary

No encryption/security claim is sufficient if authorized content can be silently discarded. Maintain immutable revision history and validated backup restore even when conflict merging appears correct.

## Stop conditions

- Client acknowledges a write before durable commit.
- A relay can decrypt user content without a narrowly authorized trusted client pathway.
- Sync algorithm relies on last-write-wins timestamps without recovery of overwritten content.
- A device joins without authenticated identity/key confirmation.
- Backups exist but restore has not been exercised.
- The implementation logs plaintext, raw keys, or credentials.

## External references

- https://docs.yjs.dev/getting-started/allowing-offline-editing
- https://automerge.org/docs/tutorial/local-sync/
- https://developer.android.com/develop/background-work