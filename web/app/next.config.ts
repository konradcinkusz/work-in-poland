import type { NextConfig } from 'next';
import path from 'node:path';
import { securityHeaders } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The pnpm workspace lives at the repository root; tracing must start there so the
  // standalone bundle includes hoisted dependencies.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders(process.env.NODE_ENV === 'production') }];
  },
};

export default nextConfig;
