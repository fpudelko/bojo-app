import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Target, Circle, Trophy, Sun, Zap, Dumbbell, Activity } from 'lucide-react';
import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import { slugify } from '@/lib/utils';
import { venueListJsonLd } from '@/lib/structuredData';
import { FOCUS_SPORT_BY_SLUG, KATALOG_SPORT_MAP } from '@/lib/sports';
import { WOJEWODZTWA, WOJEWODZTWO_LABEL } from '@/lib/wojewodztwa';
import { wstepHubuSportu } from '@/content/boiska';
import { MIASTA } from '@/content/miasta';
import { miastaPowyzejProguDlaSportu } from '@/lib/hubMiasta';
import { obiektyHubuSportu, metadanePaginacjiHuba } from '@/lib/hubKatalogu';
import type { Field } from '@/types';

// ---------------------------------------------------------------------------
// Sport mapping: URL slug → DB value → display name
// ---------------------------------------------------------------------------
const SPORT_MAP = KATALOG_SPORT_MAP;

const SPORT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'piłka nożna': Target, koszykówka: Circle, siatkówka: Trophy,
  'siatkówka plażowa': Sun, futsal: Zap, 'piłka ręczna': Dumbbell, inne: Activity,
};

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
  };
}

// Ile obiektów na stronę. Powód nie jest kosmetyczny: przy katalogu
// ogólnopolskim ta strona renderowała CAŁĄ listę w jednym HTML-u i urosła do
// 25 MB, co Vercel odrzuca przy zapamiętywaniu odpowiedzi (limit ~19 MB).
// Niezależnie od limitu — nikt nie przewija czterech tysięcy pozycji.
const NA_STRONE = 60;

// Renderowanie na żądanie. Numer strony siedzi w parametrze zapytania, a nie
// w ścieżce — przy stronie zapamiętanej jako statyczna Next mógłby oddawać tę
// samą treść niezależnie od `?strona=`, czyli paginacja wyglądałaby na zepsutą.
// Zapytanie jest tanie: sześćdziesiąt wierszy i osiem kolumn.
//
// Prerenderowanie wszystkich kombinacji sport × strona i tak nie wchodzi
// w grę: liczba stron zależy od wielkości katalogu, a ten rośnie z każdym
// importem — dokładnie ten sam powód co przy `/boisko/[id]`.
export const dynamic = 'force-dynamic';

