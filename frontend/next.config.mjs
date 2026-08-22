/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Landingi lokalne mieszkały pod /graj/[sport]/[miasto] i siedzą w sitemapie
  // od 2026-08-19, więc przeprowadzka na krótszy adres musi zostawić po sobie
  // trwały ślad, nie 404.
  async redirects() {
    return [
      { source: '/graj/:sport/:miasto', destination: '/:sport/:miasto', permanent: true },
    ];
  },
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
