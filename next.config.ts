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
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Security headers: Áp dụng cho page routes, loại trừ _next (HMR/static) để tránh xung đột WebSocket/HMR dev server
  async headers() {
    return [
      {
        source: '/((?!_next|favicon.ico).*)',
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

