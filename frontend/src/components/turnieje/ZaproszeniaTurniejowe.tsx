'use client';

/**
 * Sekcja „Zaproszenia do drużyn" na `/moje-gry` — tam, gdzie człowiek widzi
 * już zaproszenia na mecz (`InvitesSection`). Nowe miejsce do nauczenia się
 * byłoby najgorszą możliwą odpowiedzią na pytanie „gdzie to jest".
 *
 * NIE JEST ZA FLAGĄ `SHOW_TURNIEJE`, i to jest świadome. Flaga chowa WEJŚCIA
 * W NAWIGACJI (kafel „🏆 Turnieje" wyżej na tej samej stronie), a to nie jest
 * nawigacja — to konkretna osoba zaprosiła konkretną osobę i czeka na skład.
 * Ukrycie tego byłoby zgubieniem wiadomości, nie schowaniem funkcji.
 *
 * „Dołączam" prowadzi na `/t/[kod]`, nie dołącza od razu: wejście do drużyny
 * ma trzy warianty (zostań kapitanem / „to ja" na wpisie dodanym z ręki /
 * dopisz się jako nowy), o których rozstrzyga stan drużyny. Powielanie tego
 * wyboru na karcie dałoby drugą, rozjeżdżającą się kopię tej samej decyzji.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, CalendarDays, MapPin } from 'lucide-react';
import { getMojeZaproszenia, odrzucZaproszenie } from '@/lib/turniejZaproszenia';
import { etykietaTerminu } from '@/lib/turniejEtykiety';
import { sportEmoji } from '@/lib/sports';
import type { ZaproszenieZKontekstem } from '@/types';

export default function ZaproszeniaTurniejowe({ userId }: { userId: string }) {
  const [zaproszenia, setZaproszenia] = useState<ZaproszenieZKontekstem[]>([]);

  useEffect(() => {
    let aktualne = true;
    getMojeZaproszenia(userId)
      .then((z) => { if (aktualne) setZaproszenia(z); })
      .catch(() => { if (aktualne) setZaproszenia([]); });
    return () => { aktualne = false; };
  }, [userId]);

  const odrzuc = async (id: string) => {
    // Optymistycznie: karta znika od razu, bo „Nie mogę" nie ma czego czekać.
    // Nieudany zapis wraca listą przy następnym wejściu — wiersz zostaje
    // w bazie, więc nic się nie gubi.
    setZaproszenia((obecne) => obecne.filter((z) => z.zaproszenie.id !== id));
    await odrzucZaproszenie(id).catch(() => undefined);
  };

  if (zaproszenia.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-display text-base font-bold text-ink">Zaproszenia do drużyn</h2>
        <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-300">
          {zaproszenia.length}
        </span>
      </div>

      <div className="space-y-2">
        {zaproszenia.map(({ zaproszenie, turniej, druzynaNazwa, kodDolaczenia, zaprosilNazwa }) => (
          <div
            key={zaproszenie.id}
            className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950">
                <Trophy className="h-4 w-4 text-primary-700 dark:text-primary-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {zaprosilNazwa
                    ? `${zaprosilNazwa} zaprasza Cię do drużyny ${druzynaNazwa}`
                    : `Zaproszenie do drużyny ${druzynaNazwa}`}
                </p>
                <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">
                  {sportEmoji(turniej.sport)} {turniej.nazwa}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)}
                  </span>
                  {turniej.miejsceNazwa && (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{turniej.miejsceNazwa}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Link
                href={`/t/${kodDolaczenia}`}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white transition hover:bg-primary-800"
              >
                Dołączam
              </Link>
              <button
                onClick={() => odrzuc(zaproszenie.id)}
                className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-sm font-medium text-slate-500 dark:text-slate-400"
              >
                Nie mogę
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
