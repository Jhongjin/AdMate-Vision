// @ts-nocheck
import { NextResponse } from 'next/server';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';
import https from 'https';

// Configuring Chromium for Serverless
// This helps avoid font issues and cold start performance
chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

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

// Logic to get browser instance
async function getBrowser() {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

    if (isProduction) {
        console.log('Environment: Production (Vercel/Serverless)');

        // Serverless Args for Stability
        const launchOptions = {
            args: [
                ...chromium.args,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--no-zygote',
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        };

        return playwright.launch(launchOptions);
    } else {
        // Local Development
        console.log('Environment: Local');
        try {
            // In local, use full playwright if installed
            const { chromium: localChromium } = require('playwright');
            return localChromium.launch({
                headless: false,
                channel: 'chrome' // or defaults
            });
        } catch (e) {
            console.warn('Local playwright not found, attempting core launch...');
            // Fallback or Error
            return playwright.launch({ headless: false });
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

        // 2. Launch Browser
        const browser = await getBrowser();
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
        // Reduced wait time for serverless efficiency, but safe enough for ads
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

                    // Reset container styles to ensure visibility
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
