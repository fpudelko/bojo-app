import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Target, Circle, Trophy, Sun, Zap, Dumbbell, Activity } from 'lucide-react';
import Header from '@/components/layout/Header';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { venueListJsonLd } from '@/lib/structuredData';
import { FOCUS_SPORT_BY_SLUG } from '@/lib/sports';
import type { Field } from '@/types';

// ---------------------------------------------------------------------------
// Sport mapping: URL slug → DB value → display name
// ---------------------------------------------------------------------------
const SPORT_MAP: Record<string, { db: string; label: string }> = {
  'pilka-nozna':      { db: 'piłka nożna',      label: 'piłki nożnej' },
  'koszykowka':       { db: 'koszykówka',         label: 'koszykówki' },
  'siatkowka':        { db: 'siatkówka',          label: 'siatkówki' },
  'siatkowka-plazowa':{ db: 'siatkówka plażowa',  label: 'siatkówki plażowej' },
  'futsal':           { db: 'futsal',             label: 'futsalu' },
  'pilka-reczna':     { db: 'piłka ręczna',       label: 'piłki ręcznej' },
  'inne':             { db: 'inne',               label: 'innych sportów' },
};

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
  if (!entry) return { title: 'Nie znaleziono | Bojo' };
  const strona = numerStrony(searchParams);
  const sufiks = strona > 1 ? ` — strona ${strona}` : '';
  return {
    title: `Boiska do ${entry.label} w Polsce${sufiks} | Bojo`,
    description: `Znajdź boiska do ${entry.label} w Polsce. Lista obiektów, lokalizacje, dostępność. Bojo — zbierz skład i zagraj.`,
    alternates: {
      canonical: strona > 1 ? `/boiska/${params.sport}?strona=${strona}` : `/boiska/${params.sport}`,
    },
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
  const { data, count } = await supabase
    .from('fields')
    .select('id, name, address, lat, lng, sport, surface, is_indoor, district', { count: 'exact' })
    .contains('sport', [entry.db])
    .eq('map_visibility', 'public')
    .order('name', { ascending: true })
    .range(od, od + NA_STRONE - 1);

  const fields = (data ?? []).map(toField);
  const wszystkich = count ?? fields.length;
  const stron = Math.max(1, Math.ceil(wszystkich / NA_STRONE));

  // Numer strony poza zakresem to nie jest pusta lista, tylko zły adres.
  if (strona > stron && wszystkich > 0) notFound();
  const Icon = SPORT_ICONS[entry.db] ?? Activity;

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
          {FOCUS_SPORT_BY_SLUG[params.sport] && (
            <Link href={`/graj/${params.sport}/poznan`} className="text-primary-600 hover:underline text-sm">
              Szukasz gry w Poznaniu? Zobacz otwarte mecze →
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
