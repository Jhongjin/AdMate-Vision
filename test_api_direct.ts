
// Mocking the API Handler invocation locally to verify logic without spinning up full Next.js server
import { POST } from './src/app/api/preview/route';
import fs from 'fs';

// Mock Request
class MockRequest {
    body: any;
    constructor(body: any) { this.body = body; }
    async json() { return this.body; }
}

async function runTest() {
    // Set NODE_ENV to dev to trigger local browser launch
    process.env.NODE_ENV = 'development';

    const req = new MockRequest({
        imageUrl: 'https://via.placeholder.com/750x200?text=AdMate+API+Test',
        landingUrl: 'https://admate.co.kr',
        media: 'naver_mobile'
    });

    try {
        // Call the POST handler directly
        const res = await POST(req as any);
        const data = await res.json();

        if (data.screenshot) {
            // Save the base64 screenshot to file
            const base64Data = data.screenshot.replace(/^data:image\/png;base64,/, "");
            fs.writeFileSync('preview_api_final.png', base64Data, 'base64');
            console.log('Success! Saved preview_api_final.png');
            console.log('Injected URL:', data.injectedUrl);
        } else {
            console.error('API returned no screenshot:', data);
        }
    } catch (e) {
        console.error('Test failed:', e);
    }
}

runTest();
