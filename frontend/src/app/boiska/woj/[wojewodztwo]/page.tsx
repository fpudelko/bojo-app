import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Landmark } from 'lucide-react';
import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import { slugify } from '@/lib/utils';
import { venueListJsonLd } from '@/lib/structuredData';
import { WOJEWODZTWA, WOJEWODZTWO_LABEL, type Wojewodztwo } from '@/lib/wojewodztwa';
import { sportEmoji, HUBY_KATALOGU_SPORTOWYCH } from '@/lib/sports';
import { wstepHubuWojewodztwa } from '@/content/boiska';
import { obiektyHubuWojewodztwa, metadanePaginacjiHuba } from '@/lib/hubKatalogu';
import type { Field } from '@/types';

// Faza 2b SEO/GEO (BACKLOG.md §7a) — hub wojewódzki, wzorem `/boiska/[sport]`:
// katalog rośnie z każdym importem OSM, więc lista pod jednym województwem
// (mazowieckie: 8100+ obiektów w samym pliku PBF) nie może być prerenderowana
// ani zmieścić się w jednym HTML-u — te same powody co przy `/boisko/[id]`
// i `/boiska/[sport]` (patrz AGENTS.md, sekcja o boiskach).
//
// Adres to /boiska/woj/[wojewodztwo], NIE /boiska/[wojewodztwo] — Next.js nie
// pozwala dwóm dynamicznym segmentom na tym samym poziomie katalogu mieć różne
// nazwy ([sport] już zajmuje /boiska/[cokolwiek]), więc "woj" jest literalnym
// segmentem pośrednim.
export const dynamic = 'force-dynamic';

const NA_STRONE = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toField(row: any): Field {
  const bookingType = row.booking_type ?? 'none';
  return {
    id: row.id, name: row.name, address: row.address,
    lat: Number(row.lat), lng: Number(row.lng), sport: row.sport ?? [],
    available: row.available, surface: row.surface ?? '', isIndoor: row.is_indoor,
    isBookable: bookingType === 'internal', bookingType,
    bookingUrl: row.booking_url ?? undefined, bookingEnabled: row.booking_enabled ?? false,
    managerId: row.manager_id ?? undefined, phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    mapVisibility: row.map_visibility ?? 'organizer_only',
    district: row.district ?? undefined,
    city: row.city ?? undefined,
  };
}

