import { NextResponse } from 'next/server';
import { sanitizeHtml } from '@/features/adCapture/lib/html-manipulator';
import { NAVER_AD_PLACEMENTS } from '@/features/adCapture/config';

export async function POST(req: Request) {
    try {
        const { imageUrl, landingUrl, media, placement } = await req.json();

        if (!imageUrl || !landingUrl) {
            return NextResponse.json({ error: 'Missing imageUrl or landingUrl' }, { status: 400 });
        }

        // 1. Prepare Config
        const placementKey = placement || media || 'mobile_main';
        const config = NAVER_AD_PLACEMENTS[placementKey as keyof typeof NAVER_AD_PLACEMENTS] || NAVER_AD_PLACEMENTS['mobile_main'];
        console.log(`[Proxy] Target: ${placementKey}, URL: ${config.url}`);

        // 2. FETCH HTML (Server-Side)
        // Use Mobile Googlebot UA to ensure Naver serves fully rendered SSR content (avoiding JS skeletons)
        const response = await fetch(config.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.179 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch upstream: ${response.status}`);
        }

        const originalHtml = await response.text();

        // 3. SANITIZE & INJECT (Cheerio)
        console.log('[Proxy] Processing HTML...');
        const cleanHtml = sanitizeHtml(
            originalHtml,
            config.selectors,
            imageUrl, // Pass URL directly, no need for Base64 conversion if using simple img tag
            landingUrl,
            config.type
        );

        // 4. Return HTML for Client-Side Rendering (Iframe)
        return NextResponse.json({
            success: true,
            html: cleanHtml,
            type: 'html', // Signal to frontend to use Iframe
            injectedUrl: landingUrl
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
