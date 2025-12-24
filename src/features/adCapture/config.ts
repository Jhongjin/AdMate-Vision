/**
 * Naver Ad Placements Configuration
 * Defines target selectors and properties for various Naver ad zones.
 */

export const NAVER_AD_PLACEMENTS = {
    'mobile_main': {
        type: 'mobile_main',
        url: 'https://m.naver.com',
        // Selectors for Server-Side Cheerio Finding
        selectors: [
            '#veta_top',
            '.main_veta',
            'div[class*="SpecialDA"]',
            'div[class*="main_ad"]',
            'div[id*="ad_"]'
        ],
        wait: 1500
    },
    'smart_channel_news': {
        type: 'standard',
        url: 'https://m.news.naver.com',
        selectors: ['.section_ad', '._ad_header', '.ad_area', 'div[class*="ad"]'],
        wait: 1000
    },
    'smart_channel_sports': {
        type: 'standard',
        url: 'https://m.sports.naver.com',
        selectors: ['.mfc_modadbasic_ad_item', '.SportsHeader + .ad', 'div[class*="ad_item"]', 'div[class*="banner"]'],
        wait: 1000
    },
    'smart_channel_ent': {
        type: 'standard',
        url: 'https://m.entertain.naver.com',
        selectors: ['.template_body_ad', '.mfc_modadbasic_ad_item', 'div[class*="ad_item"]'],
        wait: 1000
    },
    'gfa_feed_news': {
        type: 'gfa_feed',
        url: 'https://m.news.naver.com',
        selectors: ['._feed_ad', '.r_ad', '.ad_item', 'div[class*="ad"]'],
        scroll: true,
        wait: 2000
    },
    'gfa_feed_sports': {
        type: 'gfa_feed',
        url: 'https://m.sports.naver.com',
        selectors: ['.template_feed_only_ad', '.mfc_tmplfeedad_template_body_ad', '.ad_item'],
        scroll: true,
        wait: 2000
    },
    'gfa_feed_ent': {
        type: 'gfa_feed',
        url: 'https://m.entertain.naver.com',
        selectors: ['.mfc_tmplfeedmixed_template_body_ad', '.template_body_ad', '.ad_item', 'div[class*="ad_item"]'],
        scroll: true,
        wait: 2000
    },
    // New Additions or Branding
    'branding_da_sub': {
        type: 'standard',
        url: 'https://m.entertain.naver.com',
        selectors: ['.template_body_ad', 'div[class*="ad"]'],
        scroll: true,
        wait: 1000
    }
};
