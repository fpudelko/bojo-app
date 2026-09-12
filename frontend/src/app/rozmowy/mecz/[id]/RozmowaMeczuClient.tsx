'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import NaglowekRozmowy from '@/components/rozmowy/NaglowekRozmowy';
import RozmowaWydarzenia from '@/components/events/RozmowaWydarzenia';
import { useOknoCzatu, styleOknaCzatu, WYSOKOSC_CZATU_BEZ_POMIARU } from '@/lib/oknoCzatu';
import { useAuth } from '@/lib/auth';
import { getEvent, getMyActiveEventIds } from '@/lib/events';
import { kluczRozmowyWidziano } from '@/lib/comments';
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

  // PRZECZYTANE ZNACZY PRZECZYTANE. Licznik nieprzeczytanych liczy się ze
  // znacznika „widziano" w `localStorage` (`lib/comments.ts`), a znacznik
  // zapisywała WYŁĄCZNIE zakładka Rozmowa na stronie meczu
  // (`EventDetailClient`). Ta trasa — czyli ta, którą wchodzi się z listy
  // rozmów, a więc po powiadomieniu — nie zapisywała go wcale, więc „2
  // nieprzeczytane wiadomości" wisiały po przeczytaniu i po odpisaniu.
  // Zgłoszone wprost. `RozmowyClient` odświeża listę przy powrocie na kartę
  // i już wtedy zakładał, że ten znacznik istnieje.
  //
  // Znacznik idzie przy WEJŚCIU i przy WYJŚCIU: wiadomość, która przyszła
  // w trakcie czytania, jest przeczytana tak samo jak te sprzed wejścia.
  useEffect(() => {
    if (stan !== 'ok' || typeof window === 'undefined') return;
    const oznaczPrzeczytane = () => {
      try {
        window.localStorage.setItem(kluczRozmowyWidziano(id), new Date().toISOString());
      } catch { /* tryb prywatny */ }
    };
    oznaczPrzeczytane();
    return oznaczPrzeczytane;
  }, [stan, id]);

  const pelnyEkran = stan === 'ok';

  return (
    <div
      className={`flex flex-col bg-canvas ${pelnyEkran ? `${WYSOKOSC_CZATU_BEZ_POMIARU} overflow-hidden` : 'min-h-screen'}`}
      style={pelnyEkran ? styleOknaCzatu(okno) : undefined}
    >
      <Header hideMobileBarForUser />
      {/* `pb-0` na pełnym ekranie: pod czatem nie ma już nic poza paskiem
          nawigacji (albo klawiaturą), więc odstęp byłby pustym pasem. */}
      <main className={`mx-auto w-full max-w-lg flex-1 px-4 pt-4 ${pelnyEkran ? 'flex min-h-0 flex-col overflow-hidden pb-0' : 'pb-4'}`}>
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
            <NaglowekRozmowy
              tytul={eventDisplayTitle(event)}
              podtytul={`Otwórz mecz · ${matchWhenLabel(event.date, event.time)}`}
              href={`/wydarzenia/${event.id}`}
              awatar={<span className="text-white">{sportEmoji(event.sport)}</span>}
            />
            {/* Bez własnego odstępu na dole: pod czatem stoi teraz pasek
                nawigacji (odjęty od wysokości przez `--bottom-nav-h`), a on
                niesie już wcięcie na kreskę gestów. Przy otwartej klawiaturze
                zmienna schodzi do zera i czat sięga wprost nad klawiaturę. */}
            <div className="mt-2 min-h-0 flex-1">
              <RozmowaWydarzenia eventId={event.id} klawiatura={okno.klawiatura} />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
