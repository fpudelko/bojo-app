'use client';

import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { eventUrl, shareEvent } from '@/lib/eventShare';
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
 */
export default function ZaprosZnajomychPanel({ event }: { event: EventItem }) {
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
      await navigator.clipboard.writeText(link());
      potwierdz();
    } catch { /* ignore */ }
  };

  const share = async () => {
    const wynik = await shareEvent(event, link());
    if (wynik === 'copied') potwierdz();
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <Share2 className="h-4 w-4 shrink-0 text-slate-400" />
      <p className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Zaproś znajomych</p>
      <div className="flex shrink-0 gap-2">
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
      </div>
    </div>
  );
}
