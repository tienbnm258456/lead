import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Enable server-side logging in production (next start / PM2)
  // Không có config này, console.log trong API routes sẽ bị suppress
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // Tắt client-side router cache — mỗi lần navigate luôn fetch data mới từ server
  // Mặc định Next.js cache 30s (dynamic) / 5min (static) → hiển thị data cũ
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30, // Minimum cho phép là 30
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // L2 Fix: Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;

