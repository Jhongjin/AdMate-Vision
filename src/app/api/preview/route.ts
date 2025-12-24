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
        const { imageUrl, landingUrl, media, placement } = await req.json();

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
                type: 'mobile_main',
                url: 'https://m.naver.com',
                selectors: ['#veta_top', '.main_veta', 'div[class*="SpecialDA"]', 'div[class*="main_ad"]', 'div[id*="ad_"]'],
                ratio: 'contain',
                waitAfterLoad: 1000,
                aggressive: true,
                acr: true
            },
            'smart_channel_news': {
                type: 'standard',
                url: 'https://m.news.naver.com',
                selectors: ['.section_ad', '._ad_header', '.ad_area', 'div[class*="ad"]'],
                ratio: 'contain',
                minY: 0,
                maxY: 300,
                fallback: true
            },
            'smart_channel_sports': {
                type: 'standard',
                url: 'https://m.sports.naver.com',
                selectors: ['.mfc_modadbasic_ad_item', '.SportsHeader + .ad', 'div[class*="ad_item"]', 'div[class*="banner"]'],
                ratio: 'contain',
                minY: 0,
                maxY: 500,
                fallback: true
            },
            'smart_channel_ent': {
                type: 'standard',
                url: 'https://m.entertain.naver.com',
                selectors: ['.template_body_ad', '.mfc_modadbasic_ad_item', 'div[class*="ad_item"]'],
                ratio: 'contain',
                minY: 0,
                maxY: 600,
                scrollFirst: true,
                fallback: true
            },
            'branding_da_sub': {
                type: 'standard',
                url: 'https://m.entertain.naver.com',
                selectors: ['.template_body_ad', '.mfc_modadbasic_ad_item', 'div[class*="ad"]'],
                ratio: 'contain',
                scrollFirst: true,
                minY: 400,
                maxY: 2000,
                fallback: true
            },
            'gfa_feed_news': {
                type: 'gfa_feed',
                url: 'https://m.news.naver.com',
                selectors: ['._feed_ad', '.r_ad', '.ad_item', '.section_ad', 'div[class*="ad"]', 'div[class*="banner"]'],
                scrollFirst: true,
                minY: 500,
                maxY: 5000,
                native: true,
                fallback: true
            },
            'gfa_feed_sports': {
                type: 'gfa_feed',
                url: 'https://m.sports.naver.com',
                selectors: ['.template_feed_only_ad', '.mfc_tmplfeedad_template_body_ad', '.ad_item', 'div[class*="ad_item"]'],
                scrollFirst: true,
                minY: 500,
                maxY: 5000,
                native: true,
                fallback: true
            },
            'gfa_feed_ent': {
                type: 'gfa_feed',
                url: 'https://m.entertain.naver.com',
                selectors: ['.mfc_tmplfeedmixed_template_body_ad', '.template_body_ad', '.ad_item', 'div[class*="ad_item"]'],
                scrollFirst: true,
                minY: 500,
                maxY: 5000,
                native: true,
                fallback: true
            },
            'guarantee_showcase': {
                type: 'overlay',
                url: 'https://m.entertain.naver.com',
                selectors: [],
                overlay: true,
                overlayColor: '#000000'
            },
            'guarantee_splash': {
                type: 'overlay',
                url: 'https://m.map.naver.com',
                selectors: [],
                overlay: true,
                overlayColor: '#ffffff'
            }
        };

        // Determine actual placement
        const placementParam = placement || media || 'mobile_main';
        const config = PLACEMENT_CONFIG[placementParam] || PLACEMENT_CONFIG['mobile_main'];

        console.log(`Target Placement: ${placementParam}, Type: ${config.type}, URL: ${config.url}`);

        // 2. Launch Browser
        const browser = await getBrowser();
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
        });
        const page = await context.newPage();

        // --- 1. NETWORK SHIELD (Whitelist Strategy) ---
        console.log('Activating Network Shield (Whitelist Mode)...');
        await page.route('**/*', (route) => {
            const url = route.request().url();

            // 1. Core Allowed Domains (Whitelist)
            const allowedDomains = [
                'm.naver.com',
                'ssl.pstatic.net', // Essential CSS/Images
                'lcs.naver.com',   // Analytics (sometimes buffers page load if blocked)
                'finance.naver.com',
                'news.naver.com',
                'sports.naver.com',
                'entertain.naver.com',
                'comic.naver.com',
                'n.weather.naver.com',
                'map.naver.com',
                'apis.naver.com'   // Some dynamic content
            ];

            // 2. Target Block Lists
            const blockedAds = [
                'ad.naver.com',
                'gfa.naver.com',
                'ad-cr.naver.com',
                'ams.naver.com',
                'cm.g.doubleclick.net',
                'googleads.g.doubleclick.net'
            ];

            // Logic:
            // If it matches a Blocked Ad domain -> ABORT (Priority)
            // If it matches specific pstatic ad paths -> ABORT
            // Else -> CONTINUE

            const isExplicitBlock = blockedAds.some(d => url.includes(d));
            // User Request: Do NOT block pstatic, ONLY block ad/gfa domains.
            // const isPstaticAd = url.includes('ssl.pstatic.net/tveta/libs'); 

            if (isExplicitBlock) {
                console.log(`[Shield] Blocked: ${url}`);
                route.abort();
            } else {
                route.continue();
            }
        });

        console.log(`Navigating to ${config.url}...`);
        await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for Critical Content (Header/Body) to ensure page is loaded
        try {
            await page.waitForSelector('body', { timeout: 10000 });
            // Wait for GNB or Header to prevent blank screenshot
            await page.waitForSelector('#header, .header, .gnb_banner', { timeout: 5000 }).catch(() => console.log('Header wait skipped'));
        } catch (e) {
            console.warn('Page load wait warning:', e);
        }

        // Scroll interaction (Universal)
        if (!config.overlay) {
            // Force Scroll for Lazy Load
            await page.mouse.wheel(0, 1000);
            await page.waitForTimeout(1500);

            if (config.scrollFirst) {
                await page.mouse.wheel(0, 800);
                await page.waitForTimeout(2000); // Explicit longer wait for feed
            } else {
                await page.mouse.wheel(0, 300);
                await page.waitForTimeout(500);
                await page.evaluate(() => window.scrollTo(0, 0));
            }
        }

        // Explicit Wait for Content (Best Effort)
        if (!config.overlay) {
            try {
                await page.waitForSelector('div', { state: 'attached', timeout: 5000 }).catch(() => { });
            } catch (e) { }
        }

        // Specific Wait for Main Page to stabilize (avoid overwrite)
        if (config.waitAfterLoad) {
            console.log(`Waiting ${config.waitAfterLoad}ms for page stabilization...`);
            await page.waitForTimeout(config.waitAfterLoad);
        } else {
            await page.waitForTimeout(1000);
        }

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

        // 3. Injection Strategies (Sandbox)

        // Universal Injection Router (Inline Strategy)
        const injectIntoHandle = async (handle: any) => {
            if (!handle) return false;
            try {
                const bbox = await handle.boundingBox();
                if (!bbox) return false;
                if (bbox.width < 10 || bbox.height < 10) return false;

                const minY = config.minY !== undefined ? config.minY : 0;
                const maxY = config.maxY !== undefined ? config.maxY : 9999;

                if (bbox.y >= minY && bbox.y < maxY) {
                    await handle.evaluate((el: HTMLElement, { dataUri, link, type, ratio }: any) => {
                        // Strategy A: Naver Main (ACR + Global Guardian + Visual Discovery)
                        const injectMobileMain = async (el: HTMLElement, { dataUri, link }: any) => {
                            // Function to build Safe Zone
                            const createSafeZone = () => {
                                const zone = document.createElement('div');
                                zone.id = 'admate_acr_safe_zone';
                                zone.style.cssText = `
                    display: block !important;
                    width: 100% !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    position: relative !important;
                    z-index: 5000 !important;
                    box-sizing: border-box !important;
                `;
                                const a = document.createElement('a');
                                a.href = link;
                                a.target = '_blank';
                                a.style.cssText = 'display: block !important; width: 100% !important; text-decoration: none !important;';
                                const i = document.createElement('img');
                                i.src = dataUri;
                                i.style.cssText = 'width: 100% !important; height: auto !important; display: block !important; object-fit: contain !important;';
                                a.appendChild(i);
                                zone.appendChild(a);
                                return zone;
                            };

                            // 1. Initial Injection
                            if (!document.getElementById('admate_acr_safe_zone')) {
                                el.innerHTML = '';
                                el.style.cssText = 'display: block !important; height: auto !important; min-height: 50px !important; visibility: visible !important;';
                                el.appendChild(createSafeZone());
                            }

                            // 2. PERMANENT GUARDIAN (Global Body Observer)
                            if (!(window as any)._admateGuardian) {
                                console.log('[Guardian] Starting Permanent Watchdog...');

                                const guardian = new MutationObserver((mutations) => {
                                    // A. Check if Safe Zone exists
                                    const zone = document.getElementById('admate_acr_safe_zone');

                                    if (!zone) {
                                        console.log('[Guardian] Safe Zone LOST! Initiating Visual Discovery...');

                                        // B. Visual Discovery Logic
                                        // Naver Main Ad is usually the first big div below the header/gnb.
                                        // We look for any div that looks like an ad (based on class or position).
                                        let target = null;

                                        // Priority 1: Known Classes
                                        const candidates = document.querySelectorAll('#veta_top, .main_veta, div[class*="SpecialDA"], div[class*="main_ad"]');
                                        if (candidates.length > 0) {
                                            target = candidates[0];
                                        }

                                        // Priority 2: Visual Scan (First element with height > 50px below 100px)
                                        if (!target) {
                                            const divs = document.querySelectorAll('div');
                                            for (const d of divs as any) {
                                                const rect = d.getBoundingClientRect();
                                                // Heuristic: Top > 100 (below header), Min Height 50, Full Width-ish
                                                if (rect.top > 80 && rect.top < 500 && rect.height > 50 && rect.width > 300) {
                                                    // Avoid GNB or News
                                                    if (d.id === 'header' || d.classList.contains('gnb_banner')) continue;
                                                    console.log('[Guardian] Visual Candidate Found:', d.className);
                                                    target = d;
                                                    break;
                                                }
                                            }
                                        }

                                        if (target) {
                                            console.log('[Guardian] Re-injecting into target...');
                                            target.innerHTML = '';
                                            target.appendChild(createSafeZone());
                                        }
                                    }

                                    // C. Anti-Tamper (If Safe Zone exists but siblings are added)
                                    if (zone && zone.parentElement) {
                                        const parent = zone.parentElement;
                                        if (parent.children.length > 1) {
                                            Array.from(parent.children).forEach(child => {
                                                if (child.id !== 'admate_acr_safe_zone') {
                                                    console.log('[Guardian] Removing intruder...');
                                                    child.remove();
                                                }
                                            });
                                        }
                                    }
                                });

                                // Observe BODY to catch entire section replacements
                                guardian.observe(document.body, { childList: true, subtree: true });
                                (window as any)._admateGuardian = guardian;
                            }
                            return true;
                        };
                        // --- INLINE STRATEGIES ---
                        if (type === 'mobile_main') {
                            injectMobileMain(el, { dataUri, link });
                        } else if (type === 'gfa_feed') {
                            // STRATEGY B: GFA
                            el.innerHTML = '';
                            const anchor = document.createElement('a');
                            anchor.href = link;
                            anchor.target = '_blank';
                            anchor.style.display = 'block';

                            const img = document.createElement('img');
                            img.src = dataUri;
                            img.style.cssText = 'width: 100% !important; height: auto !important; display: block !important; border-radius: 8px !important;';

                            anchor.appendChild(img);
                            el.appendChild(anchor);

                        } else {
                            // STRATEGY C: STANDARD
                            el.innerHTML = '';
                            const anchor = document.createElement('a');
                            anchor.href = link;
                            anchor.target = '_blank';
                            anchor.style.display = 'block';

                            const img = document.createElement('img');
                            img.src = dataUri;
                            img.style.cssText = 'width: 100% !important; display: block !important;';
                            if (ratio === 'contain') img.style.height = 'auto';
                            else img.style.height = '100%';

                            anchor.appendChild(img);
                            el.appendChild(anchor);
                        }
                    }, { dataUri: base64Image, link: landingUrl, type: config.type, ratio: config.ratio });
                    return true;
                }
                return false;
            } catch (e) { return false; }
        };

        // Execution Loop
        const executeParams = { aggressive: config.aggressive };

        // 1. Selector Scan
        if (config.selectors && config.selectors.length > 0) {
            for (const sel of config.selectors) {
                if (injected) break;
                try {
                    const elements = await page.$$(sel);
                    for (const el of elements) {
                        if (await injectIntoHandle(el)) {
                            injected = true;
                            console.log(`Injected into ${sel}`);
                            break;
                        }
                    }
                } catch (e) { }
            }
        }

        // 2. Aggressive Retry (Only for mobile_main)
        if (config.aggressive && injected) {
            // Guardian is already active, but we can re-verify
            await page.waitForTimeout(500);
            // Verify if our element is still there?
            // Not strictly necessary if Guardian is working, but good for logs.
        }

        // 3. Fallback Scan
        if (!injected && config.fallback) {
            console.log('Fallback scan...');
            const divs = await page.$$('div');
            const minY = config.minY !== undefined ? config.minY : 0;
            const maxY = config.maxY !== undefined ? config.maxY : 9999;
            for (const div of divs) {
                if (injected) break;
                try {
                    const bbox = await div.boundingBox();
                    if (bbox && bbox.y >= minY && bbox.y <= maxY && bbox.width > 300 && bbox.height > 50) {
                        if (await injectIntoHandle(div)) {
                            injected = true;
                            console.log('Injected via fallback');
                        }
                    }
                } catch (e) { }
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
