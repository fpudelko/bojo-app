import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Target, Circle, Trophy, Sun, Zap, Dumbbell, Activity } from 'lucide-react';
import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { venueListJsonLd } from '@/lib/structuredData';
import { KATALOG_SPORT_MAP, FOCUS_SPORT_BY_SLUG } from '@/lib/sports';
import { WOJEWODZTWO_LABEL, type Wojewodztwo } from '@/lib/wojewodztwa';
import { znajdzMiastoPrioryteotowe, liczObiektowWMiescie, PROG_OBIEKTOW_HUB_MIASTA } from '@/lib/hubMiasta';
import { wstepHubuSportuMiasta } from '@/content/boiska';
import { znajdzMiasto } from '@/content/miasta';
import type { Field } from '@/types';

// Warstwa katalogu między hubem krajowym (/boiska/[sport]) i wojewódzkim
// (/boiska/woj/[x]) — roadmapa SEO/GEO, pozycja 20. Uzasadnienie progu i
// wyboru danych w lib/hubMiasta.ts. `force-dynamic`, brak generateStaticParams
// — z tych samych powodów co siostrzane huby (katalog rośnie z każdym
// importem, prerender całości nie skaluje się).
export const dynamic = 'force-dynamic';

const SPORT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'piłka nożna': Target, koszykówka: Circle, siatkówka: Trophy,
  'siatkówka plażowa': Sun, futsal: Zap, 'piłka ręczna': Dumbbell, inne: Activity,
};

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
    voivodeship: row.voivodeship ?? undefined,
  };
}

