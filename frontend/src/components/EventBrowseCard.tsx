'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MessageCircle } from 'lucide-react';
import type { EventItem } from '@/types';
import type { MyEventStatus, MyEventRelation } from '@/lib/events';
import { eventLocation } from '@/lib/utils';
import { eventDisplayTitle } from '@/lib/eventTitle';
import { timeUntil } from './EventListCard';
import { isUpcoming } from './EventCard';
import { withCount } from '@/lib/plural';
import { plakietkaStanuZapisow } from '@/lib/stanZapisow';
import { usePoMontazu } from '@/lib/usePoMontazu';

/**
 * Participation status → the bottom-right slot, where "Dołącz →" normally sits.
 * This is "my standing / what's next", one value at a time.
 *
 * Ownership is deliberately NOT in here: it's a separate axis rendered as a tag
 * in the meta row, so a match you organize AND play shows both.
 */
// „GRASZ" JEST WYPEŁNIONE, reszta to blade obwódki — i to jest celowa
// nierówność. Na liście własnych meczów pytanie brzmi „w których z nich
// naprawdę gram", a blada plakietka w prawym dolnym rogu odpowiadała na nie
// dopiero po wpatrzeniu się (zgłoszone wprost). Pozostałe stany są słabsze,
// bo znaczą „jesteś obok meczu", nie „jesteś w składzie".
//
// Zieleń, nie różowy/niebieski/pomarańczowy: te trzy mają w całej apce
// zarezerwowane znaczenia (wiadomości / wymaga akceptacji / nowość), a udział
// w składzie nie jest żadnym z nich — to stan, tak samo jak zielony licznik
// nadchodzących meczów na ikonie „Mecze" (AGENTS.md, Konwencje).
const STATUS_CHIP: Partial<Record<MyEventStatus, { label: string; cls: string }>> = {
  playing:   { label: 'Grasz',              cls: 'bg-primary-700 text-white border-primary-700' },
  reserve:   { label: 'Rezerwa',              cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  observing: { label: 'Obserwujesz',          cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending:   { label: 'Czeka na akceptację',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  invited:   { label: 'Zaproszenie →',        cls: 'bg-accent-100 text-primary-900 border-accent-200' },
};

// Past-tense labels for the history tab — "Grasz ✓" on an already-played match
// reads wrong, so a match that has happened gets its own wording.
const PAST_STATUS_CHIP: Partial<Record<MyEventStatus, { label: string; cls: string }>> = {
  playing:   { label: 'Zagrałeś',       cls: 'bg-green-50 text-green-700 border-green-200' },
  reserve:   { label: 'Byłeś rezerwą',  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  observing: { label: 'Obserwowałeś',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending:   { label: 'Nie zaakceptowano', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

/** Compact list row (time | what & where | spots). Used on /wydarzenia and other match lists. */
export function EventBrowseCard({ event, distance, relation, unreadMessages, isNew, odznakiOrganizatora }: {
  event: EventItem; distance?: number; relation?: MyEventRelation;
  /** Nieprzeczytane wiadomości w rozmowie tego meczu — wyłącznie dla kogoś,
   *  kto gra, organizuje albo jest na rezerwie (nie dla „obserwuję" ani
   *  „czeka na akceptację", patrz `getMyActiveEventIds()` w `lib/events.ts`).
   *  Różowy = zawsze wiadomości w tej apce (patrz AGENTS.md, Konwencje). */
  unreadMessages?: number;
  /** Ten konkretny mecz jest nowy od ostatniej wizyty na liście/w ekipie —
   *  pomarańczowa kropka na ikonie sportu, ten sam ślad co zbiorcza kropka
   *  na `/wydarzenia`/karcie ekipy (patrz AGENTS.md, Konwencje: pomarańczowy
   *  = „nowość"). Bez tego zbiorcza kropka nie miała jak wskazać, KTÓRY
   *  konkretnie wpis na liście jest nowy — zgłoszone wprost. */
  isNew?: boolean;
  /** Plakietka dla ORGANIZATORA: ile próśb o dołączenie czeka na decyzję.
   *  Opt-in, bo poza `/moje-gry` ta liczba nie ma komu służyć — na publicznej
   *  liście czy na mapie karta odpowiada na „czy mogę tu zagrać", nie na
   *  „co mam do ogarnięcia".
   *
   *  Zastąpiły DWIE OSOBNE SEKCJE („Czekają na Twoją decyzję", „Brakuje
   *  graczy"), które kroiły tę samą listę nadchodzących meczów co lista
   *  główna. Mecz organizowany, bez kompletu i z prośbą o dołączenie
   *  pojawiał się przez to na jednym ekranie TRZY RAZY. Fakt o meczu należy
   *  do karty meczu, nie do własnego nagłówka. */
  odznakiOrganizatora?: boolean;
}) {
  const pokazNieprzeczytane = !!unreadMessages && unreadMessages > 0
    && !!relation && (relation.isOrganizer || relation.status === 'playing' || relation.status === 'reserve');

  // Świadomie TYLKO prośby. „Brakuje N" też tu kiedyś było i wyleciało:
  // karta mówi to samo już trzy razy — paskiem postępu, licznikiem
  // „7/10 graczy" i bursztynową plakietką „3 wolne miejsca". Czwarta kopia
  // tej samej liczby nic nie dodawała, a zabierała miejsce tytułowi.
  const ilePrósb = relation?.isOrganizer && odznakiOrganizatora
    ? (event.pendingApprovalCount ?? 0)
    : 0;
  const router = useRouter();
  // Etykiety WZGLĘDNE („Dzisiaj”, „Jutro”, „za 2 h”) zależą od „teraz” i od
  // strefy czasowej. Karta renderuje się też na serwerze (sekcja „Możesz
  // dołączyć już dziś” na stronie głównej), a serwer liczy w UTC — tekst
  // różnił się od pierwszego renderu u gracza w Warszawie i React wyrzucał
  // cały HTML strony głównej (W-3, docs/faza1-przejscie-e2e-plan.md). Do
  // montażu karta pokazuje datę bezwzględną; na listach klienckich dane
  // przychodzą i tak po montażu, więc tam nic się nie zmienia.
  const poMontazu = usePoMontazu();

  // Plakietka prowadzi PROSTO do zakładki Rozmowa, nie do zakładki Mecz jak
  // reszta karty — zgłoszone wprost. Nie może być zagnieżdżonym <a> (cała
  // karta to już <Link>), więc przejmuje klik i nawiguje sama, z `stopPropagation`
  // żeby nie odpalić też kliknięcia karty.
  const idzDoRozmowy = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/wydarzenia/${event.id}?tab=rozmowa`);
  };
  const plakietkaRozmowy = pokazNieprzeczytane ? (
    <span
      role="link"
      tabIndex={0}
      aria-label={`Otwórz rozmowę: ${withCount(unreadMessages!, 'nieprzeczytana wiadomość', 'nieprzeczytane wiadomości', 'nieprzeczytanych wiadomości')}`}
      onClick={idzDoRozmowy}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') idzDoRozmowy(e); }}
      className="inline-flex cursor-pointer items-center gap-1 rounded bg-pink-100 px-2 py-0.5 text-[11px] font-bold text-pink-700 transition-colors hover:bg-pink-200 dark:bg-pink-950 dark:text-pink-300"
    >
      <MessageCircle className="h-3 w-3" /> {unreadMessages}
    </span>
  ) : null;

  const max = event.maxPlayers ?? 0;
  const taken = event.participantsCount ?? 0;
  const left = max > 0 ? Math.max(0, max - taken) : 0;
  const full = max > 0 && taken >= max;
  // Zamknięte zapisy wygrywają z kompletem — uzasadnienie w `lib/stanZapisow.ts`.
  const stanZapisow = plakietkaStanuZapisow(event.zapisyZamkniete, full);

  let dayLabel = '';
  try {
    const d = parseISO(event.date);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const evDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((evDay.getTime() - now.getTime()) / 86400000);
    if (poMontazu && diff === 0) dayLabel = 'Dzisiaj';
    else if (poMontazu && diff === 1) dayLabel = 'Jutro';
    else dayLabel = format(d, 'EEE d MMM', { locale: pl });
  } catch { /* ignore */ }
  const timeLabel = event.time ? event.time.slice(0, 5) : '';
  const until = poMontazu ? timeUntil(event.date, event.time ?? undefined) : null;
  const cancelled = event.status === 'cancelled';
  const past = cancelled || !isUpcoming(event);
  const statusChip = relation ? (past ? PAST_STATUS_CHIP : STATUS_CHIP)[relation.status] : undefined;

  const location = eventLocation(event).primary;
  const title = eventDisplayTitle(event);
  const costGrosze = event.costGrosze ?? 0;
  const free = costGrosze <= 0;
  const priceLabel = free
    ? 'Za darmo'
    : `${(costGrosze / 100).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł`;

  // Po meczu cena traci znaczenie — liczy się rozliczenie. Organizator widzi ile
  // osób jeszcze nie zapłaciło, gracz widzi swój własny status.
  const paymentBadge = (() => {
    if (cancelled || costGrosze <= 0) return null;
    if (relation?.isOrganizer) {
      const unpaid = event.unpaidCount ?? 0;
      return unpaid === 0
        ? { label: 'Rozliczono', cls: 'bg-green-50 text-green-700' }
        : { label: withCount(unpaid, 'osoba nie zapłaciła', 'osoby nie zapłaciły', 'osób nie zapłaciło'), cls: 'bg-amber-100 text-amber-700' };
    }
    if (relation?.status === 'playing') {
      return relation.hasPaid
        ? { label: 'Zapłacono', cls: 'bg-green-50 text-green-700' }
        : { label: 'Zapłać', cls: 'bg-amber-100 text-amber-700' };
    }
    return null;
  })();

  // CAŁA KARTA ZIELENIEJE, gdy naprawdę gram (zgłoszone wprost). Sama
  // plakietka „Grasz ✓" w rogu wymagała szukania wzrokiem; zielone tło i obwódka
  // dają odpowiedź „to jest moje" z odległości ręki, bez czytania.
  //
  // Tylko `status === 'playing'` — nie rezerwa, nie oczekiwanie na akceptację
  // i nie „organizuję, ale nie gram". Zieleń ma tu znaczyć DOKŁADNIE jedno:
  // jesteś w składzie. Rozmyta na „prawie gram" przestałaby cokolwiek znaczyć.
  //
  // Lewa krawędź zostaje w kolorze SPORTU — to inna informacja i nie ma powodu,
  // żeby jedna wypierała drugą.
  const gram = !past && relation?.status === 'playing';

  // WIERSZ LISTY, NIE KARTA (redesign 2026-09). Wcześniej: zaokrąglona karta
  // z cieniem, kolorowa lewa krawędź, emoji sportu w kafelku i pasek postępu.
  // Właściciel zgłosił wprost, że ramki zjadają miejsce, a obrazki i ikony na
  // liście są zbędne. Układ jak w tabeli: godzina | co i gdzie | ile miejsc.
  // Zieleń dla „gram" i kolory zarezerwowane (różowy, niebieski, pomarańczowy)
  // zostają z tymi samymi znaczeniami.
  const wolneKolor = full ? 'text-blue-700 dark:text-blue-300' : left <= 2 ? 'text-amber-600' : 'text-primary-700';
  return (
    <Link
      href={`/wydarzenia/${event.id}`}
      className={`grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-3 border-b border-slate-200 py-3.5 transition-colors dark:border-slate-700 ${
        gram ? '-mx-2 rounded bg-primary-50/70 px-2 dark:bg-primary-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
      } ${past ? 'opacity-60' : ''}`}
    >
      {/* KIEDY */}
      <div className="min-w-0 pt-px">
        <span className="flex items-center gap-1 text-[15px] font-medium tabular-nums text-ink">
          {timeLabel || '–'}
          {isNew && (
            <span className="h-1.5 w-1.5 shrink-0 bg-orange-500" aria-label="nowy mecz" />
          )}
        </span>
        <span className="block whitespace-nowrap text-xs text-slate-500 first-letter:uppercase dark:text-slate-400">{dayLabel}</span>
      </div>

      {/* CO I GDZIE. `min-w-0`: bez niego `line-clamp` przestaje działać
          i długi tytuł rozpycha wiersz. `line-clamp-2`, nie `truncate`:
          „Czwartkowa gierka" ma się zmieścić w całości (zgłoszone z QA). */}
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 text-[15px] font-semibold leading-snug text-ink line-clamp-2">{title}</h3>
          {plakietkaRozmowy && <span className="shrink-0 pt-0.5">{plakietkaRozmowy}</span>}
        </div>
        {(location || distance !== undefined) && (
          <p className="mt-0.5 text-[13px] leading-snug text-slate-500 line-clamp-2 dark:text-slate-400">
            {location}
            {location && distance !== undefined && ' · '}
            {distance !== undefined && (distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`)}
          </p>
        )}
        {/* Znaczniki: tylko to, co coś zmienia w decyzji. Odliczanie WYŁĄCZNIE
            dla meczu, który się odbędzie (odwołany na dziś nie może wyglądać
            jak coś, na co trzeba zdążyć). Konkretna liczba próśb WYPIERA ogólne
            „Wymaga akceptacji" — ta sama niebieska barwa, mocniejsze zdanie. */}
        {(relation?.isOrganizer || (until && !cancelled) || (!past && (ilePrósb > 0 || event.requireApproval)) || statusChip) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {relation?.isOrganizer && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Organizujesz</span>
            )}
            {until && !cancelled && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">{until}</span>
            )}
            {!past && (ilePrósb > 0 ? (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                {withCount(ilePrósb, 'prośba', 'prośby', 'próśb')}
              </span>
            ) : event.requireApproval && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                Wymaga akceptacji
              </span>
            ))}
            {statusChip && (
              <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${statusChip.cls}`}>
                {statusChip.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ILE MIEJSC / JAK SIĘ SKOŃCZYŁO. Zamknięte zapisy wygrywają
          z kompletem — uzasadnienie w `lib/stanZapisow.ts`. */}
      <div className="flex flex-col items-end gap-0.5 text-right">
        {past ? (
          <>
            {cancelled ? (
              // Czerwień, nie szarość — tak jak wszędzie, gdzie ta apka mówi
              // o odwołaniu: „czerwień znaczy «coś poszło źle»".
              <span className="text-[13px] font-semibold text-red-600 dark:text-red-400">Anulowany</span>
            ) : (
              <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">Rozegrany</span>
            )}
            {paymentBadge && (
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${paymentBadge.cls}`}>{paymentBadge.label}</span>
            )}
            {max > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{withCount(taken, 'gracz', 'gracze', 'graczy')}</span>
            )}
          </>
        ) : (
          <>
            {max > 0 && (stanZapisow ? (
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${stanZapisow.klasy}`}>{stanZapisow.napis}</span>
            ) : (
              <span className={`text-[14px] font-semibold ${wolneKolor}`}>
                {left} {left === 1 || (left % 10 >= 2 && left % 10 <= 4 && (left % 100 < 12 || left % 100 > 14)) ? 'wolne' : 'wolnych'}
              </span>
            ))}
            {max > 0 && (
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{taken}/{max} graczy</span>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400">{free ? 'za darmo' : priceLabel}</span>
          </>
        )}
      </div>
    </Link>
  );
}
