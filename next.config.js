/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['@sparticuz/chromium'],
    },
    output: 'standalone',
};

module.exports = nextConfig;
