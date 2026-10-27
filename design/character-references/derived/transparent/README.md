# Optional transparent Dexter cutouts for DEX//Pad

The images in this directory are **cropped from the owner-provided Dexter sheet**, not generated character designs. For each file, the RGB pixels originate directly in the [unmodified reference sheet](../../dexter-reference-sheet.png). The only derived portion is the approximate alpha/background mask.

**Authority order:** original full sheet → exact rectangular crops in [`../../crops/`](../../crops/) → these optional transparent UI derivatives. They do not override the source or establish real-pet photographic identity.

## Contents

- [`main-neutral.png`](main-neutral.png): 433×388 main standing reference; onboarding or About panel
- [`expressions/`](expressions/): neutral, annoyed, determined, contemptuous, joyful, sleepy, concerned and calm (8 images)
- [`poses/`](poses/): sitting, lying-down/sphinx, play-bow/stretch, relaxed standing (4 images)
- [`details/rear-fur-markings.png`](details/rear-fur-markings.png): source-backed marking detail, deliberately retains gray background and inset border
- [`manifest.json`](manifest.json): crop boxes, per-file SHA-256 hashes, palette samples and opacity treatment

## UI rules

Treat these as **candidate illustrations only**, not indicators of persistence, encryption, relay delivery, or success. Keep notes capture immediate and the editor unobstructed. Any use in production needs a visual QA pass on both light and dark UI surfaces: some mask edges retain small source-gray pixels, because the original was a single flattened sheet. No app source files were modified by adding this directory.

## Reproduction

The full downloadable pack includes `extract_sheet.py`, which accepts the unchanged source PNG, crops at source pixel coordinates and isolates foreground using Pillow, NumPy and OpenCV. Reference source alpha is unmodified; only the derived matte is estimated. No photo-registry approval or 3D mesh/rig is implied.
