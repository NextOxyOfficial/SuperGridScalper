/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  async rewrites() {
    return [
      {
        source: '/media/:path*',
        destination: 'http://127.0.0.1:8000/media/:path*',
      },
      {
        source: '/static/:path*',
        destination: 'http://127.0.0.1:8000/static/:path*',
      },
    ];
  },
}

module.exports = nextConfig
