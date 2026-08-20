/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ['next-intl'],
  poweredByHeader: false,
  async rewrites() {
    const backend =
      process.env.BACKEND_URL ||
      (process.env.VERCEL ? 'https://hisaby-api.onrender.com' : 'http://localhost:3001');
    return [
      {
        source: '/api/auth/bhd/:path*',
        destination: `${backend}/api/auth/bhd/:path*`,
      },
      {
        source: '/api/auth/admin-entry',
        destination: `${backend}/api/auth/admin-entry`,
      },
      {
        source: '/backend-api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          {
            key: 'Permissions-Policy',
            // camera=(self) required for POS barcode scanning on /pos
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://id.bhd-om.com; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://hisaby-api.onrender.com https://id.bhd-om.com https://accounts.google.com https://*.sentry.io; frame-src https://accounts.google.com https://id.bhd-om.com; media-src 'self' blob:; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
