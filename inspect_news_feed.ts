
import { chromium, devices } from 'playwright-core';
import fs from 'fs';

async function inspectNewsFeed() {
    console.log("Launching browser...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        ...devices['iPhone 13'],
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
    });
    const page = await context.newPage();

    try {
        console.log("Navigating to m.news.naver.com...");
        await page.goto('https://m.news.naver.com', { waitUntil: 'domcontentloaded' });

        // Scroll down to trigger feed loading
        console.log("Scrolling...");
        for (let i = 0; i < 8; i++) {
            await page.mouse.wheel(0, 500);
            await page.waitForTimeout(500);
        }

        console.log("Inspecting selectors...");
        const feedAds = await page.evaluate(() => {
            const candidates: any[] = [];
            // Common patterns for feed ads
            const selectors = ['.ad', '.ad_item', '._feed_ad', '.section_ad', 'div[class*="ad"]', 'div[class*="banner"]'];

            const elements = document.querySelectorAll(selectors.join(','));
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.height > 20 && rect.width > 200 && rect.top > 0) { // Visible ads
                    candidates.push({
                        className: el.className,
                        id: el.id,
                        rect: { top: rect.top, width: rect.width, height: rect.height },
                        tagName: el.tagName
                    });
                }
            });
            return candidates;
        });

        console.log("Found Candidates:", JSON.stringify(feedAds, null, 2));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}

inspectNewsFeed();
