import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { MapPin, Target, Circle, Trophy, Sun, Zap, Dumbbell, Activity } from 'lucide-react';
import Header from '@/components/layout/Header';
import { slugify } from '@/lib/utils';
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

function serverClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  );
}

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
  };
}

export async function generateStaticParams() {
  return Object.keys(SPORT_MAP).map((sport) => ({ sport }));
}

export async function generateMetadata({ params }: { params: { sport: string } }): Promise<Metadata> {
  const entry = SPORT_MAP[params.sport];
  if (!entry) return { title: 'Nie znaleziono | Bojo' };
  return {
    title: `Boiska do ${entry.label} w Poznaniu | Bojo`,
    description: `Znajdź boiska do ${entry.label} w Poznaniu. Pełna lista obiektów, lokalizacje, dostępność. Bojo — zbierz skład i zagraj.`,
    openGraph: {
      title: `Boiska do ${entry.label} w Poznaniu | Bojo`,
      description: `Lista boisk do ${entry.label} w Poznaniu.`,
    },
  };
}

export default async function SportCategoryPage({ params }: { params: { sport: string } }) {
  const entry = SPORT_MAP[params.sport];
  if (!entry) notFound();

  const supabase = serverClient();
  const { data } = await supabase
    .from('fields')
    .select('*')
    .contains('sport', [entry.db])
    .order('name', { ascending: true });

  const fields = (data ?? []).map(toField);
  const Icon = SPORT_ICONS[entry.db] ?? Activity;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary-100 rounded-xl">
            <Icon className="w-5 h-5 text-primary-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 capitalize">
            Boiska do {entry.label} w Poznaniu
          </h1>
        </div>
        <p className="text-gray-500 text-sm mb-8">
          {fields.length > 0
            ? `Znalezionych obiektów: ${fields.length}`
            : 'Brak obiektów w bazie.'}
        </p>

        {fields.length > 0 && (
          <ul className="space-y-3">
            {fields.map((field) => (
              <li key={field.id}>
                <Link
                  href={`/boisko/${slugify(field.name)}`}
                  className="flex items-start gap-4 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-primary-200 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{field.name}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1 truncate">
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
                  <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${field.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {field.available ? 'Dostępne' : 'Niedostępne'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 text-center">
          <Link href="/mapa" className="text-primary-600 hover:underline text-sm">
            ← Wróć do mapy boisk
          </Link>
        </div>
      </main>
    </div>
  );
}
