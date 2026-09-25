'use client';

import { Banknote, Check, Clock } from 'lucide-react';
import type { PaymentMethod } from '@/types';
import { PAYMENT_METHOD_LABELS, priceForParticipant } from '@/lib/payments';
import { zl } from '@/lib/kwota';

/**
 * Karta „Twoja płatność” — kwota do zapłaty, sposób, numer BLIK i status.
 *
 * WSPÓLNA dla gracza z kontem (strona meczu) i gościa bez konta (strona wpisu
 * `/gracz/przejmij/[token]`). Do 2026-09-25 istniała wyłącznie na stronie
 * meczu, więc gość, czyli dokładnie ten, kogo organizator przyprowadza linkiem
 * „zapisujesz się bez zakładania konta”, widział samą kwotę: bez numeru BLIK,
 * bez sposobu i bez statusu wpłaty (W-4, docs/faza1-przejscie-e2e-plan.md).
 *
 * Regułę odsłonięcia numeru BLIK liczy WOŁAJĄCY (`canSeeBlikPhone()` na
 * stronie meczu, baza w `podejrzyj_wpis_goscia()` dla gościa) — tu przychodzi
 * już wynik: `blikTelefon` do pokazania albo `blikPozniej`, gdy numer będzie
 * godzinę przed meczem.
 */
export default function TwojaPlatnosc({
  kosztGrosze, znizkaKartyGrosze, kartaSportowa, metoda,
  blikTelefon, blikPozniej, pokazStatus, oplacone,
}: {
  kosztGrosze: number;
  znizkaKartyGrosze: number | null | undefined;
  kartaSportowa: boolean;
  metoda: PaymentMethod | null | undefined;
  blikTelefon: string | null | undefined;
  blikPozniej: boolean;
  /** `events.show_payment_status` — organizator może ukryć, kto już zapłacił. */
  pokazStatus: boolean;
  oplacone: boolean;
}) {
  // Cenę liczy wyłącznie `priceForParticipant()` (AGENTS.md, „Płatności”).
  const cena = priceForParticipant(kosztGrosze, znizkaKartyGrosze, kartaSportowa);
  const pokazBlik = metoda === 'blik' && (!!blikTelefon || blikPozniej);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6" data-twoja-platnosc>
      <h2 className="font-semibold text-ink flex items-center gap-2 mb-3">
        <Banknote className="w-4 h-4" /> Twoja płatność
      </h2>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-500">Do zapłaty</span>
        <span className="min-w-0 text-right font-semibold text-ink">
          {cena.discountUnspecified
            ? 'Zniżka z karty, ustal kwotę z organizatorem'
            : zl(cena.priceGrosze)}
        </span>
      </div>
      {kartaSportowa && !cena.discountUnspecified && cena.priceGrosze < kosztGrosze && (
        <p className="mt-1 text-right text-xs text-slate-400">
          <span className="line-through">{zl(kosztGrosze)}</span>
          {' '}· zniżka z karty sportowej
        </p>
      )}
      {metoda && (
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate-500">Sposób</span>
          <span className="text-ink">{PAYMENT_METHOD_LABELS[metoda]}</span>
        </div>
      )}
      {/* Numer do BLIKA tuż przy kwocie: „ile" i „na co przelać" to jedna
          czynność. */}
      {pokazBlik && (
        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <span className="shrink-0 text-slate-500">Numer BLIK</span>
          {blikTelefon ? (
            <span className="min-w-0 font-semibold text-ink">{blikTelefon}</span>
          ) : (
            <span className="min-w-0 text-right text-slate-400">zobaczysz na godzinę przed meczem</span>
          )}
        </div>
      )}
      {pokazStatus && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          {oplacone ? (
            <span className="inline-flex items-center gap-1.5 rounded bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              <Check className="w-3.5 h-3.5" strokeWidth={2.25} /> Opłacone
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              <Clock className="w-3.5 h-3.5" strokeWidth={2.25} /> Jeszcze nieopłacone
            </span>
          )}
        </div>
      )}
    </div>
  );
}
