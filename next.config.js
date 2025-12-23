/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['@sparticuz/chromium-min', '@sparticuz/chromium'],
    },
    output: 'standalone',
};

module.exports = nextConfig;
