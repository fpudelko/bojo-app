'use client';

import { useState } from 'react';
import { Check, Copy, Loader2, Radar, Share2, Users } from 'lucide-react';
import { eventUrl, shareEvent, textDoKopiowania, type StanUdostepnienia } from '@/lib/eventShare';
import type { EventItem } from '@/types';

/**
 * Zaproszenie znajomych do meczu: udostępnienie systemowe + kopiowanie linku.
 *
 * DWA PRZYCISKI, NIE JEDEN. Samo „Udostępnij" otwiera systemowe okno wyboru
 * aplikacji, którego część ludzi po prostu zamyka — a wtedy zostają z niczym.
 * „Kopiuj" daje link do ręki i działa wszędzie, także tam, gdzie
 * `navigator.share` nie istnieje.
 *
 * JEDEN ADRES DLA CAŁEJ APLIKACJI. Panel udostępniał kiedyś własny link
 * (`/d/{kod}`), inny niż przycisk „Udostępnij" w pasku górnym — ten sam mecz,
 * dwa adresy, dwa przyciski o tej samej nazwie na jednej stronie. Dziś oba
 * wołają `shareEvent` z adresem kanonicznym; dlaczego kanoniczny, a nie
 * krótszy — patrz komentarz przy `eventUrl` w `lib/eventShare.ts`.
 *
 * WSPÓLNY KOMPONENT, bo to samo pytanie („kogo jeszcze wziąć?") pada w dwóch
 * miejscach: w widoku meczu i przy najbliższym meczu ekipy. Tam stał wcześniej
 * pojedynczy przycisk „Udostępnij mecz" — ta sama sprawa załatwiona o połowę
 * gorzej, bez kopiowania linku.
 *
 * `stan` (opcjonalny) dokłada do wiadomości liczbę wolnych miejsc i — gdy da
 * się to uczciwie powiedzieć — zdanie o zapisie bez konta (`lib/eventShare.ts`,
 * ustalenie `S-5`). Bez niego panel zachowuje się dokładnie jak dotąd; wołający
 * bez dostępu do składu (np. lista) po prostu go nie podaje.
 *
 * `onZaprosZGrupy` (opcjonalny) dokłada trzeci przycisk — imienne zaproszenie
 * z listy członków ekipy. Wcześniej to była osobna, stała pozycja gdzie indziej
 * na stronie meczu; zebrane tutaj, żeby "zaproś kogoś" miało jedno miejsce,
 * nie dwa (zgłoszone wprost z sesji UX 2026-09-13). Bez handlera przycisk się
 * nie renderuje — `NajblizszyMeczGrupy.tsx` woła panel bez niego.
 *
 * `onOtworzDlaOkolicy` (opcjonalny) dokłada czwarty przycisk — z `CzyGramyPanel`,
 * gdzie stał jako osobna karta nad licznikiem miejsc, z własnym akapitem i własnym
 * ujęciem tej samej liczby: licznik mówił „Zostało 13 wolnych miejsc", a karta
 * obok „Brakuje 13". Dwa sposoby opisania jednego stanu na jednym ekranie czytały
 * się jak dwie różne informacje (zgłoszone wprost). Tutaj liczba pada RAZ, w
 * liczniku, a to jest po prostu czwarty sposób na zapełnienie składu — obok
 * linku, kopiowania i zaproszenia z ekipy.
 */
export default function ZaprosZnajomychPanel(
  { event, stan, onZaprosZGrupy, onOtworzDlaOkolicy, busy = false }: {
    event: EventItem;
    stan?: StanUdostepnienia;
    onZaprosZGrupy?: () => void;
    onOtworzDlaOkolicy?: () => void;
    busy?: boolean;
  },
) {
  const [copied, setCopied] = useState(false);

  const link = () => eventUrl(
    event.id,
    typeof window !== 'undefined' ? window.location.origin : 'https://bojo.pl',
  );

  const potwierdz = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(textDoKopiowania(event, link(), stan));
      potwierdz();
    } catch { /* ignore */ }
  };

  const share = async () => {
    const wynik = await shareEvent(event, link(), stan);
    if (wynik === 'copied') potwierdz();
  };

  return (
    // `data-zapros-znajomych` — zaczep dla scenariusza „Kopiuj potwierdza
    // skopiowanie linku". Test szukał wcześniej karty przez
    // `ancestor::div[1]` od tytułu, co działało tylko dopóki tytuł był
    // BEZPOŚREDNIM dzieckiem karty. Gdy przyciski przestały się mieścić
    // w jednej linii i tytuł dostał własny wiersz, ten lokator zaczął
    // trafiać w nagłówek — bez przycisków. Atrybut trzyma się układu.
    <div
      data-zapros-znajomych
      className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 shrink-0 text-slate-400" />
        {/* „Zaproś", nie „Zaproś znajomych" — zgłoszone wprost 2026-09-13.
            Słowo zawężało do kumpli, a z tej karty wychodzą dziś cztery różne
            drogi: link, kopiowanie, zaproszenie z ekipy i otwarcie meczu dla
            okolicy — czyli głównie dla ludzi, których organizator nie zna. */}
        <p className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Zaproś</p>
      </div>
      {/* `flex-wrap`, nie sztywny rząd — trzeci przycisk (`onZaprosZGrupy`)
          na 360 px nie mieści się już obok dwóch pozostałych w jednej linii. */}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          onClick={share}
          className="flex items-center gap-1.5 rounded-xl bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-800 active:scale-95"
        >
          <Share2 className="h-3.5 w-3.5" /> Udostępnij
        </button>
        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-600 dark:text-slate-200"
        >
          {copied ? <><Check className="h-3.5 w-3.5 text-green-600" /> OK</> : <><Copy className="h-3.5 w-3.5" /> Kopiuj</>}
        </button>
        {onZaprosZGrupy && (
          <button
            onClick={onZaprosZGrupy}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-600 dark:text-slate-200"
          >
            <Users className="h-3.5 w-3.5" /> Zaproś z grupy
          </button>
        )}
        {onOtworzDlaOkolicy && (
          <button
            onClick={onOtworzDlaOkolicy}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
            Otwórz dla okolicy
          </button>
        )}
      </div>
    </div>
  );
}
