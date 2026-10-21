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
};

export default nextConfig;

