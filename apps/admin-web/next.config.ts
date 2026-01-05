import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',

  // Enable experimental features
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['@/components/ui'],
  },

  // Configure allowed image domains if needed
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
