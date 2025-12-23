/** @type {import('next').NextConfig} */
const nextConfig = {
    // Browserless does not need external packages config
    // experimental: { serverComponentsExternalPackages: [] },
    output: 'standalone',
};

module.exports = nextConfig;
