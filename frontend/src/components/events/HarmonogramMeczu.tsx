'use client';

import { Clock, ListOrdered, MailX, Banknote, Share2, Users } from 'lucide-react';
import { harmonogramMeczu, godzinaPolska, type PozycjaHarmonogramu } from '@/lib/harmonogramMeczu';
import { czasRezerwyTekst } from '@/lib/events';
import { withCount } from '@/lib/plural';
import type { EventItem, EventParticipant } from '@/types';

/**
 * Karta „Co Bojo zrobi za Ciebie" — organizator nie widział żadnego z trzech
 * zegarów Bojo (przypomnienia, kolejka rezerwy, domknięcie po meczu), a panel
 * „Mecz gotowy" obiecywał „Przypomnienie wyśle się samo" nawet wtedy, gdy mecz
 * powstał za późno, żeby cron w ogóle go złapał. F-3, docs/faza1-organizator-plan.md.
 *
 * Czysto prezentacyjna: cała logika (kiedy, dla kogo, czy w ogóle) siedzi
 * w `harmonogramMeczu()`, zero nowego zapytania do bazy.
 */
export default function HarmonogramMeczu({
  event,
  sklad,
  onWyslijLinkTeraz,
  onPokazGoscBezWiadomosci,
  teraz,
}: {
  event: Pick<EventItem, 'date' | 'costGrosze' | 'trackResults' | 'reserveEnabled' | 'reserveClaimMinutes' | 'status'>;
  sklad: Pick<EventParticipant, 'isGuest' | 'userId' | 'maGuestEmail' | 'isReserve' | 'pendingApproval' | 'rsvp'>[];
  onWyslijLinkTeraz: () => void;
  onPokazGoscBezWiadomosci: () => void;
  /** Wyłącznie do testów — domyślnie `new Date()`. */
  teraz?: Date;
}) {
  const pozycje = harmonogramMeczu(event, sklad, teraz);
  if (pozycje.length === 0) return null;

  return (
    <div className="border-y border-slate-200 px-4 py-4 dark:border-slate-700">
      <p className="font-semibold text-ink">Co Bojo zrobi za Ciebie</p>
      <ul className="mt-2.5 space-y-2.5">
        {pozycje.map((p) => (
          <WierszHarmonogramu
            key={p.klucz}
            pozycja={p}
            onWyslijLinkTeraz={onWyslijLinkTeraz}
            onPokazGoscBezWiadomosci={onPokazGoscBezWiadomosci}
          />
        ))}
      </ul>
    </div>
  );
}

function WierszHarmonogramu({
  pozycja, onWyslijLinkTeraz, onPokazGoscBezWiadomosci,
}: {
  pozycja: PozycjaHarmonogramu;
  onWyslijLinkTeraz: () => void;
  onPokazGoscBezWiadomosci: () => void;
}) {
  switch (pozycja.klucz) {
    case 'przypomnienie':
      return (
        <Wiersz ikona={Clock}>
          Dzień przed meczem, ok. {godzinaPolska(pozycja.kiedy)}, skład dostanie przypomnienie.
        </Wiersz>
      );
    case 'przypomnienie_za_pozno':
      return (
        <li className="flex items-start gap-2.5">
          <IkonaKrag ikona={Clock} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Na automatyczne przypomnienie jest już za późno.
            </p>
            <button
              type="button"
              onClick={onWyslijLinkTeraz}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
            >
              <Share2 className="h-3 w-3" strokeWidth={2.5} /> Wyślij link teraz
            </button>
          </div>
        </li>
      );
    case 'rezerwa':
      return (
        <Wiersz ikona={ListOrdered}>
          Zwolni się miejsce? Pierwsza osoba z rezerwy ma {czasRezerwyTekst(pozycja.minuty)} na decyzję.
        </Wiersz>
      );
    case 'bez_wiadomosci':
      return (
        <li className="flex items-start gap-2.5">
          <IkonaKrag ikona={MailX} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {withCount(pozycja.ile, 'osoba', 'osoby', 'osób')} w składzie nie dostanie żadnej wiadomości od Bojo.
            </p>
            <button
              type="button"
              onClick={onPokazGoscBezWiadomosci}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
            >
              <Users className="h-3 w-3" strokeWidth={2.5} /> Pokaż kogo
            </button>
          </div>
        </li>
      );
    case 'po_meczu':
      return (
        <Wiersz ikona={Banknote}>
          Dzień po meczu przypomnimy Ci o wyniku i rozliczeniu.
        </Wiersz>
      );
    default:
      return null;
  }
}

function IkonaKrag({ ikona: Ikona }: { ikona: typeof Clock }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      <Ikona className="h-3.5 w-3.5" strokeWidth={2.25} />
    </span>
  );
}

function Wiersz({ ikona, children }: { ikona: typeof Clock; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <IkonaKrag ikona={ikona} />
      <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">{children}</p>
    </li>
  );
}
