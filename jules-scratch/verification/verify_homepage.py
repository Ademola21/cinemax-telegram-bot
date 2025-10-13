from playwright.sync_api import Page, expect

from playwright.sync_api import sync_playwright

def test_homepage_screenshot():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:5019")
        expect(page).to_have_title("Yoruba Cinemax")
        page.screenshot(path="jules-scratch/verification/verification.png")
        browser.close()

test_homepage_screenshot()
