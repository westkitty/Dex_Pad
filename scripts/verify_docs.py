#!/usr/bin/env python3
"""Small dependency-free repository documentation checks. Not app/security tests."""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
REQUIRED = [
    "README.md", "AGENTS.md", "PROJECT_STATE.md", ".gitignore", ".editorconfig",
    "docs/PRODUCT.md", "docs/ARCHITECTURE.md", "docs/SECURITY.md",
    "docs/SYNC-LAB.md", "docs/ROADMAP.md", "docs/INTEGRATIONS.md",
    "docs/IMPORT-EXPORT.md", "docs/DECISIONS.md", "docs/RISKS.md",
    "docs/RESEARCH.md", "specs/object-envelope.v0.schema.json",
]
errors = []
for path in REQUIRED:
    if not (ROOT / path).is_file():
        errors.append(f"Missing {path}")
for file in ROOT.rglob("*.md"):
    text = file.read_text(encoding="utf-8")
    if not text.strip():
        errors.append(f"Empty {file.relative_to(ROOT)}")
    for path in re.findall(r"\]\(([^)#]+)(?:#[^)]*)?\)", text):
        if path.startswith(("http://", "https://", "mailto:")):
            continue
        dest = (file.parent / path).resolve()
        if not dest.is_relative_to(ROOT.resolve()) or not dest.exists():
            errors.append(f"Broken local link {file.relative_to(ROOT)} -> {path}")
schema = json.loads((ROOT / "specs/object-envelope.v0.schema.json").read_text())
for field in ("$schema", "title", "required", "properties"):
    if field not in schema:
        errors.append(f"Schema field missing: {field}")
if errors:
    print("Documentation checks FAIL:")
    for err in errors:
        print("-", err)
    sys.exit(1)
print(f"Documentation checks PASS ({len(REQUIRED)} required files; {len(list(ROOT.rglob('*.md')))} Markdown files)")
print("NOTE: No sync, encryption, app, hardware, or security tests were run.")
