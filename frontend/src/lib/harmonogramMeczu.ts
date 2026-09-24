// F-3 (docs/faza1-organizator-plan.md): „Co Bojo zrobi za Ciebie" — organizator
// nie widział ŻADNEGO z trzech zegarów Bojo (przypomnienia, kolejka rezerwy,
// domknięcie po meczu). Panel „Mecz gotowy" mówił zawsze „Przypomnienie wyśle
// się samo" — nieprawda dla meczu założonego po 18:00 dzień przed terminem albo
// w dniu meczu, bo `wyslij_przypomnienia()` bierze wyłącznie `event_date = jutro`.
//
// Czysta funkcja, zero zapytań do bazy — karta w `components/events/HarmonogramMeczu.tsx`
// renderuje to, co tu wychodzi.
import type { EventItem, EventParticipant } from '@/types';

/** Lustro `cron.schedule('bojo-przypomnienia', '0 16 * * *', …)` z migracji `129`.
 *  Pilnuje go `harmonogramMeczu.test.ts`, czytając ostatnią definicję zadania
 *  z plików migracji — zmiana godziny w SQL bez zmiany tutaj wywraca Vitest. */
export const PRZYPOMNIENIA_UTC = { godzina: 16, minuta: 0 } as const;

export type PozycjaHarmonogramu =
  /** Skład dostanie automatyczne przypomnienie dzień przed meczem. */
  | { klucz: 'przypomnienie'; kiedy: Date }
  /** Mecz powstał za późno (albo w dniu meczu) — okno `wyslij_przypomnienia()`
   *  na `event_date = jutro` już minęło albo nie zdąży złapać tego meczu. */
  | { klucz: 'przypomnienie_za_pozno' }
  /** Rezerwa włączona: ile czasu ma pierwsza osoba w kolejce na decyzję, gdy
   *  zwolni się miejsce. Informacyjne — nie zależy od tego, czy akurat ktoś
   *  ma aktywną ofertę. */
  | { klucz: 'rezerwa'; minuty: number }
  /** N osób w składzie nie dostanie ŻADNEJ wiadomości od Bojo: gość bez konta
   *  i bez zapisanego e-maila (`ma_guest_email`, migracja `137`). */
  | { klucz: 'bez_wiadomosci'; ile: number }
  /** Dzień po meczu Bojo przypomni organizatorowi o wyniku i/albo rozliczeniu
   *  — tylko gdy mecz faktycznie coś z tego śledzi. */
  | { klucz: 'po_meczu'; kiedy: Date };

/** „18:00" z instantu UTC, w czasie polskim — niezależnie od strefy czasowej
 *  urządzenia, na którym otwarta jest strona (przenośne między kartą
 *  „Co Bojo zrobi za Ciebie" i panelem „Mecz gotowy"). */
export function godzinaPolska(d: Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Warsaw',
  }).format(d);
}

/** Moment (jako `Date`, czyli instant UTC), w którym cron `bojo-przypomnienia`
 *  wyśle przypomnienie dla meczu w dniu `data` — dzień wcześniej, o godzinie
 *  z `PRZYPOMNIENIA_UTC`. `null`, gdy `data` się nie parsuje. */
function chwilaPrzypomnienia(data: string): Date | null {
  const [y, m, d] = data.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d - 1, PRZYPOMNIENIA_UTC.godzina, PRZYPOMNIENIA_UTC.minuta, 0));
}

/** Moment, w którym cron wyśle przypomnienie „po meczu" — dzień PO meczu,
 *  ta sama godzina (blok C tego samego zadania). */
function chwilaPoMeczu(data: string): Date | null {
  const [y, m, d] = data.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d + 1, PRZYPOMNIENIA_UTC.godzina, PRZYPOMNIENIA_UTC.minuta, 0));
}

export function harmonogramMeczu(
  e: Pick<EventItem, 'date' | 'costGrosze' | 'trackResults' | 'reserveEnabled' | 'reserveClaimMinutes' | 'status'>,
  sklad: Pick<EventParticipant, 'isGuest' | 'userId' | 'maGuestEmail' | 'isReserve' | 'pendingApproval' | 'rsvp'>[],
  teraz: Date = new Date(),
): PozycjaHarmonogramu[] {
  if (e.status === 'cancelled') return [];

  const pozycje: PozycjaHarmonogramu[] = [];

  const chwilaP = chwilaPrzypomnienia(e.date);
  if (chwilaP) {
    pozycje.push(teraz.getTime() >= chwilaP.getTime()
      ? { klucz: 'przypomnienie_za_pozno' }
      : { klucz: 'przypomnienie', kiedy: chwilaP });
  }

  if (e.reserveEnabled) {
    pozycje.push({ klucz: 'rezerwa', minuty: e.reserveClaimMinutes });
  }

  // Ten sam filtr co w `129`/`160` (blok „po meczu" pomija gości bez adresu
  // z tego samego powodu): tylko gość, którego Bojo NIE MA JAK zawiadomić.
  const bezWiadomosci = sklad.filter((p) => p.isGuest && !p.userId && !p.maGuestEmail).length;
  if (bezWiadomosci > 0) {
    pozycje.push({ klucz: 'bez_wiadomosci', ile: bezWiadomosci });
  }

  // Lustro warunku bloku C w `wyslij_przypomnienia()` (migracje `129`/`160`):
  // przypomnienie „po meczu" powstaje tylko, gdy jest co domknąć.
  if (e.costGrosze > 0 || e.trackResults) {
    const chwilaC = chwilaPoMeczu(e.date);
    if (chwilaC) pozycje.push({ klucz: 'po_meczu', kiedy: chwilaC });
  }

  return pozycje;
}
