'use client';

import { useState } from 'react';
import { X, Share2 } from 'lucide-react';
import { WARSTWA } from '@/lib/warstwy';
import { udostepnijZaproszenieGoscia } from '@/lib/guestClaim';
import type { DaneDoUdostepnienia } from '@/lib/eventShare';

/**
 * Zachęta pokazywana od razu po dopisaniu gościa bez konta do wydarzenia.
 *
 * Zamiast czekać, aż organizator sam zauważy mały link „Zaproś do Bojo” przy
 * imieniu gościa w składzie, proponujemy wysłanie zaproszenia od razu —
 * z argumentacją opartą na tym, co aplikacja faktycznie robi (nie obietnicach):
 * gość bez konta nie dostaje powiadomienia o zmianie terminu ani odwołaniu
 * meczu (patrz `powiadom_o_odwolaniu()`, migracja 070 — wysyła tylko do
 * `user_id IS NOT NULL`).
 *
 * Pokazywana tylko raz na wydarzenie (`bojo:goscie-cta-widziano:<eventId>`,
 * ustawiane przez wywołującego w `EventDetailClient.tsx`) — organizator
 * dopisujący 14 osób pod rząd nie potrzebuje 14 identycznych modali.
 */
export default function GuestInviteNudge({
  guestName,
  claimToken,
  event,
  zapraszajacy,
  onClose,
}: {
  guestName: string;
  claimToken: string;
  event: DaneDoUdostepnienia;
  zapraszajacy?: string;
  onClose: () => void;
}) {
  const [wyslano, setWyslano] = useState(false);

  const wyslijZaproszenie = async () => {
    const wynik = await udostepnijZaproszenieGoscia(guestName, claimToken, event, zapraszajacy);
    if (wynik === 'copied' || wynik === 'shared') setWyslano(true);
  };

  return (
    <div
      className={`fixed inset-0 ${WARSTWA.modal} flex items-end justify-center bg-black/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-ink">{guestName} dodany(a) do meczu ✓</h2>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm font-medium text-slate-700">
            Zaproś {guestName} do Bojo — zyskujesz na tym Ty, nie tylko on(a):
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              • Dostanie powiadomienie, jeśli zmienisz termin albo odwołasz mecz — gość
              bez konta o tym nie wie, musiałbyś go informować sam.
            </li>
            <li>
              • Zostanie w Twojej bazie graczy — następnym razem zaprosisz go jednym
              kliknięciem, zamiast dopisywać ręcznie za każdym razem.
            </li>
            <li>
              • Sam potwierdzi udział albo się wypisze, jeśli coś mu wypadnie — nie
              musisz robić tego za niego.
            </li>
          </ul>

          <button
            type="button"
            onClick={wyslijZaproszenie}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"
          >
            <Share2 className="h-4 w-4" />
            {wyslano ? 'Zaproszenie gotowe do wysłania' : 'Wyślij zaproszenie'}
          </button>
          <p className="text-center text-xs text-slate-400">
            Wyślij ten link w wiadomości prywatnej (SMS, Messenger, WhatsApp).
          </p>
        </div>
      </div>
    </div>
  );
}
