#!/usr/bin/env python3
"""Real Chromium development-UI smoke. Requires the separately started local dev server and Playwright."""
import os
import sys
from playwright.sync_api import sync_playwright

URL = os.environ.get("DEX_PAD_TEST_URL", "http://127.0.0.1:4173")
BROWSER = os.environ.get("DEX_PAD_CHROMIUM", "/usr/bin/chromium")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=BROWSER, args=["--no-sandbox"])
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
    page.get_by_text("Saved locally", exact=True).wait_for()
    page.reload()
    page.locator("#note-list").get_by_text("Browser proof").wait_for()
    page.locator("#note-list").get_by_text("Browser proof").click()
    assert page.locator("#editor-body").input_value() == "Synthetic data only"
    page.locator("#editor-body").fill("Changed in Chromium")
    page.locator("#save-note").click()
    page.get_by_text("Saved locally", exact=True).wait_for()
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator("#revisions-panel button").first.click()
    page.get_by_text("Saved locally", exact=True).wait_for()
    page.locator("#editor-body").wait_for()
    page.locator("#nav-decisions").click()
    page.locator("#new-note").click()
    page.locator("#editor-title").fill("Verification gate")
    page.locator("#evidence-state").select_option("verified")
    page.locator("#save-note").click()
    page.locator("#save-error").get_by_text("evidence reference", exact=False).wait_for()
    page.locator("#evidence-ref").fill("git:synthetic123")
    page.locator("#save-note").click()
    page.get_by_text("Saved locally", exact=True).wait_for()
    page.locator("#nav-inbox").click()
    page.locator("#simulate-gpt").click()
    page.locator("#note-list").get_by_text("Synthetic GPT contribution").wait_for()
    assert not errors, f"JavaScript errors: {errors}"
    assert not cross_origin_requests, f"Unexpected network: {cross_origin_requests}"
    page.screenshot(path="/mnt/data/dex-pad-desktop-smoke.png", full_page=True)

    small = browser.new_page(viewport={"width": 390, "height": 844})
    small.goto(URL)
    small.locator("#developer-warning").wait_for()
    assert small.locator("#new-note").is_visible()
    width_overflow = small.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    assert not width_overflow, "Mobile horizontal overflow"
    small.screenshot(path="/mnt/data/dex-pad-mobile-smoke.png", full_page=True)
    browser.close()
print("Chromium smoke PASS: create, reload, update, evidence gate, contribution, mobile layout, no external requests")
