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
  // Ngăn Prisma + ExcelJS bị bundle → giảm reload do module resolution
  serverExternalPackages: ['@prisma/client', 'exceljs'],
  // Giảm reload do file watcher detect thay đổi ở file không liên quan
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/prisma/migrations/**',
          '**/assets/**',
          '**/*.docx',
          '**/*.xlsx',
          '**/.git/**',
        ],
        // Dùng polling interval dài hơn → giảm CPU + giảm false trigger
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
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

