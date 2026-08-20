import type { MetadataRoute } from 'next';

// Paths that must never be indexed:
//   /admin   — admin panel
//   /api     — server routes, no user-facing content
//   /profil, /moje-gry — per-user pages, useless to a crawler
//   /d/, /g/ — join codes are the only access control on private events and
//              groups; a code sitting in a search index defeats it
const DISALLOW = ['/admin', '/api', '/profil', '/moje-gry', '/d/', '/g/'];

// Spelled out rather than left to the wildcard so the stance towards AI
// crawlers is a decision on record, not a side effect.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
];

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bojo.pl';
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
    ],
    // Indeks (sitemap-index.xml/route.ts) zamiast samego sitemap.xml — ten
    // ostatni ma dziś tylko strony statyczne i huby, boiska partycjonowane
    // po województwie żyją w osobnych plikach zebranych przez ten indeks.
    sitemap: `${base}/sitemap-index.xml`,
  };
}
