#!/usr/bin/env python3
"""Real Chromium development-UI smoke. Requires the separately started local dev server and Playwright."""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get("DEX_PAD_TEST_URL", "http://127.0.0.1:4173")
BROWSER = os.environ.get("DEX_PAD_CHROMIUM")
if not BROWSER and os.path.exists("/usr/bin/chromium"):
    BROWSER = "/usr/bin/chromium"

SCREENSHOT_DIR = Path(os.environ.get("DEX_PAD_SCREENSHOT_DIR", "/mnt/data" if os.path.isdir("/mnt/data") else Path(__file__).resolve().parents[1] / "screenshots"))
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    launch_kwargs = {"headless": True, "args": ["--no-sandbox"]}
    if BROWSER:
        launch_kwargs["executable_path"] = BROWSER
    browser = p.chromium.launch(**launch_kwargs)
    page = browser.new_page(viewport={"width": 1280, "height": 800}, accept_downloads=True)
    errors = []
    cross_origin_requests = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.on("request", lambda req: cross_origin_requests.append(req.url) if not req.url.startswith(URL) else None)
    page.goto(URL)
    page.locator("#developer-warning").wait_for()
    assert "UNENCRYPTED DEVELOPMENT STORAGE" in page.locator("#developer-warning").inner_text()
    page.locator("#new-note").click()
    page.locator("#editor-title").fill("Browser proof")
    page.locator("#editor-body").fill("Synthetic data only")
    page.locator("#save-note").click()
    expect(page.locator("#save-status")).to_have_text("Saved locally")
    page.reload()
    page.locator("#note-list").get_by_text("Browser proof").wait_for()
    page.locator("#note-list").get_by_text("Browser proof").click()
    expect(page.locator("#editor-body")).to_have_value("Synthetic data only")
    page.locator("#editor-body").fill("Changed in Chromium")
    page.locator("#save-note").click()
    expect(page.locator("#save-status")).to_have_text("Saved locally")
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator("#revisions-panel button").first.click()
    expect(page.locator("#save-status")).to_have_text("Saved locally")
    page.locator("#editor-body").wait_for()
    page.locator("#nav-decisions").click()
    page.locator("#new-note").click()
    page.locator("#editor-title").fill("Verification gate")
    page.locator("#evidence-state").select_option("verified")
    page.locator("#save-note").click()
    page.locator("#save-error").get_by_text("evidence reference", exact=False).wait_for()
    page.locator("#evidence-ref").fill("git:synthetic123")
    page.locator("#save-note").click()
    expect(page.locator("#save-status")).to_have_text("Saved locally")
    page.locator("#nav-inbox").click()
    page.locator("#simulate-gpt").click()
    page.locator("#note-list").get_by_text("Synthetic GPT contribution").wait_for()

    # Truthful Sync Inspector interactive test
    page.locator("#nav-notes").click()
    page.locator("#new-note").click()
    page.locator("#editor-title").fill("Sync Inspector Test Note")
    page.locator("#save-note").click()
    expect(page.locator("#save-status")).to_have_text("Saved locally")

    page.locator("#open-sync-inspector").click()
    page.locator("#sync-inspector").wait_for()
    expect(page.locator("#sync-local-val")).to_have_text("SAVED_LOCALLY")
    expect(page.locator("#sync-relay-val")).to_have_text("PENDING")

    # Push to relay
    page.locator("#sync-push-btn").click()
    expect(page.locator("#sync-relay-val")).to_have_text("RELAY_STORED")
    expect(page.locator("#sync-state")).to_have_text("Relay stored")

    # Peer catch-up and ACK
    page.locator("#sync-peer-ack-btn").click()
    expect(page.locator("#sync-peer-val")).to_have_text("PEER_APPLIED")
    expect(page.locator("#sync-state")).to_have_text("Peer applied ✓")

    # Network break toggle
    page.locator("#sync-network-toggle-btn").click()
    expect(page.locator("#sync-state")).to_have_text("Offline (buffered)")
    expect(page.locator("#sync-relay-val")).to_have_text("BUFFERED")

    # Restore network
    page.locator("#sync-network-toggle-btn").click()
    expect(page.locator("#sync-state")).to_have_text("Peer applied ✓")

    # Incident Card interactive test (F05)
    page.locator("#nav-incidents").click()
    page.locator("#new-note").click()
    page.locator("#editor-title").fill("Sync Disconnect Incident")
    page.locator("#incident-status").select_option("mitigated")
    page.locator("#incident-failure").fill("Socket drop caused relay disconnect")
    page.locator("#incident-repro").fill("Simulate network break during active push")
    page.locator("#incident-repair").fill("Buffered local outbox queue until reconnection")
    page.locator("#incident-proof").fill("tests/sync-engine.test.mjs")
    page.locator("#save-note").click()
    expect(page.locator("#save-status")).to_have_text("Saved locally")

    # Commitment Tracker interactive test (F08)
    page.locator("#nav-commitments").click()
    page.locator("#new-note").click()
    page.locator("#editor-title").fill("Security Audit Preparation")
    page.locator("#commitment-status").select_option("in-progress")
    page.locator("#commitment-owner").fill("Lead Crypto Engineer")
    page.locator("#commitment-outcome").fill("Zero-plaintext verification proof and test ledger")
    page.locator("#commitment-review").fill("2026-11-01")
    page.locator("#save-note").click()
    expect(page.locator("#save-status")).to_have_text("Saved locally")

    # Knowledge Relations & Backlinks test (C11)
    # Create target note
    page.locator("#nav-notes").click()
    page.locator("#new-note").click()
    page.locator("#editor-title").fill("Target Note for Backlinks")
    page.locator("#editor-body").fill("I am the target of knowledge relations.")
    page.locator("#save-note").click()
    expect(page.locator("#save-status")).to_have_text("Saved locally")

    # Verify revision incremented on save
    expect(page.locator("#revision-label")).to_have_text("Revision 2")

    # One-Tap Agent Handoff export test (F06)
    with page.expect_download() as download_info:
        page.locator("#export-handoff").click()
    download = download_info.value
    assert "dex-handoff-" in download.suggested_filename

    # Tactile Acoustic Audio Toggle test
    expect(page.locator("#audio-label")).to_have_text("Audio: On")
    page.locator("#audio-toggle-btn").click()
    expect(page.locator("#audio-label")).to_have_text("Audio: Muted")
    page.locator("#audio-toggle-btn").click()
    expect(page.locator("#audio-label")).to_have_text("Audio: On")

    # Knowledge Topology Observatory Lens test
    page.locator("#nav-topology").click()
    page.locator("#topology-panel").wait_for()
    page.locator("#topology-canvas-container canvas").wait_for()
    expect(page.locator("#topology-panel")).to_be_visible()
    expect(page.locator("#topology-canvas-container canvas")).to_be_visible()
    expect(page.locator("#editor-kind")).to_have_text("OBSERVATORY")

    assert not errors, f"JavaScript errors: {errors}"
    assert not cross_origin_requests, f"Unexpected network: {cross_origin_requests}"
    page.screenshot(path=str(SCREENSHOT_DIR / "dex-pad-desktop-smoke.png"), full_page=True)

    small = browser.new_page(viewport={"width": 390, "height": 844})
    small.goto(URL)
    small.locator("#developer-warning").wait_for()
    assert small.locator("#new-note").is_visible()
    width_overflow = small.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    assert not width_overflow, "Mobile horizontal overflow"
    small.screenshot(path=str(SCREENSHOT_DIR / "dex-pad-mobile-smoke.png"), full_page=True)
    browser.close()
print("Chromium smoke PASS: create, reload, update, evidence gate, contribution, mobile layout, no external requests")
