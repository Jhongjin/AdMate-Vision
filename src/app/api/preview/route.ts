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

        // 0. Define Placement Config Strategy
        const PLACEMENT_CONFIG: Record<string, any> = {
            'mobile_main': {
                url: 'https://m.naver.com',
                selectors: ['.main_veta', '.id_main_banner', 'div[class*="ad"]', '#veta_top'],
                fallback: true,
                ratio: null
            },
            'smart_channel_news': {
                url: 'https://m.news.naver.com',
                selectors: ['.section_ad', '._ad_header', '.ad_area', 'div[class*="ad"]'], // Dynamic candidates
                fallback: true,
                ratio: 'contain',
                minY: 0,
                maxY: 300
            },
            'smart_channel_sports': {
                url: 'https://m.sports.naver.com',
                selectors: ['.mfc_modadbasic_ad_item', 'div[class*="SportsHeader"] + div'],
                fallback: true,
                ratio: 'contain',
                minY: 0,
                maxY: 300
            },
            'smart_channel_ent': {
                url: 'https://m.entertain.naver.com',
                selectors: ['.template_body_ad', '.mfc_modadbasic_ad_item'],
                fallback: true,
                ratio: 'contain',
                minY: 0,
                maxY: 300
            },
            'branding_da_sub': {
                url: 'https://m.entertain.naver.com', // Reliable topic board
                selectors: ['.template_body_ad', '.mfc_modadbasic_ad_item', 'div[class*="ad"]'],
                fallback: true,
                ratio: 'contain',
                scrollFirst: true,
                minY: 400,
                maxY: 2000
            },
            'gfa_feed_news': {
                url: 'https://m.news.naver.com',
                selectors: ['._feed_ad', '.r_ad', '.ad_item', '.section_ad', 'div[class*="ad"]', 'div[class*="banner"]'],
                fallback: true,
                scrollFirst: true,
                minY: 600,
                maxY: 5000,
                native: true
            },
            'gfa_feed_sports': {
                url: 'https://m.sports.naver.com',
                selectors: ['.template_feed_only_ad', '.mfc_tmplfeedad_template_body_ad', '.ad_item'],
                fallback: true,
                scrollFirst: true,
                minY: 800,
                maxY: 5000,
                native: true
            },
            'gfa_feed_ent': {
                url: 'https://m.entertain.naver.com',
                selectors: ['.mfc_tmplfeedmixed_template_body_ad', '.template_body_ad', '.ad_item'],
                fallback: true,
                scrollFirst: true,
                minY: 800,
                maxY: 5000,
                native: true
            },
            'guarantee_showcase': {
                url: 'https://m.entertain.naver.com', // Showcase often appears here
                selectors: [],
                fallback: false,
                overlay: true,
                overlayColor: '#000000'
            },
            'guarantee_splash': {
                url: 'https://m.map.naver.com', // Map Splash
                selectors: [],
                fallback: false,
                overlay: true,
                overlayColor: '#ffffff'
            }
        };

        const currentPlacement = PLACEMENT_CONFIG[media] || PLACEMENT_CONFIG['mobile_main']; // 'media' reused as placement or add new param
        // Note: User asked for 'placement' param. Let's use it.
        const placementParam = (req as any).placement || media || 'mobile_main'; // Backward compat
        const config = PLACEMENT_CONFIG[placementParam] || PLACEMENT_CONFIG['mobile_main'];

        console.log(`Target Placement: ${placementParam}, URL: ${config.url}`);

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

        console.log(`Navigating to ${config.url}...`);
        await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Scroll interaction (Universal)
        if (!config.overlay) {
            if (config.scrollFirst) {
                await page.mouse.wheel(0, 800);
                await page.waitForTimeout(800);
            } else {
                await page.mouse.wheel(0, 300);
                await page.waitForTimeout(500);
                await page.evaluate(() => window.scrollTo(0, 0));
            }
        }
        await page.waitForTimeout(1000);

        // 3. Inject
        let injected = false;

        // Special handling for Overlay Placements (Splash/Showcase)
        if (config.overlay) {
            console.log('Injecting Full-screen Overlay...');
            await page.evaluate(({ dataUri, link, color }: any) => {
                const overlay = document.createElement('div');
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100vw'; // Viewport Width
                overlay.style.height = '100vh'; // Viewport Height
                overlay.style.backgroundColor = color;
                overlay.style.zIndex = '99990'; // High Z-index, but below Status Bar (99999)
                overlay.style.display = 'flex';
                overlay.style.justifyContent = 'center';
                overlay.style.alignItems = 'center';

                // Clickable Anchor
                const anchor = document.createElement('a');
                anchor.href = link;
                anchor.target = '_blank';
                anchor.style.display = 'block';
                anchor.style.width = '100%';
                anchor.style.height = '100%';
                anchor.style.textDecoration = 'none';

                const img = document.createElement('img');
                img.src = dataUri;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover'; // Splash usually covers

                anchor.appendChild(img);
                overlay.appendChild(anchor);
                document.body.appendChild(overlay);

                // Hide existing scroll
                document.body.style.overflow = 'hidden';

            }, { dataUri: base64Image, link: landingUrl, color: config.overlayColor });
            injected = true;
        }

        // Helper Injection Function
        const injectIntoHandle = async (handle: any) => {
            const bbox = await handle.boundingBox();
            if (!bbox) return false;

            // Check Y range - Relaxed for sub-pages?
            // Main page ads usually 100-500. Smart Channel might be top (0-200).
            const minY = 0; // Smart Channel is at very top
            const maxY = 600;

            if (bbox.y >= minY && bbox.y < maxY && bbox.height > 20) {
                await handle.evaluate((el: HTMLElement, { dataUri, link, ratio, native }: any) => {
                    el.innerHTML = '';

                    // Create Anchor Wrapper
                    const anchor = document.createElement('a');
                    anchor.href = link;
                    anchor.target = '_blank';
                    anchor.style.display = 'block';
                    anchor.style.width = '100%';
                    anchor.style.textDecoration = 'none';
                    anchor.style.boxSizing = 'border-box';

                    // Create Image
                    const newImg = document.createElement('img');
                    newImg.src = dataUri;
                    newImg.style.width = '100%';
                    newImg.style.display = 'block';
                    newImg.style.objectFit = 'contain';

                    if (ratio === 'contain') {
                        newImg.style.height = 'auto'; // Let width drive height
                    } else {
                        newImg.style.height = '100%';
                    }

                    anchor.appendChild(newImg);
                    el.appendChild(anchor);

                    // Reset Container
                    el.style.padding = '0';
                    el.style.margin = '0';
                    el.style.background = 'transparent';
                    el.style.border = 'none';

                    if (native) {
                        // Native Feed Ad Styling Enforcement
                        el.style.marginBottom = '10px';
                        el.style.marginTop = '10px';
                        newImg.style.borderRadius = '8px';
                        newImg.style.overflow = 'hidden';
                    } else {
                        el.style.height = 'auto';
                        el.style.minHeight = '50px';
                    }
                }, { dataUri: base64Image, link: landingUrl, native: config.native, ratio: config.ratio });
                return true;
            }
            return false;
        };

        // Execute selectors
        for (const sel of config.selectors) {
            if (injected) break;
            const elements = await page.$$(sel);
            for (const el of elements) {
                if (await injectIntoHandle(el)) {
                    injected = true;
                    console.log(`Injected into selector: ${sel}`);
                    break;
                }
            }
        }

        // Fallback Scan (if enabled)
        if (!injected && config.fallback) {
            console.log('Using fallback div scan...');
            const divs = await page.$$('div');
            // Determine fallback constraints
            const minY = config.minY !== undefined ? config.minY : 0;
            const maxY = config.maxY !== undefined ? config.maxY : 600;

            for (const div of divs) {
                if (injected) break;
                const bbox = await div.boundingBox();

                if (bbox && bbox.y >= minY && bbox.y < maxY && bbox.height > 40 && bbox.width > 300) {
                    if (await injectIntoHandle(div)) {
                        injected = true;
                        console.log('Injected into fallback div');
                    }
                }
            }
        }

        // 4. Capture
        await page.waitForTimeout(500);

        // Inject Fake Status Bar & Home Indicator
        await page.evaluate(() => {
            // 0. Layout Fixes for Overlap
            document.body.style.transition = 'none';
            document.body.style.marginTop = '50px'; // Push content down to make room for status bar
            window.scrollTo(0, 0);

            // Force GNB/Header Visibility
            const style = document.createElement('style');
            style.textContent = `
                header, #header, .header, .MM_SEARCH_HEADER, .gnb_banner {
                    display: block !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                    transform: none !important;
                    position: absolute !important; /* Ensure it stays at top of content */
                    top: 0 !important;
                    width: 100% !important;
                    z-index: 1000 !important;
                }
            `;
            document.head.appendChild(style);

            // 1. Dynamic Data Calculation
            const now = new Date();
            // Convert to KST (UTC+9)
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const kstOffset = 9 * 60 * 60 * 1000;
            const kstDate = new Date(utc + kstOffset);

            const displayHours = kstDate.getHours();
            const displayMinutes = kstDate.getMinutes().toString().padStart(2, '0');
            const timeString = `${displayHours}:${displayMinutes}`;

            // Random Battery
            const batteryLevel = Math.floor(Math.random() * (95 - 20 + 1)) + 20; // 20 ~ 95
            const isLowPower = batteryLevel <= 20;
            const batteryColor = isLowPower ? '#FF3B30' : '#000000'; // Red or Black
            // Battery Body Width (max 22px) -> Scale it
            const batteryWidth = Math.max(2, Math.round((batteryLevel / 100) * 22));

            // 1. Top Status Bar
            const statusBar = document.createElement('div');
            statusBar.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 50px; /* Slight increase for safe area */
                background: #f4f7f8;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 26px;
                box-sizing: border-box;
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 15px;
                color: #000000;
                pointer-events: none;
            `;

            statusBar.innerHTML = `
                <!-- Left: Time + Location -->
                <div style="display: flex; align-items: center; gap: 4px; width: 80px;">
                    <span style="font-weight: 600; font-size: 15px; letter-spacing: -0.5px;">${timeString}</span>
                    <!-- Location Arrow -->
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M11.5 0.5L0.5 5L5 6.5L6.5 11L11.5 0.5Z" />
                    </svg>
                </div>
                
                <!-- Center: Notch Placeholder -->
                <div style="flex: 1;"></div>

                <!-- Right: Status Icons (Tighter Spacing) -->
                <div style="display: flex; gap: 5px; align-items: center;">
                    <!-- Cellular Signal -->
                    <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 8.5C1 8.22386 1.22386 8 1.5 8H3.5C3.77614 8 4 8.22386 4 8.5V11.5C4 11.7761 3.77614 12 3.5 12H1.5C1.22386 12 1 11.7761 1 11.5V8.5Z" fill="black"/>
                        <path d="M5.66663 6C5.66663 5.72386 5.89048 5.5 6.16663 5.5H8.16663C8.44277 5.5 8.66663 5.72386 8.66663 6V11.5C8.66663 11.7761 8.44277 12 8.16663 12H6.16663C5.89048 12 5.66663 11.7761 5.66663 11.5V6Z" fill="black"/>
                        <path d="M10.3333 3.5C10.3333 3.22386 10.5572 3 10.8333 3H12.8333C13.1095 3 13.3333 3.22386 13.3333 3.5V11.5C13.3333 11.7761 13.1095 12 12.8333 12H10.8333C10.5572 12 10.3333 11.7761 10.3333 11.5V3.5Z" fill="black"/>
                        <path d="M15 1C15 0.723858 15.2239 0.5 15.5 0.5H17.5C17.7761 0.5 18 0.723858 18 1V11.5C18 11.7761 17.7761 12 17.5 12H15.5C15.2239 12 15 11.7761 15 11.5V1Z" fill="black"/>
                    </svg>

                    <!-- 5G Text -->
                    <div style="font-weight: 600; font-size: 11px;">5G</div>

                    <!-- Battery -->
                    <div style="position: relative; width: 25px; height: 12px;">
                        <div style="position: absolute; left: 0; top: 0; width: 22px; height: 12px; border: 1px solid #999; border-radius: 3px; box-sizing: border-box; background: rgba(255,255,255,0.4);"></div>
                        <div style="position: absolute; right: 0; top: 3.5px; width: 1.5px; height: 5px; background: #999; border-radius: 0 1px 1px 0;"></div>
                        <div style="position: absolute; left: 2px; top: 2px; width: ${batteryWidth}px; height: 8px; background: ${batteryColor}; border-radius: 1px;"></div>
                    </div>
                     <span style="font-weight: 500; font-size: 11px; margin-left: -2px;">${batteryLevel}</span>
                </div>
            `;
            document.body.appendChild(statusBar);

            // 2. Bottom Home Indicator
            const homeBar = document.createElement('div');
            homeBar.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 34px;
                display: flex;
                justify-content: center;
                align-items: center; /* Center Vertically in the 34px area */
                z-index: 99999;
                pointer-events: none;
            `;
            homeBar.innerHTML = `
                <div style="
                    width: 134px;
                    height: 5px;
                    background-color: #000000;
                    border-radius: 100px;
                "></div>
            `;
            document.body.appendChild(homeBar);
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