function numerStrony(searchParams?: { strona?: string }): number {
  const n = Number(searchParams?.strona ?? '1');
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export async function generateMetadata(
  { params, searchParams }: { params: { sport: string }; searchParams?: { strona?: string } },
): Promise<Metadata> {
  const entry = SPORT_MAP[params.sport];
  if (!entry) return { title: 'Nie znaleziono' };
  const strona = numerStrony(searchParams);
  const sufiks = strona > 1 ? ` — strona ${strona}` : '';
  const { canonical, robots } = metadanePaginacjiHuba(`/boiska/${params.sport}`, strona);
  return {
    // BEZ ręcznego „| Bojo” — dokłada go `title.template` z layout.tsx.
    title: `Boiska do ${entry.label} w Polsce${sufiks}`,
    description: `Znajdź boiska do ${entry.label} w Polsce. Lista obiektów, lokalizacje, dostępność. Bojo — zbierz skład i zagraj.`,
    alternates: { canonical },
    robots,
    openGraph: {
      title: `Boiska do ${entry.label} w Polsce | Bojo`,
      description: `Lista boisk do ${entry.label} w Polsce.`,
    },
  };
}

export default async function SportCategoryPage(
  { params, searchParams }: { params: { sport: string }; searchParams?: { strona?: string } },
) {
  const entry = SPORT_MAP[params.sport];
  if (!entry) notFound();

  const strona = numerStrony(searchParams);
  const od = (strona - 1) * NA_STRONE;

  // `count: 'exact'` zamiast pobierania wszystkiego i liczenia w JavaScripcie —
  // to była jedna z dwóch rzeczy, które nadmuchały tę stronę do 25 MB.
  // Zapytanie (z filtrem seo_tier, dług D11) wydzielone do lib/hubKatalogu.ts —
  // testowalne bez renderowania JSX.
  const { data, count } = await obiektyHubuSportu(entry.db, od, od + NA_STRONE - 1);

  const fields = (data ?? []).map(toField);
  const wszystkich = count ?? fields.length;
  const stron = Math.max(1, Math.ceil(wszystkich / NA_STRONE));

  // Numer strony poza zakresem to nie jest pusta lista, tylko zły adres.
  if (strona > stron && wszystkich > 0) notFound();
  const Icon = SPORT_ICONS[entry.db] ?? Activity;

  // Linkowanie w dół do hubów miejskich (poz. 20 roadmapy) — tylko strona 1,
  // z tego samego powodu co blok województw niżej. Tylko miasta powyżej progu
  // jakości (lib/hubMiasta.ts): link do strony, która i tak nie powstanie
  // (za mało obiektów), byłby gorszy niż jego brak. Zapytanie zdegradowane do
  // pustej listy przy błędzie — to sekcja dodatkowa, nie ma degradować całej
  // strony, która już ma dane do pokazania.
  const miastaHuba = strona === 1 ? await miastaPowyzejProguDlaSportu(entry.db).catch(() => []) : [];

  // Machine-readable version of the same list, so crawlers get the venues as
  // data instead of having to scrape the markup.
  // JSON-LD opisuje TĘ stronę listy, nie cały katalog. Wrzucenie tam wszystkich
  // obiektów było drugą przyczyną rozmiaru: ta sama lista szła dwa razy — raz
  // jako HTML, raz jako dane dla robotów.
  const jsonLd = venueListJsonLd(
    `Boiska do ${entry.label} w Polsce${strona > 1 ? ` — strona ${strona}` : ''}`,
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
            <Icon className="w-5 h-5 text-primary-700" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 capitalize">
            Boiska do {entry.label} w Polsce
          </h1>
        </div>

        {/* Bezpośrednia odpowiedź nad listą — bez niej strona jest samym
            listingiem, dokładnie tym, co przegrywa z serwisami mającymi
            przewagę wieku (docs/seo-geo-strategia.md, 3g). */}
        {wszystkich > 0 && strona === 1 && (
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            {wstepHubuSportu(wszystkich, entry.label)}
          </p>
        )}

        <p className="text-slate-500 text-sm mb-8">
          {wszystkich > 0
            ? `Znalezionych obiektów: ${wszystkich}${stron > 1 ? ` · strona ${strona} z ${stron}` : ''}`
            : 'Brak obiektów w bazie.'}
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
                href={strona === 2 ? `/boiska/${params.sport}` : `/boiska/${params.sport}?strona=${strona - 1}`}
                rel="prev"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary-200"
              >
                ← Poprzednia
              </Link>
            ) : <span />}

            <span className="text-xs text-slate-400">{strona} z {stron}</span>

            {strona < stron ? (
              <Link
                href={`/boiska/${params.sport}?strona=${strona + 1}`}
                rel="next"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary-200"
              >
                Następna →
              </Link>
            ) : <span />}
          </nav>
        )}

        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <Link href="/mapa" className="text-primary-600 hover:underline text-sm">
            ← Wróć do mapy boisk
          </Link>
          <Link href="/jak-dziala-bojo" className="text-primary-600 hover:underline text-sm">
            Jak działa Bojo — zbierz skład na to boisko →
          </Link>
          {/* Wejście do landingów `/[sport]/[miasto]`. Do 2026-08-26 stał tu jeden
              link zaszyty na sztywno na Poznań, więc osiem z dwunastu tych stron
              (Warszawa, Kraków) nie miało wejścia z hubu, a ktoś szukający gry
              w Krakowie dostawał link do Poznania. Lista idzie z `MIASTA` — tej
              samej stałej, z której `generateStaticParams()` tamtej trasy buduje
              strony, a `dynamicParams = false` gwarantuje, że innych nie ma. Dzięki
              temu nie da się tu wskazać strony, która nie istnieje, i nie da się
              zapomnieć o mieście dopisanym do `MIASTA`. */}
          {FOCUS_SPORT_BY_SLUG[params.sport] && (
            <p className="text-sm text-slate-600">
              Szukasz gry? Zobacz otwarte mecze{' '}
              {MIASTA.map((m, i) => (
                <span key={m.slug}>
                  {i > 0 && ' · '}
                  <Link
                    href={`/${params.sport}/${m.slug}`}
                    className="text-primary-600 hover:underline"
                  >
                    {m.miejscownik}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>

        {/* Linkowanie poziome (docs/seo-geo-strategia.md, 4b/16): bez tego hub
            sportu był ślepym zaułkiem poza wejściem z sitemapa. Tylko strona 1
            — dalsze strony paginacji nie powinny powielać ten sam blok linków
            (D15: te strony są dziś self-canonical i bez noindex). */}
        {strona === 1 && (
          <div className="mt-10 border-t border-slate-200 pt-6 space-y-6">
            {miastaHuba.length > 0 && (
              <div>
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Boiska do {entry.label} w miastach
                </p>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                  {miastaHuba.map((m) => (
                    <Link
                      key={m.slug}
                      href={`/boiska/${params.sport}/${m.slug}`}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      {m.nazwa}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                Boiska do {entry.label} w województwach
              </p>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                {WOJEWODZTWA.map((woj) => (
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
