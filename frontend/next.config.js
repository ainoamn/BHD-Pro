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
        source: '/backend-api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    // Next.js dev server needs 'unsafe-eval' (HMR/React Refresh) and a websocket
    // connect-src. Production keeps the strict policy unchanged.
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com"
      : "script-src 'self' 'unsafe-inline' https://accounts.google.com";
    const connectSrc = isDev
      ? "connect-src 'self' ws: http://localhost:3001 https://hisaby-api.onrender.com https://accounts.google.com https://*.sentry.io"
      : "connect-src 'self' https://hisaby-api.onrender.com https://accounts.google.com https://*.sentry.io";
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      connectSrc,
      'frame-src https://accounts.google.com',
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      'upgrade-insecure-requests',
    ].join('; ');
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
            value: csp,
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
