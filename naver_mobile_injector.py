import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        # Emulate iPhone 13
        device = p.devices['iPhone 13']
        browser = await p.chromium.launch(headless=False) # Headless=False to see it happening
        context = await browser.new_context(**device)
        page = await context.new_page()

        print("Navigating to m.naver.com...")
        await page.goto("https://m.naver.com")

        # Wait for the ad to load
        print("Waiting for ad element...")
        # Selector based on the analysis: Anchor looking for g.tivan.naver.com
        # We use a broad selector to catch the ad link.
        ad_selector = 'a[href*="g.tivan.naver.com/gfa/"] img'
        
        try:
            await page.wait_for_selector(ad_selector, timeout=10000)
            print("Ad element found!")
        except Exception as e:
            print(f"Ad element not found with standard selector. Dumping page content for debugging... {e}")
            # Fallback or just try to find any image if specific ad missing?
            # m.naver.com is dynamic, sometimes ads map differently. 
            # Let's try a more generic approach if that fails, finding an element with 'ad' text or class?
            # For now, let's proceed assuming it works or we catch the error.
        
        # Inject the image
        print("Injecting custom ad image...")
        image_url = "https://via.placeholder.com/750x200?text=AdMate+Test"
        
        # Javascript to replace the image source and style
        # We target the parent anchor to make sure we control the content, or just the img.
        # Let's find the img and change src.
        
        injection_code = f"""
        const adImage = document.querySelector('{ad_selector}');
        if (adImage) {{
            adImage.src = '{image_url}';
            adImage.srcset = '{image_url}'; // Clear srcset if present
            adImage.style.width = '100%';
            adImage.style.height = 'auto'; // Ensure aspect ratio
            adImage.style.objectFit = 'contain';
            
            // Optional: visual border to confirm injection
            adImage.style.border = '2px solid red';
            console.log('Ad injected successfully');
        }} else {{
            console.error('Ad element not found during injection');
        }}
        """
        
        await page.evaluate(injection_code)
        
        # Wait a bit for the rendering update
        await page.wait_for_timeout(2000)
        
        # Capture screenshot
        print("Capturing screenshot...")
        await page.screenshot(path="naver_preview_test.png", full_page=False)
        print("Screenshot saved to naver_preview_test.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
