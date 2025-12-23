// @ts-nocheck
import { NextResponse } from 'next/server';
import { chromium } from 'playwright-core';
import https from 'https';

// Helper: Image to Base64
function fetchImageToBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const base64 = buffer.toString('base64');
                const type = res.headers['content-type'] || 'image/png';
                resolve(`data:${type};base64,${base64}`);
            });
        }).on('error', reject);
    });
}

// Browser Logic - Remote Connection Strategy
async function getBrowser() {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

    if (isProduction) {
        console.log('Environment: Production (Browserless.io)');

        const token = process.env.BROWSERLESS_TOKEN || 'YOUR_API_TOKEN_HERE';
        const endpoint = `wss://chrome.browserless.io?token=${token}`;

        console.log('Connecting to Browserless...');

        // Using connectOverCDP as explicitly requested
        // Note: Standard usage is typically chromium.connect(endpoint), but connectOverCDP allows CDP features.
        return chromium.connectOverCDP(endpoint);

    } else {
        // Local Development
        console.log('Environment: Local');
        try {
            const { chromium: localChromium } = require('playwright'); // Full package for local
            return localChromium.launch({
                headless: false,
                channel: 'chrome'
            });
        } catch (e) {
            // Fallback for playwright-core local (requires chrome installed)
            // If local chrome path isn't found, this might fail, but acceptable for dev fallback
            return chromium.launch({ headless: false, channel: 'chrome' });
        }
    }
}

export async function POST(req: Request) {
    try {
        const { imageUrl, landingUrl, media } = await req.json();

        if (!imageUrl || !landingUrl) {
            return NextResponse.json({ error: 'Missing imageUrl or landingUrl' }, { status: 400 });
        }

        // 1. Convert Image to Base64
        let base64Image = '';
        try {
            base64Image = await fetchImageToBase64(imageUrl);
            console.log('Image converted to Base64.');
        } catch (e) {
            console.error('Failed to fetch image, using fallback red pixel.', e);
            base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        }

        // 2. Launch Browser (Remote or Local)
        const browser = await getBrowser();

        // Connect/Launch returns a browser instance (or CDP session wrapper)
        // Create Context
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            viewport: { width: 390, height: 844 }, // iPhone 13
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
        });
        const page = await context.newPage();

        console.log('Navigating to m.naver.com...');
        await page.goto('https://m.naver.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Scroll interaction
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(2000);

        // 3. Inject
        let injected = false;

        // Helper Injection Function
        const injectIntoHandle = async (handle: any) => {
            const bbox = await handle.boundingBox();
            if (!bbox) return false;
            // Check Y range valid for Naver Mobile Top Ad
            if (bbox.y > 100 && bbox.y < 500 && bbox.height > 50) {
                await handle.evaluate((el: HTMLElement, { dataUri, link }: any) => {
                    el.innerHTML = '';

                    // Create Anchor Wrapper
                    const anchor = document.createElement('a');
                    anchor.href = link;
                    anchor.target = '_blank';
                    anchor.style.display = 'block';
                    anchor.style.width = '100%';
                    anchor.style.height = '100%';
                    anchor.style.textDecoration = 'none';

                    // Create Image
                    const newImg = document.createElement('img');
                    newImg.src = dataUri;
                    newImg.style.width = '100%';
                    newImg.style.height = 'auto';
                    newImg.style.display = 'block';
                    newImg.style.objectFit = 'contain';

                    anchor.appendChild(newImg);
                    el.appendChild(anchor);

                    el.style.padding = '0';
                    el.style.margin = '0';
                    el.style.background = 'transparent';
                    el.style.border = 'none';
                }, { dataUri: base64Image, link: landingUrl });
                return true;
            }
            return false;
        };

        // Strategies
        const selectors = ['.main_veta', '.id_main_banner', 'div[class*="ad"]', '#veta_top'];
        for (const sel of selectors) {
            if (injected) break;
            const elements = await page.$$(sel);
            for (const el of elements) {
                if (await injectIntoHandle(el)) {
                    injected = true;
                    break;
                }
            }
        }

        if (!injected) {
            // Fallback Div Scan
            const divs = await page.$$('div');
            for (const div of divs) {
                if (injected) break;
                const bbox = await div.boundingBox();
                if (bbox && bbox.y > 150 && bbox.y < 450 && bbox.height > 50 && bbox.width > 300) {
                    if (await injectIntoHandle(div)) {
                        injected = true;
                    }
                }
            }
        }

        // 4. Capture
        await page.waitForTimeout(500);

        // Inject Fake Status Bar
        await page.evaluate(() => {
            const statusBar = document.createElement('div');
            statusBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 44px; /* iPhone notch height */
        background: #ffffff;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 16px;
        box-sizing: border-box;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        color: #000000;
      `;
            statusBar.innerHTML = `
        <div style="font-weight: 600;">9:41</div>
        <div style="display: flex; gap: 4px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="14" viewBox="0 0 16 14"><path fill="currentColor" d="M12.5,11 L14,11 C14.5522847,11 15,10.5522847 15,10 L15,1 C15,0.44771525 14.5522847,0 14,0 L12.5,0 L12.5,11 Z M10.5,11 L12,11 C12.5522847,11 13,10.5522847 13,10 L13,2 C13,1.44771525 12.5522847,1 12,1 L10.5,1 L10.5,11 Z M8.5,11 L10,11 C10.5522847,11 11,10.5522847 11,10 L11,3 C11,2.44771525 10.5522847,2 10,2 L8.5,2 L8.5,11 Z M6.5,11 L8,11 C8.55228475,11 9,10.5522847 9,10 L9,4 C9,3.44771525 8.55228475,3 8,3 L6.5,3 L6.5,11 Z M4.5,11 L6,11 C6.55228475,11 7,10.5522847 7,10 L7,6 C7,5.44771525 6.55228475,5 6,5 L4.5,5 L4.5,11 Z M2.5,11 L4,11 C4.55228475,11 5,10.5522847 5,10 L5,7 C5,6.44771525 4.55228475,6 4,6 L2.5,6 L2.5,11 Z M0.5,11 L2,11 C2.55228475,11 3,10.5522847 3,10 L3,8 C3,7.44771525 2.55228475,7 2,7 L0.5,7 L0.5,11 Z"/></svg>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="14" viewBox="0 0 20 14"><path fill="currentColor" d="M17,5 L18,5 C18.5522847,5 19,5.44771525 19,6 L19,8 C19,8.55228475 18.5522847,9 18,9 L17,9 L17,5 Z M1,3 L15,3 C15.5522847,3 16,3.44771525 16,4 L16,10 C16,10.5522847 15.5522847,11 15,11 L1,11 C0.44771525,11 0,10.5522847 0,10 L0,4 C0,3.44771525 0.44771525,3 1,3 Z M2,5 L2,9 L14,9 L14,5 L2,5 Z"/></svg>
        </div>
      `;
            document.body.appendChild(statusBar);
        });

        const screenshotBuffer = await page.screenshot({ fullPage: false });
        const screenshotBase64 = screenshotBuffer.toString('base64');

        await browser.close();

        // 5. Return Result
        return NextResponse.json({
            success: injected,
            screenshot: `data:image/png;base64,${screenshotBase64}`,
            injectedUrl: landingUrl
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
