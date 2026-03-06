from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:3000/FakeMS/")
    time.sleep(2)

    # Open command palette
    page.keyboard.press("Space")
    time.sleep(1)

    # Type optask
    page.keyboard.type("optask")
    time.sleep(1)

    # Press Enter
    page.keyboard.press("Enter")
    time.sleep(2) # wait for fetch and render

    # Screenshot
    page.screenshot(path="optask_fixed.png")

    browser.close()
