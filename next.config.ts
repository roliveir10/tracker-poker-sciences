import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
    dirs: [
      'src/app',
      'src/lib',
      'src/server',
      'src/packages',
      'src/types',
    ],
  },
};

export default nextConfig;
