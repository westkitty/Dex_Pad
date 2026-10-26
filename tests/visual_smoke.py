#!/usr/bin/env python3
"""Static Chromium render QA when this environment blocks navigation to localhost.
Does NOT execute app JavaScript or prove IndexedDB/functional user journeys.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'styles.css').read_text(encoding='utf-8')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for name, width, height in [('desktop', 1440, 900), ('mobile', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        page.set_content(html)
        page.add_style_tag(content=css)
        page.locator('#developer-warning').wait_for()
        assert 'UNENCRYPTED DEVELOPMENT STORAGE' in page.locator('#developer-warning').inner_text()
        assert page.locator('#new-note').is_visible()
        overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
        assert not overflow, f'{name} horizontal overflow'
        path = f'/mnt/data/dex-pad-{name}-static.png'
        page.screenshot(path=path, full_page=True)
        print(f'{name}: static render PASS, screenshot {path}')
        page.close()
    browser.close()
print('Static Chromium layout PASS; functional browser tests remain UNVERIFIED (navigation policy blocks localhost).')
