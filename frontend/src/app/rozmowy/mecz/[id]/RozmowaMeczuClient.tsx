'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import NaglowekRozmowy from '@/components/rozmowy/NaglowekRozmowy';
import RozmowaWydarzenia from '@/components/events/RozmowaWydarzenia';
import { HideBottomNav } from '@/lib/bottomNavVisibility';
import { useOknoCzatu, styleOknaCzatu } from '@/lib/oknoCzatu';
import { useAuth } from '@/lib/auth';
import { getEvent, getMyActiveEventIds } from '@/lib/events';
import { eventDisplayTitle } from '@/lib/eventTitle';
import { matchWhenLabel } from '@/lib/eventDates';
import { sportEmoji } from '@/lib/sports';
import type { EventItem } from '@/types';

/**
 * `/rozmowy/mecz/[id]` — rozmowa meczu jako pełny ekran komunikatora.
 *
 * Bliźniak `/rozmowy/grupa/[id]`; uzasadnienie w `NaglowekRozmowy`. Rozmowa
 * jest nadal dostępna ze strony meczu — ta trasa obsługuje wejście z LISTY
 * ROZMÓW, gdzie strona meczu ze składem, wynikiem i rozliczeniem jest
 * odpowiedzią na inne pytanie niż „co ktoś napisał".
 *
 * KTO WIDZI: uczestnicy meczu (gram / rezerwa / organizuję) — ten sam zbiór,
 * z którego bierze się lista rozmów (`getMyActiveEventIds`). Prawdziwą
 * bramką jest RLS na `event_comments` (migracja `120`); ten warunek istnieje
 * po to, żeby ktoś z linku dostał zdanie wyjaśnienia zamiast pustego czatu
 * z polem do pisania, które i tak odbije baza.
 */
export default function RozmowaMeczuClient() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const okno = useOknoCzatu(true);

  const [event, setEvent] = useState<EventItem | null>(null);
  const [stan, setStan] = useState<'ladowanie' | 'ok' | 'obcy' | 'brak'>('ladowanie');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setStan('obcy'); return; }
    let aktualne = true;
    (async () => {
      try {
        const [{ event: e }, moje] = await Promise.all([getEvent(id), getMyActiveEventIds(user.id)]);
        if (!aktualne) return;
        setEvent(e);
        setStan(moje.includes(id) || e.organizerId === user.id ? 'ok' : 'obcy');
      } catch {
        if (aktualne) setStan('brak');
      }
    })();
    return () => { aktualne = false; };
  }, [id, user, authLoading]);

  const pelnyEkran = stan === 'ok';

  return (
    <div
      className={`flex flex-col bg-canvas ${pelnyEkran ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'}`}
      style={pelnyEkran ? styleOknaCzatu(okno) : undefined}
    >
      <Header hideMobileBarForUser />
      <main className={`mx-auto w-full max-w-lg flex-1 px-4 py-4 ${pelnyEkran ? 'flex min-h-0 flex-col overflow-hidden' : ''}`}>
        {stan === 'ladowanie' ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : stan === 'brak' ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-ink">Nie ma takiego meczu</p>
            <Link href="/rozmowy" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">
              Wróć do rozmów
            </Link>
          </div>
        ) : stan === 'obcy' ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-ink">Rozmowa jest dla uczestników meczu</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Dołącz do meczu, żeby pisać z resztą składu.
            </p>
            <Link
              href={`/wydarzenia/${id}`}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white transition hover:bg-primary-800"
            >
              Zobacz mecz
            </Link>
          </div>
        ) : event ? (
          <>
            <HideBottomNav />
            <NaglowekRozmowy
              tytul={eventDisplayTitle(event)}
              podtytul={`Otwórz mecz · ${matchWhenLabel(event.date, event.time)}`}
              href={`/wydarzenia/${event.id}`}
              awatar={<span className="text-white">{sportEmoji(event.sport)}</span>}
            />
            <div className={`mt-2 min-h-0 flex-1 ${okno.klawiatura ? '' : 'pb-[max(0.25rem,calc(env(safe-area-inset-bottom)_-_1rem))]'}`}>
              <RozmowaWydarzenia eventId={event.id} klawiatura={okno.klawiatura} />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
