const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
    // Limiter les dossiers analysés par ESLint pour exclure `src/generated`
    dirs: [
      'src/app',
      'src/lib',
      'src/server',
      'src/packages',
      'src/types',
    ],
  },
  // In development, do not set any CSP header to avoid blocking dev tools/overlays
  async headers() {
    if (isDev) return [];
    return [];
  },
};

export default nextConfig;


