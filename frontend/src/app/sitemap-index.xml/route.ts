import { NextResponse } from 'next/server';
import { WOJEWODZTWA } from '@/lib/wojewodztwa';

// Indeks sitemapów — jeden adres do zgłoszenia w Search Console i w robots.ts,
// wskazujący na /sitemap.xml (strony statyczne, huby sportów, /[sport]/[miasto]…) i na
// 16 sitemapów boisk, po jednym na województwo (sitemap-boiska/[plik]/route.ts).
//
// Next.js ma wbudowany mechanizm `generateSitemaps()`, ale w wersji 14
// jego automatyczne wystawianie indeksu pod /sitemap.xml jest niepewne
// (patrz zgłoszenia w repo Next.js — część wdrożeń dostaje 404 zamiast
// indeksu). Zamiast na to liczyć, indeks jest tu jawnym route handlerem —
// mniej magii, łatwiej sprawdzić, że naprawdę działa.
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bojo.pl';

  const sitemaps = [
    `${base}/sitemap.xml`,
    ...WOJEWODZTWA.map((w) => `${base}/sitemap-boiska/${w}.xml`),
  ];

  const body = sitemaps.map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
