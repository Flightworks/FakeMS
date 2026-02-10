
import os
import time
import re
from playwright.sync_api import sync_playwright

def test_map_interaction():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            geolocation={"latitude": 34.0522, "longitude": -118.2437},
            permissions=["geolocation"]
        )
        page = context.new_page()

        page.on("console", lambda msg: print(f"Console: {msg.text}"))

        url = "http://localhost:4173/FakeMS/"
        print(f"Navigating to {url}")
        page.goto(url)
        page.wait_for_load_state("networkidle")

        # Wait for tiles
        page.locator("img[src*='tile.openstreetmap.org']").first.wait_for(state="visible", timeout=10000)

        container = page.locator(".cursor-move").first

        # Find the div that has the transform style
        animated_div = container.locator("div[style*='transform-origin']").first

        initial_style = animated_div.get_attribute("style")
        print(f"Targeted Animated Div Style: {initial_style}")

        # Simulate Pan (Drag)
        # Drag from off-center to avoid the Ownship icon
        viewport = page.viewport_size
        center_x = viewport['width'] / 2
        center_y = viewport['height'] / 2
        start_x = center_x + 100
        start_y = center_y + 100

        print(f"Dragging from {start_x}, {start_y}")
        page.mouse.move(start_x, start_y)
        page.mouse.down()
        page.mouse.move(start_x + 200, start_y)
        time.sleep(0.5)
        page.mouse.up()

        time.sleep(1)

        final_style = animated_div.get_attribute("style")
        print(f"Final Style: {final_style}")

        if initial_style and final_style and initial_style != final_style:
            print("PASS: Transform style changed after pan.")
        else:
            print("FAIL: Transform style did not change.")

        # Simulate Zoom (Wheel)
        print("Simulating Zoom...")
        page.mouse.move(center_x, center_y)
        page.mouse.wheel(0, -500) # Scroll up

        time.sleep(1)
        zoom_style = animated_div.get_attribute("style")
        print(f"Zoom Style: {zoom_style}")

        if zoom_style != final_style:
             print("PASS: Transform style changed after zoom.")
        else:
             print("FAIL: Transform style did not change after zoom.")

        browser.close()

if __name__ == "__main__":
    test_map_interaction()
