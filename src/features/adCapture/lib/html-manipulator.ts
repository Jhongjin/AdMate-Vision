import * as cheerio from 'cheerio';

/**
 * Server-Side Static Rendering (SSSR) Manipulator
 * Captures HTML, strips aggressive scripts, and strictly enforces ad injection.
 */
export const sanitizeHtml = (html: string, selectors: string[], newImage: string, link: string, type: string): string => {
    const $ = cheerio.load(html);

    // 1. SECURITY STRIP: Remove all active scripts and iframes (Nuclear Option)
    // This prevents Naver's ad recovery scripts from running after we setContent.
    $('script').remove();
    $('iframe').remove();
    $('noscript').remove(); // Often contains fallback trackers

    // 2. Event Handler Cleaning (Remove onClick, onError, etc.)
    $('*').each((_, el) => {
        const attribs = (el as any).attribs;
        if (attribs) {
            Object.keys(attribs).forEach(attr => {
                if (attr.startsWith('on')) {
                    $(el).removeAttr(attr);
                }
            });
        }
    });

    // 3. INJECTION LOGIC based on Selectors
    let injected = false;

    // Heuristic: If Mobile Main, we might need strict pinning even in HTML?
    // User asked for "Static Pinning" previously. We can try to replicate it in HTML if possible.
    // But standardized approach first tries selectors.

    for (const selector of selectors) {
        if ($(selector).length > 0) {
            const target = $(selector).first();

            // Layout Stabilization
            target.css('display', 'block !important');
            target.css('visibility', 'visible !important');
            target.css('opacity', '1 !important');
            target.css('height', 'auto !important'); // Unset fixed heights that might clip

            // Build Content
            const fit = type === 'gfa_feed' ? 'cover' : 'contain';
            const contentHtml = `
                <a href="${link}" target="_blank" style="display: block; width: 100%; height: 100%; text-decoration: none;">
                    <img src="${newImage}" style="width: 100%; height: 100%; object-fit: ${fit}; display: block;" />
                </a>
            `;

            target.html(contentHtml);
            injected = true;
            console.log(`[SSSR] Injected into: ${selector}`);
            break; // Stop after first successful injection
        }
    }

    // 4. HARD FALLBACK (For Mobile Main or Failed Selectors)
    // If not injected and type is 'mobile_main', force insert logic.
    if (!injected && type === 'mobile_main') {
        const fallbackHtml = `
            <div id="admate_sticker" style="
                position: absolute !important;
                top: 130px !important;
                left: 0 !important;
                width: 100% !important;
                height: 110px !important; /* Approx */
                z-index: 2147483647 !important;
                background: white !important;
                display: block !important;
            ">
                <a href="${link}" target="_blank" style="display: block; width: 100%; height: 100%;">
                    <img src="${newImage}" style="width: 100%; height: 100%; object-fit: contain;" />
                </a>
            </div>
        `;
        $('body').append(fallbackHtml);
        console.log(`[SSSR] Fallback Injection triggered for failed selectors.`);
    }

    // 5. STATUS BAR INJECTION (Optional, can be done here instead of client JS)
    // For now, keeping capturing logic simple.

    return $.html();
};
