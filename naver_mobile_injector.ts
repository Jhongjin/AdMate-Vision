import { chromium, devices, ElementHandle } from 'playwright';
import https from 'https';

// Helper to fetch image and convert to Base64
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

async function run() {
    console.log('Fetching image and converting to Base64...');
    const targetImageUrl = 'https://via.placeholder.com/750x200?text=AdMate+Perfect';
    let base64Image = '';
    try {
        base64Image = await fetchImageToBase64(targetImageUrl);
        console.log('Image converted to Base64 successfully.');
    } catch (e) {
        console.error('Failed to fetch image:', e);
        // Fallback local pixel if fetch fails
        base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    }

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        ...devices['iPhone 13'],
    });
    const page = await context.newPage();

    // Listen to browser console logs
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    console.log('Navigating to m.naver.com...');
    await page.goto('https://m.naver.com');

    // Scroll to trigger lazy loads
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));

    console.log('Waiting for ad containers...');
    await page.waitForTimeout(3000);

    let injected = false;
    console.log('Searching for valid ad containers in Y range 150-500...');

    // Helper function
    async function attemptInjection(handle: ElementHandle<SVGElement | HTMLElement>) {
        const bbox = await handle.boundingBox();
        if (!bbox) return false;

        // Coordinate Validation: Target roughly 150 to 500
        console.log(`Checking candidate: Y=${bbox.y}, H=${bbox.height}`);
        if (bbox.y > 140 && bbox.y < 500 && bbox.height > 50) {
            console.log('--> Valid Candidate Found!');

            await handle.evaluate((el, dataUri) => {
                el.innerHTML = ''; // Clear existing
                const newImg = document.createElement('img');
                newImg.src = dataUri;

                // Force CSS Final Perfect Version
                newImg.style.setProperty('width', '100%', 'important'); // Fit container perfectly
                newImg.style.setProperty('height', 'auto', 'important');
                newImg.style.setProperty('display', 'block', 'important');
                newImg.style.setProperty('object-fit', 'contain', 'important');
                newImg.style.setProperty('border', 'none', 'important'); // Clean look

                // Ensure container reset
                el.style.setProperty('padding', '0', 'important');
                el.style.setProperty('margin', '0', 'important');
                el.style.setProperty('background', 'transparent', 'important');

                el.appendChild(newImg);
                console.log('Injected Base64 image.');
            }, base64Image);
            return true;
        }
        return false;
    }

    // Iterate selectors
    const targetSelectors = ['.main_veta', '.id_main_banner', 'div[class*="ad"]', '#veta_top'];
    for (const selector of targetSelectors) {
        if (injected) break;
        const elements = await page.$$(selector);
        for (const el of elements) {
            if (await attemptInjection(el)) {
                injected = true;
                break;
            }
        }
    }

    // Fallback divs
    if (!injected) {
        console.log('Specific targeting failed. Scanning ALL divs in range...');
        const divs = await page.$$('div');
        for (const div of divs) {
            if (injected) break;
            const bbox = await div.boundingBox();
            // Slightly relaxed range for fallback to ensure we catch Y=180
            if (bbox && bbox.y > 150 && bbox.y < 400 && bbox.height > 50 && bbox.width > 300) {
                console.log(`Fallback Candidate: ${bbox.y}`);
                if (await attemptInjection(div)) {
                    injected = true;
                    console.log('Success with fallback div');
                }
            }
        }
    }

    console.log('Capturing screenshot...');
    await page.waitForTimeout(2000); // Wait for render
    await page.screenshot({ path: 'naver_preview_final_perfect.png', fullPage: false });
    console.log('Screenshot saved to naver_preview_final_perfect.png');

    await browser.close();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