function numerStrony(searchParams?: { strona?: string }): number {
  const n = Number(searchParams?.strona ?? '1');
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

type Params = { sport: string; miasto: string };

/** Rozwiązanie parametrów trasy wspólne dla generateMetadata i strony —
 *  `null`, gdy sport nieznany, miasto spoza `miasta_priorytetowe` albo para
 *  poniżej progu jakości (lib/hubMiasta.ts). W tym ostatnim wypadku strona
 *  NIE powstaje, zgodnie z decyzją właściciela: pusty listing szkodzi
 *  bardziej niż jego brak. */
async function resolveParams(params: Params): Promise<{ entry: { db: string; label: string }; miasto: string } | null> {
  const entry = KATALOG_SPORT_MAP[params.sport];
  if (!entry) return null;
  const miasto = await znajdzMiastoPrioryteotowe(params.miasto);
  if (!miasto) return null;
  const liczba = await liczObiektowWMiescie(entry.db, miasto);
  if (liczba < PROG_OBIEKTOW_HUB_MIASTA) return null;
  return { entry, miasto };
}

export async function generateMetadata(
  { params, searchParams }: { params: Params; searchParams?: { strona?: string } },
): Promise<Metadata> {
  const resolved = await resolveParams(params);
  if (!resolved) return { title: 'Nie znaleziono' };
  const { entry, miasto } = resolved;
  const strona = numerStrony(searchParams);
  const sufiks = strona > 1 ? ` — strona ${strona}` : '';
  return {
    // BEZ ręcznego „| Bojo” — dokłada go `title.template` z layout.tsx.
    title: `Boiska do ${entry.label}, ${miasto}${sufiks}`,
    description: `Boiska do ${entry.label} w miejscowości ${miasto}. Adresy, sporty, nawierzchnia. Zbierz skład i zagraj przez Bojo.`,
    alternates: {
      canonical: strona > 1
        ? `/boiska/${params.sport}/${params.miasto}?strona=${strona}`
        : `/boiska/${params.sport}/${params.miasto}`,
    },
    openGraph: {
      title: `Boiska do ${entry.label}, ${miasto} | Bojo`,
      description: `Boiska do ${entry.label} w miejscowości ${miasto}.`,
    },
  };
}

export default async function SportMiastoPage(
  { params, searchParams }: { params: Params; searchParams?: { strona?: string } },
) {
  const resolved = await resolveParams(params);
  if (!resolved) notFound();
  const { entry, miasto } = resolved;

  const strona = numerStrony(searchParams);
  const od = (strona - 1) * NA_STRONE;

  const { data, count } = await supabase
    .from('fields')
    .select('id, name, address, lat, lng, sport, surface, is_indoor, district, city, voivodeship', { count: 'exact' })
    .contains('sport', [entry.db])
    .eq('city', miasto)
    .eq('map_visibility', 'public')
    .in('seo_tier', [1, 2])
    .order('name', { ascending: true })
    .range(od, od + NA_STRONE - 1);

  const fields = (data ?? []).map(toField);
  const wszystkich = count ?? fields.length;
  const stron = Math.max(1, Math.ceil(wszystkich / NA_STRONE));

  if (strona > stron && wszystkich > 0) notFound();
  const Icon = SPORT_ICONS[entry.db] ?? Activity;

  const jsonLd = venueListJsonLd(
    `Boiska do ${entry.label}, ${miasto}${strona > 1 ? ` — strona ${strona}` : ''}`,
    fields.map((field) => ({ name: field.name, slug: slugify(field.name) })),
  );

  // Hub województwa: wojewodztwo obiektów w tym mieście jest jedno (miasto
  // leży w dokładnie jednym województwie), więc wystarczy pierwszy wiersz,
  // który je ma. Może być puste, gdy backfill lokalizacji jeszcze nie doszedł
  // do tych obiektów (migracja 112) — wtedy link po prostu nie powstaje.
  const wojewodztwoSlug = fields.find((f) => f.voivodeship)?.voivodeship as Wojewodztwo | undefined;
  const wojewodztwoLabel = wojewodztwoSlug ? WOJEWODZTWO_LABEL[wojewodztwoSlug] : undefined;

  // Hub „Graj" (/[sport]/[miasto]) istnieje tylko dla trzech miast z
  // content/miasta.ts — inny cel niż katalog obiektów (otwarte mecze, nie
  // lista boisk), więc łączymy je tylko, gdy oba naprawdę istnieją.
  const miastoGraj = znajdzMiasto(params.miasto);
  const sportGrajSlug = FOCUS_SPORT_BY_SLUG[params.sport] ? params.sport : undefined;

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
            <Icon className="w-5 h-5 text-primary-700" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Boiska do {entry.label} w miejscowości {miasto}
          </h1>
        </div>

        {/* Bezpośrednia odpowiedź nad listą — bez niej strona jest samym
            listingiem (docs/seo-geo-strategia.md, 3g). Tylko strona 1. */}
        {strona === 1 && (
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            {wstepHubuSportuMiasta(wszystkich, entry.label, miasto)}
          </p>
        )}

        <p className="text-slate-500 text-sm mb-8">
          Znalezionych obiektów: {wszystkich}{stron > 1 ? ` · strona ${strona} z ${stron}` : ''}
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
                      <MapPin className="w-3.5 h-3.5 shrink-0" /> {field.address}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {field.sport.map((s) => {
                        const SIcon = SPORT_ICONS[s] ?? Activity;
                        return (
                          <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                            <SIcon className="w-3 h-3" /> {s}
                          </span>
                        );
                      })}
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
                href={strona === 2 ? `/boiska/${params.sport}/${params.miasto}` : `/boiska/${params.sport}/${params.miasto}?strona=${strona - 1}`}
                rel="prev"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary-200"
              >
                ← Poprzednia
              </Link>
            ) : <span />}

            <span className="text-xs text-slate-400">{strona} z {stron}</span>

            {strona < stron ? (
              <Link
                href={`/boiska/${params.sport}/${params.miasto}?strona=${strona + 1}`}
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
          {miastoGraj && sportGrajSlug && (
            <Link href={`/${sportGrajSlug}/${miastoGraj.slug}`} className="text-primary-600 hover:underline text-sm">
              Szukasz gry {miastoGraj.miejscownik}? Zobacz otwarte mecze →
            </Link>
          )}
        </div>

        {/* Linkowanie poziome (docs/seo-geo-strategia.md, 4b): w górę do huba
            sportu i huba województwa — bez tego strona miejska jest ślepym
            zaułkiem poza wejściem z sitemapa i z /boiska/[sport]. Tylko
            strona 1, jak w siostrzanych hubach. */}
        {strona === 1 && (
          <div className="mt-10 border-t border-slate-200 pt-6">
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-xs">
              <Link href={`/boiska/${params.sport}`} className="text-primary-600 hover:underline">
                Wszystkie boiska: {entry.label} →
              </Link>
              {wojewodztwoSlug && wojewodztwoLabel && (
                <Link href={`/boiska/woj/${wojewodztwoSlug}`} className="text-primary-600 hover:underline">
                  Boiska w województwie {wojewodztwoLabel} →
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
