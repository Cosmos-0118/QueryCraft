import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      [
        "script-src",
        "'self'",
        "'unsafe-inline'",
        "'wasm-unsafe-eval'",
        !isProd ? "'unsafe-eval'" : '',
      ]
        .filter(Boolean)
        .join(' '),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '0' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // read-excel-file pulls in unzipper, which lazily requires '@aws-sdk/client-s3'
  // for an S3 streaming code path we never use. Externalizing the package keeps
  // it out of the server bundle so Node loads it normally at runtime.
  serverExternalPackages: ['read-excel-file', 'unzipper'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
