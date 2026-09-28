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
  naRezerwie = false,
  blik = false,
  onClose,
}: {
  guestName: string;
  claimToken: string;
  event: DaneDoUdostepnienia;
  zapraszajacy?: string;
  /** Gość poszedł na rezerwę (komplet w składzie) — modal ma o tym mówić
   *  wprost, bo dotąd tę informację niósł wyłącznie toast, który ten modal
   *  teraz zastępuje (patrz `EventDetailClient.tsx#handleAddGuest`). */
  naRezerwie?: boolean;
  /** Mecz płatny i przyjmuje BLIK (Z-4, docs/faza1-runda10-plan.md) — link
   *  ma wtedy wspomnieć numer, który odsłoni się godzinę przed meczem. */
  blik?: boolean;
  onClose: () => void;
}) {
  const [wyslano, setWyslano] = useState(false);

  const wyslijZaproszenie = async () => {
    const wynik = await udostepnijZaproszenieGoscia(
      guestName, claimToken, event, { naRezerwie, poMeczu: false, blik }, zapraszajacy,
    );
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
        <div className="flex items-start gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            {/* „Dodano „{imię}"", nie „{imię} dodany(a)" — polska odmiana imion
                wymaga znajomości płci, a formularz jej nie zbiera. „dodany(a)"
                jest widoczną łatą na ten problem, nie odpowiedzią na niego.
                Zgłoszone wprost z sesji QA. Rezerwa dostaje WŁASNY nagłówek
                (Z-4, docs/faza1-runda10-plan.md) zamiast osobnej linijki pod
                spodem — „do składu" przy kimś, kto jest na rezerwie, było
                nieprawdą. */}
            <h2 className="font-semibold text-ink">
              {naRezerwie ? <>Dodano „{guestName}" na listę rezerwową</> : <>Dodano „{guestName}" do składu ✓</>}
            </h2>
          </div>
          <button onClick={onClose} className="ml-auto shrink-0 text-slate-400 hover:text-slate-600" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {/* Z-4 (docs/faza1-runda10-plan.md): dawne „Zaproś go do Bojo i
              zautomatyzuj zarządzanie" + trzy punkty obiecywało powiadomienia
              o zmianach, mimo że gość dostanie je dopiero po podaniu adresu
              albo po założeniu konta — nie od samego kliknięcia. Zdanie mówi
              teraz wyłącznie to, co ten link robi OD RAZU. */}
          <p className="text-sm text-slate-600">
            Wyślij mu link do jego zapisu. Bez zakładania konta sprawdzi tam skład i koszt,
            a jeśli coś wypadnie, sam się wypisze i miejsce przejdzie na kolejną osobę.
          </p>

          <button
            type="button"
            onClick={wyslijZaproszenie}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"
          >
            <Share2 className="h-4 w-4" />
            {wyslano ? 'Zaproszenie gotowe do wysłania' : 'Wyślij link do zapisu'}
          </button>
          <p className="text-center text-xs text-slate-400">
            Wyślij ten link w wiadomości prywatnej (SMS, Messenger, WhatsApp).
          </p>
          {/* Organizator dopisujący skład zwykle wpisuje kilka osób pod rząd —
              bez tego przycisku jedyną drogą powrotu do pola „Imię znajomego"
              był mały X w rogu, nieopisany jako „kontynuuj dopisywanie".
              Zgłoszone wprost z sesji QA. Pole na stronie jest już wyczyszczone
              (`setGuestName('')` po udanym dodaniu), więc samo zamknięcie
              modala wystarcza — nie trzeba nic dodatkowo resetować. */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-1 text-center text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Dodaj kolejnego
          </button>
        </div>
      </div>
    </div>
  );
}
