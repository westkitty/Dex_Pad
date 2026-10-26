# Risk register (initial)

| ID | Risk | Likelihood | Impact | Trigger/indicator | Mitigation & proof |
|---|---|---|---|---|---|
| R1 | Android background tasks suspended | High | High | Stale remote revisions after long idle | Foreground catch-up + native WorkManager experiment, real-phone measurement |
| R2 | Acknowledged edits lost | Medium | Critical | Crash during commit/ack | Durable transaction before saved state; fault-injection tests |
| R3 | Encryption design broken | Medium | Critical | Key/nonce/replay flaw; plaintext on relay | Audited primitives and independent crypto review before production claims |
| R4 | False merge changes meaning | High | High | Concurrent same-paragraph edits | CRDT convergence + immutable revision restore and conflict review |
| R5 | Unrecoverable key loss | Medium | Critical | All devices lost, recovery material absent | Recovery UX with verified test restore; document irreversible loss |
| R6 | Compromised integration accesses all notes | Medium | Critical | Broad app token or plaintext proxy | Per-space capabilities, explicit unlock and audit receipts |
| R7 | Server disk/backup loss | Medium | High | Big Mac failure or relay corruption | Multiple local replicas and independent encrypted restore |
| R8 | Silent import loss | High | Critical | Unsupported Standard Notes note format | Quarantine, count/hash reconciliation, export round-trip |
| R9 | Heavy client drains Android battery | Medium | High | Frequent wakeups or large sync decode | WorkManager policy, duty-cycle measurements, incremental batches |
| R10 | Lock-in through custom object format | Medium | High | Cannot meaningfully export | Markdown/JSON/attachment round-trips and documented schemas |
| R11 | Premature feature sprawl | High | High | Canvas/AI precedes reliable sync | Release gates and phase ownership |
| R12 | Canon/project authority drift | Medium | High | Imported notes overwrite external vaults | Reference-only adapters and explicit authority/provenance |
| R13 | Dependency/license conflict | Medium | High | Incompatible upstream code or restrictive license | Source/license review before copying or publishing |
| R14 | Metadata and local index leak | Medium | High | Filenames/logs/search cache visible | Metadata threat model, locked-index encryption, redacted logs |