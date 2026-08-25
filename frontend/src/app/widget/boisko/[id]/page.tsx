import type { Metadata } from 'next';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sportEmoji } from '@/lib/sports';
import { LogoWordmark } from '@/components/Logo';
import { WIDGET_BRAK_MECZOW, WIDGET_STOPKA, WIDGET_NIEZNANY_OBIEKT } from '@/content/widget';

// ---------------------------------------------------------------------------
// Widget „najbliższe mecze na tym obiekcie" dla zarządców (roadmapa SEO/GEO,
// poz. 24 — F5). Trasa PRZEZNACZONA do osadzenia w <iframe> na stronie
// obiektu, wydawana z /admin/outreach (lib/widget.ts#kodOsadzeniaWidgetu).
// Zero nawigacji Bojo (Header/SiteFooter/dolna nawigacja) — sam fragment.
//
// Globalne UI (baner cookies, zachęta do instalacji PWA, modal onboardingu,
// rejestracja service workera) montuje się w app/layout.tsx dla KAŻDEJ
// trasy — to nie może wjechać do cudzej strony przez iframe. Rozwiązane w
// lib/widget.ts#useJestWidget(), sprawdzane przez te komponenty osobno, bo
// root layout nie da się pominąć (jeden na całą aplikację).
//
// `id` to zawsze surowy UUID obiektu (nie slug) — adres wydajemy sami z
// /admin/outreach, więc nie ma potrzeby rozwiązywać starych/duplikowanych
// nazw jak w app/boisko/[id]/page.tsx.
export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

interface WidgetEvent {
  id: string;
  sport: string;
  date: string;
  time: string;
  maxPlayers: number;
  currentCount: number;
}

async function getField(id: string): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase.from('fields').select('id, name').eq('id', id).maybeSingle();
  return data ?? null;
}

async function getUpcomingEvents(fieldId: string): Promise<WidgetEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('events')
    .select('id, sport, event_date, event_time, max_players')
    .eq('field_id', fieldId)
    .eq('visibility', 'public')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(5);
  if (!data) return [];

  const eventIds = data.map((e) => e.id);
  const { data: counts } = await supabase
    .from('event_participants')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('is_reserve', false);

  const countMap: Record<string, number> = {};
  for (const c of counts ?? []) countMap[c.event_id] = (countMap[c.event_id] ?? 0) + 1;

  return data.map((e) => ({
    id: e.id,
    sport: e.sport,
    date: e.event_date,
    time: e.event_time?.slice(0, 5) ?? '',
    maxPlayers: e.max_players,
    currentCount: countMap[e.id] ?? 0,
  }));
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Widget: najbliższe mecze',
    // Fragment do osadzenia, nie strona do znalezienia w wyszukiwarce —
    // `follow: true`, żeby link do bojo.pl w środku dalej niósł sygnał.
    robots: { index: false, follow: true },
  };
}

export default async function WidgetBoiskoPage({ params }: { params: { id: string } }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bojo.pl';
  const field = await getField(params.id).catch(() => null);

  if (!field) {
    return (
      <div className="p-4 text-sm text-slate-500">
        {WIDGET_NIEZNANY_OBIEKT}
      </div>
    );
  }

  const events = await getUpcomingEvents(field.id).catch(() => []);

  return (
    <div className="flex max-h-[420px] flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <p className="mb-3 font-semibold text-slate-900 truncate">{field.name}</p>

      {events.length > 0 ? (
        <ul className="flex-1 divide-y divide-slate-100">
          {events.map((ev) => {
            let dateStr = ev.date;
            try { dateStr = format(parseISO(ev.date), 'd MMM', { locale: pl }); } catch { /* zostaje ISO */ }
            const spotsLeft = ev.maxPlayers - ev.currentCount;
            return (
              <li key={ev.id} className="py-2.5">
                <a
                  href={`${base}/wydarzenia/${ev.id}`}
                  target="_top"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 hover:opacity-80"
                >
                  <span className="flex items-center gap-2 text-slate-700">
                    <span aria-hidden>{sportEmoji(ev.sport)}</span>
                    <span className="flex flex-col">
                      <span className="font-medium capitalize">{ev.sport}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" /> {dateStr} · {ev.time}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      spotsLeft <= 0
                        ? 'bg-red-100 text-red-700'
                        : spotsLeft <= 3
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {spotsLeft <= 0 ? 'Pełne' : `+${spotsLeft} miejsc`}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex-1 text-slate-400">{WIDGET_BRAK_MECZOW}</p>
      )}

      <a
        href={base}
        target="_top"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 hover:text-primary-700"
      >
        <LogoWordmark iconSize={18} />
        {WIDGET_STOPKA}
      </a>
    </div>
  );
}
