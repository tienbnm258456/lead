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
      static: 0,
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
};

export default nextConfig;

