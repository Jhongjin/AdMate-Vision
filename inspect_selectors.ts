
import { chromium, devices } from 'playwright-core';
import fs from 'fs';
import path from 'path';

async function inspectSelectors() {
    const urls = [
        'https://m.news.naver.com',
        'https://m.sports.naver.com',
        'https://m.entertain.naver.com'
    ];

    const browser = await chromium.launch({
        headless: true, // Run headless for speed
    });

    const context = await browser.newContext({
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 }, // Force iPhone 13 viewport
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
    });

    const results: any = {};

    for (const url of urls) {
        console.log(`Inspecting ${url}...`);
        const page = await context.newPage();

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

            // Scroll to trigger lazy loading (Node-side)
            for (let i = 0; i < 5; i++) {
                await page.mouse.wheel(0, 500);
                await page.waitForTimeout(500);
            }
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(1000);

            // Inspect potential ad selectors
            const potentialAds = await page.evaluate(() => {
                const candidates: any[] = [];
                // Look for elements with class names containing 'ad', 'banner', 'smart', 'veta'
                const allElements = document.querySelectorAll('div, section, aside, iframe');

                allElements.forEach(el => {
                    const cls = el.className;
                    const id = el.id;
                    if (typeof cls === 'string' && (
                        cls.includes('ad') ||
                        cls.includes('banner') ||
                        cls.includes('smart') ||
                        cls.includes('veta') ||
                        id.includes('ad') ||
                        id.includes('banner')
                    )) {
                        const rect = el.getBoundingClientRect();
                        if (rect.height > 0 && rect.width > 0) {
                            candidates.push({
                                tagName: el.tagName,
                                id: el.id,
                                className: cls,
                                width: rect.width,
                                height: rect.height,
                                top: rect.top,
                                innerText: (el as HTMLElement).innerText ? (el as HTMLElement).innerText.substring(0, 20) : ''
                            });
                        }
                    }
                });
                return candidates;
            });

            results[url] = potentialAds;

        } catch (e) {
            console.error(`Error on ${url}:`, e);
            results[url] = { error: (e as any).toString() };
        } finally {
            await page.close();
        }
    }

    await browser.close();

    fs.writeFileSync('inspection_results.json', JSON.stringify(results, null, 2));
    console.log('Inspection complete. Results saved to inspection_results.json');
}

inspectSelectors();
