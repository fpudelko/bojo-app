/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Wersja aplikacji wstrzykiwana do paczki przy buildzie.
  //
  // PO CO: każde automatyczne zgłoszenie awarii (`lib/bledy.ts` → `/admin/bledy`)
  // niesie kolumnę `wersja`. Vercel wystawia skrót commita jako
  // `VERCEL_GIT_COMMIT_SHA`, ale BEZ przedrostka `NEXT_PUBLIC_`, więc do
  // przeglądarki nie trafiał i każdy błąd z produkcji był podpisany „dev".
  // W tygodniu, w którym wdrożeń jest kilka dziennie, to różnica między
  // „wiem, który deploy to zepsuł" a zgadywaniem.
  env: {
    NEXT_PUBLIC_WERSJA:
      process.env.NEXT_PUBLIC_WERSJA
      ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
      ?? 'dev',
  },
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
