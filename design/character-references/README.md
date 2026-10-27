# DEX//Pad — Dexter character reference pack

**Reference source:** the single Dexter Character Reference Sheet supplied by the project owner on October 27, 2026. The original image is copied byte-for-byte as `dexter-reference-sheet.png`; every file in `crops/` is a pixel-exact crop, not a regeneration. The original is the visual design authority for this pack.

This supersedes the mismatched DEX//Cast-sourced illustrations in the previous DEX//Pad draft branch. Do **not** combine the old and new sets or treat a filename, memory, or arbitrary DEX logo as identity evidence.

## Source-backed appearance

- **Shape:** small, compact, long-haired quadrupedal dog; floppy, down-angled ears framing the face; plume-like curled tail.
- **Face:** warm amber/brown eyes; dark expressive upper lids; small centered black nose; cream forehead blaze. Neutral expression is controlled, slightly unimpressed rather than smiling.
- **Markings:** black/charcoal dorsal coat; tan eyebrow points and cheek patches; light cream-white muzzle, chest ruff, belly/feet details, and tail tip. Preserve left/right marking placements from the source.
- **Rendering:** clean softly textured cartoon/model-sheet linework; charcoal, warm tan, ivory palette on a neutral gray sheet; consistent anatomy between head portraits and poses.
- **Negative locks:** no upright pointy ears; no generic Shiba/corgi substitution; no broad white face mask; no humanoid posing or clothes; no additional animals or characters; no gratuitous smile or costume.

## Files and use

| Source | Intended reference use |
| --- | --- |
| `dexter-reference-sheet.png` | Master source: the complete, unmodified reference sheet |
| `crops/neutral-standing.png` | Default full-body proportions and neutral mood |
| `crops/fur-back-marking.png` | Back/neck marking topology |
| `crops/palette-swatches.png` | Swatches as provided; HEX samples are approximate source pixel readings |
| `crops/expression-*.png` | Neutral, annoyed, determined, contemptuous, joyful, sleepy, concerned, calm |
| `crops/pose-*.png` | Sitting, sphinx, play bow, relaxed standing |
| `manifest.json` | File hashes, exact crop coordinates, provenance, and constraints |

## DEX//Pad implementation boundary

DEX//Pad is a local-first notes workspace. This is a **design-reference-only** delivery; no application assets are hooked up, no UI behavior is changed, and there is no effect on encryption or sync claims. If using these crops in the UI later, keep them small and contextual; content entry and truthful saved/sync status always take precedence. New renders require their own provenance and continuity review.

These are illustrated design references, not original photographs of Dexter and not automatic registration into an external visual identity ledger.

## Optional transparent UI derivatives

A separate [transparent cutout set](derived/transparent/README.md) contains 14 source-extracted images for optional future app use. The untouched sheet and exact rectangular crops above retain visual authority. The opacity mattes are derived and approximate; they are not new canonical artwork, and no production UI is changed.