function numerStrony(searchParams?: { strona?: string }): number {
  const n = Number(searchParams?.strona ?? '1');
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export async function generateMetadata(
  { params, searchParams }: { params: { wojewodztwo: string }; searchParams?: { strona?: string } },
): Promise<Metadata> {
  const label = WOJEWODZTWO_LABEL[params.wojewodztwo as Wojewodztwo];
  if (!label) return { title: 'Nie znaleziono' };
  const strona = numerStrony(searchParams);
  const sufiks = strona > 1 ? ` — strona ${strona}` : '';
  const { canonical, robots } = metadanePaginacjiHuba(`/boiska/woj/${params.wojewodztwo}`, strona);
  return {
    // BEZ ręcznego „| Bojo” — dokłada go `title.template` z layout.tsx.
    title: `Boiska sportowe — województwo ${label}${sufiks}`,
    description: `Katalog boisk i obiektów sportowych w województwie ${label}. Adresy, sporty, nawierzchnia. Zbierz skład i zagraj przez Bojo.`,
    alternates: { canonical },
    robots,
    openGraph: {
      title: `Boiska sportowe — województwo ${label} | Bojo`,
      description: `Katalog boisk w województwie ${label}.`,
    },
  };
}

export default async function WojewodztwoPage(
  { params, searchParams }: { params: { wojewodztwo: string }; searchParams?: { strona?: string } },
) {
  const slug = params.wojewodztwo as Wojewodztwo;
  const label = WOJEWODZTWO_LABEL[slug];
  if (!label || !WOJEWODZTWA.includes(slug)) notFound();

  const strona = numerStrony(searchParams);
  const od = (strona - 1) * NA_STRONE;

  // Zapytanie (z filtrem seo_tier, dług D11) wydzielone do lib/hubKatalogu.ts —
  // testowalne bez renderowania JSX.
  const { data, count } = await obiektyHubuWojewodztwa(slug, od, od + NA_STRONE - 1);

  const fields = (data ?? []).map(toField);
  const wszystkich = count ?? fields.length;
  const stron = Math.max(1, Math.ceil(wszystkich / NA_STRONE));

  if (strona > stron && wszystkich > 0) notFound();

  const jsonLd = venueListJsonLd(
    `Boiska sportowe — województwo ${label}${strona > 1 ? ` — strona ${strona}` : ''}`,
    fields.map((field) => ({ name: field.name, slug: slugify(field.name) })),
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary-100 rounded-xl">
            <Landmark className="w-5 h-5 text-primary-700" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Województwo {label} — boiska sportowe
          </h1>
        </div>

        {/* Bezpośrednia odpowiedź nad listą — bez niej strona jest samym
            listingiem (docs/seo-geo-strategia.md, 3g). Tylko strona 1: dalsze
            strony paginacji nie powinny powielać ten sam akapit. */}
        {wszystkich > 0 && strona === 1 && (
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            {wstepHubuWojewodztwa(wszystkich, label)}
          </p>
        )}

        <p className="text-slate-500 text-sm mb-8">
          {wszystkich > 0
            ? `Znalezionych obiektów: ${wszystkich}${stron > 1 ? ` · strona ${strona} z ${stron}` : ''}`
            : 'Brak obiektów w bazie dla tego województwa.'}
        </p>

        {fields.length > 0 && (
          <ul className="space-y-3">
            {fields.map((field) => (
              <li key={field.id}>
                <Link
                  href={`/boisko/${slugify(field.name)}`}
                  className="flex items-start gap-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-primary-200 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{field.name}</p>
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" /> {field.city ?? field.address}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {field.sport.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                          <span role="img" aria-hidden>{sportEmoji(s)}</span> {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {stron > 1 && (
          <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Strony wyników">
            {strona > 1 ? (
              <Link
                href={strona === 2 ? `/boiska/woj/${slug}` : `/boiska/woj/${slug}?strona=${strona - 1}`}
                rel="prev"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary-200"
              >
                ← Poprzednia
              </Link>
            ) : <span />}

            {/* slate-400 na białym dawał 2.45:1 — poniżej WCAG AA 4.5:1.
                slate-500 (4.76:1) jest bezpieczny. */}
            <span className="text-xs text-slate-500">{strona} z {stron}</span>

            {strona < stron ? (
              <Link
                href={`/boiska/woj/${slug}?strona=${strona + 1}`}
                rel="next"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary-200"
              >
                Następna →
              </Link>
            ) : <span />}
          </nav>
        )}

        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <Link href="/mapa?gry=0" className="text-primary-600 hover:underline text-sm">
            ← Wróć do mapy boisk
          </Link>
          <Link href="/jak-dziala-bojo" className="text-primary-600 hover:underline text-sm">
            Jak działa Bojo — zbierz skład na to boisko →
          </Link>
        </div>

        {/* Linkowanie poziome (docs/seo-geo-strategia.md, 4b/16): bez tego hub
            wojewódzki był OSIEROCONY poza wejściem z sitemapa — zero linków
            przychodzących I wychodzących. Tylko strona 1, z tego samego powodu
            co w /boiska/[sport].
            Etykiety sekcji niżej: slate-400 na białym dawał 2.56:1 — poniżej
            WCAG AA 4.5:1 (PageSpeed Insights, „Ułatwienia dostępu", 2026-08-29).
            slate-500 (4.76:1) jest bezpieczny. */}
        {strona === 1 && (
          <div className="mt-10 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Boiska według sportu
              </p>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                {HUBY_KATALOGU_SPORTOWYCH.map((h) => (
                  <Link
                    key={h.slug}
                    href={`/boiska/${h.slug}`}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    {h.etykieta}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Inne województwa
              </p>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                {WOJEWODZTWA.filter((w) => w !== slug).map((woj) => (
                  <Link
                    key={woj}
                    href={`/boiska/woj/${woj}`}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    {WOJEWODZTWO_LABEL[woj]}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
