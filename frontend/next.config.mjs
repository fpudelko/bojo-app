/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow Mapbox GL JS worker to be bundled correctly
  webpack: (config) => {
    // mapbox-gl uses worker-loader internally; mark it as external to avoid
    // bundling issues with Next.js SSR compilation
    config.resolve.alias = {
      ...config.resolve.alias,
      'mapbox-gl': 'mapbox-gl',
    };
    return config;
  },
  // Images from external domains (optional, add as needed)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
