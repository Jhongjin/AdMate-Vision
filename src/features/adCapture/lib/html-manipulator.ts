import * as cheerio from 'cheerio';

/**
 * Server-Side Static Rendering (SSSR) Manipulator
 * Captures HTML, strips aggressive scripts, and strictly enforces ad injection.
 */
export const sanitizeHtml = (html: string, selectors: string[], newImage: string, link: string, type: string): string => {
    const $ = cheerio.load(html);

    // 1. INJECTION LOGIC (AdMate Safe Zone)
    // Run this BEFORE stripping iframes/scripts to ensure we find the target container 
    // (which might be an iframe itself or contain one).
    let injected = false;

    // Content Builder
    const fit = type === 'gfa_feed' ? 'cover' : 'contain';
    const safeZoneHtml = (width: string = '100%', height: string = '100%') => `
        <div class="admated-simulation-zone" style="
            display: block !important;
            width: ${width} !important;
            height: ${height} !important;
            opacity: 1 !important;
            visibility: visible !important;
            z-index: 9999 !important;
            background: white !important;
            overflow: hidden !important;
            position: relative !important;
        ">
            <a href="${link}" target="_blank" style="display: block; width: 100%; height: 100%; text-decoration: none;">
                <img src="${newImage}" style="width: 100%; height: 100%; object-fit: ${fit}; display: block;" />
            </a>
        </div>
    `;

    for (const selector of selectors) {
        if ($(selector).length > 0) {
            const target = $(selector).first();

            // Replace the ENTIRE target element with our Safe Zone.
            // This ensures we get rid of the original container (iframe/div) and any attached scripts/attributes.
            target.replaceWith(safeZoneHtml());

            injected = true;
            console.log(`[SSSR] Injected Safe Zone into: ${selector}`);
            break; // Stop after first successful injection
        }
    }

    // 2. HARD FALLBACK (Static Pinning for Mobile Main)
    // If we didn't find any selector, AND it's mobile_main, force the "Static Pin".
    if (!injected && type === 'mobile_main') {
        const fallbackHtml = `
            <div id="admate_sticker" class="admated-simulation-zone" style="
                position: absolute !important;
                top: 130px !important;
                left: 0 !important;
                width: 100% !important;
                height: 110px !important; /* Approx 750:200 ratio */
                z-index: 20000 !important; /* Higher than anything else */
                background: white !important;
                display: block !important;
                box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            ">
                <a href="${link}" target="_blank" style="display: block; width: 100%; height: 100%;">
                    <img src="${newImage}" style="width: 100%; height: 100%; object-fit: contain;" />
                </a>
            </div>
        `;
        $('body').append(fallbackHtml);
        console.log(`[SSSR] Fallback Static Pin triggered.`);
    }

    // 3. SECURITY STRIP: Remove active scripts and iframes
    // Now that we've injected our Safe Zone (which is a DIV), we can safely nuke iframes.

    // Remove all scripts
    $('script').remove();

    // Remove iframes BUT EXCLUDE our safe zone (just in case we used iframe, though we used div)
    // Our safe zone is a DIV, so $('iframe').remove() won't touch it.
    // However, we should be careful if our safe zone is INSIDE an iframe? No, we replaced the content.
    // If we replaced an element inside body, and that element is not inside another iframe, we are good.
    $('iframe').not('.admated-simulation-zone').remove();

    $('noscript').remove();

    // 4. Event Handler Cleaning
    $('*').each((_, el) => {
        // Safe check for typescript (AnyNode vs Element)
        const attribs = (el as any).attribs;
        if (attribs) {
            Object.keys(attribs).forEach(attr => {
                if (attr.startsWith('on')) {
                    $(el).removeAttr(attr);
                }
            });
        }
    });

    return $.html();
};
