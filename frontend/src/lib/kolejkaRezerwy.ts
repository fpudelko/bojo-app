// Kolejka rezerwowa widziana z przeglądarki — LUSTRO `sync_reserve_claim()`
// (migracja `135`, wcześniej `118`/`130`).
//
// PO CO OSOBNY MODUŁ. Numer „N. w kolejce" był dotąd liczony w dwóch miejscach
// `EventDetailClient.tsx`, na dwa różne sposoby, i dawał dwie różne liczby dla
// tej samej osoby:
//
//   * baner rezerwowego (`myReservePosition`) filtrował tylko `!claimPassed`
//     i IGNOROWAŁ ROLĘ — a baza prowadzi dwie osobne kolejki: pole i bramkarze
//     (`czy_na_rezerwe()`). Bramkarz stojący jako jedyny w swojej kolejce
//     czytał „Rezerwa · 4." i „przed Tobą 3 osoby", choć wchodził następny;
//   * okno zapisu (`pozycjaWKolejce`) rolę uwzględniało.
//
// Do tego żadne z nich nie wiedziało o `oferta_wygasla_at` (`135`), czyli
// o osobach zepchniętych na koniec kolejki. Liczba, którą Bojo pokazuje
// graczowi, musi wynikać z TEJ SAMEJ reguły, którą baza rozdaje miejsca —
// inaczej jest zgadywaniem podanym jako fakt.
//
// Reguła sortowania, jeden do jednego z SQL-em:
//   ORDER BY (oferta_wygasla_at IS NOT NULL), oferta_wygasla_at, zapisano_at
import { momentZapisu } from './events';
import type { EventParticipant } from '@/types';

/** Kto w ogóle stoi w kolejce po zwolnione miejsce.
 *
 *  Warunki z `WHERE` w `sync_reserve_claim()`. `user_id IS NOT NULL` (gość bez
 *  konta) jest tu ŚWIADOMIE POMINIĘTY — o tym rozstrzyga osobno `czekaNaOferte`,
 *  bo to reguła doręczenia, nie kolejności. */
function wKolejce(p: EventParticipant): boolean {
  return !!p.isReserve && !p.claimPassed && !p.pendingApproval && p.rsvp !== 'maybe';
}

/** Porównanie dwóch wpisów wg kolejności, w jakiej baza rozdaje miejsca.
 *
 *  Nigdy nieominięci najpierw, w kolejności zapisu. Za nimi ci, którym oferta
 *  wygasła — a wśród nich ten, którego ominięto NAJDAWNIEJ. */
function poKolejnosci(a: EventParticipant, b: EventParticipant): number {
  const aW = a.ofertaWygaslaAt ? 1 : 0;
  const bW = b.ofertaWygaslaAt ? 1 : 0;
  if (aW !== bW) return aW - bW;
  if (aW === 1 && a.ofertaWygaslaAt !== b.ofertaWygaslaAt) {
    return a.ofertaWygaslaAt! < b.ofertaWygaslaAt! ? -1 : 1;
  }
  // `momentZapisu()`, nie gołe `zapisanoAt`: wiersz obserwującego powstaje
  // wcześniej niż prawdziwy zapis (migracja `110`), a baza sortuje po tej samej
  // kolumnie.
  const aZ = momentZapisu(a);
  const bZ = momentZapisu(b);
  if (aZ === bZ) return 0;
  return aZ < bZ ? -1 : 1;
}

/**
 * Kolejka po zwolnione miejsce, w kolejności rozdawania ofert.
 *
 * @param rezerwy  wszystkie wpisy z `isReserve`
 * @param gkEnabled czy mecz rozróżnia bramkarzy — jeśli nie, kolejka jest jedna
 * @param bramkarz  której kolejki dotyczy pytanie (ignorowane bez `gkEnabled`)
 */
export function kolejkaRezerwy(
  rezerwy: EventParticipant[],
  gkEnabled: boolean,
  bramkarz: boolean,
): EventParticipant[] {
  return rezerwy
    .filter((p) => wKolejce(p) && (!gkEnabled || !!p.isGoalkeeper === bramkarz))
    .sort(poKolejnosci);
}

/**
 * Które miejsce w kolejce zajmuje ten wpis (1 = następny). `null`, gdy w
 * kolejce go nie ma — bo odpuścił, czeka na akceptację albo tylko obserwuje.
 *
 * `null` jest tu ISTOTNE, nie brakiem danych: baner ma wtedy powiedzieć, czemu
 * numeru nie ma, zamiast pokazywać „0." albo puste miejsce po liczbie (stara
 * wersja robiła dokładnie to — `findIndex` zwracał `-1`, `+1` dawało `0`,
 * a `0 || null` gasiło liczbę bez słowa wyjaśnienia).
 */
export function pozycjaWKolejce(
  wpis: EventParticipant,
  rezerwy: EventParticipant[],
  gkEnabled: boolean,
): number | null {
  const i = kolejkaRezerwy(rezerwy, gkEnabled, !!wpis.isGoalkeeper)
    .findIndex((p) => p.id === wpis.id);
  return i === -1 ? null : i + 1;
}

/**
 * Które miejsce zajmie ktoś, kto zapisze się TERAZ w danej roli.
 *
 * Używa tego okno zapisu („Zapiszesz się na listę rezerwową jako N. w kolejce"),
 * więc liczy długość kolejki + 1 — nowy wpis ma najświeższe `zapisano_at`, więc
 * ląduje na końcu grupy „nigdy nieominięci", ale PRZED tymi z wygasłą ofertą.
 */
export function pozycjaPoZapisie(
  rezerwy: EventParticipant[],
  gkEnabled: boolean,
  bramkarz: boolean,
): number {
  const kolejka = kolejkaRezerwy(rezerwy, gkEnabled, bramkarz);
  return kolejka.filter((p) => !p.ofertaWygaslaAt).length + 1;
}

/**
 * Czy ten wpis w ogóle dostanie ofertę zwolnionego miejsca.
 *
 * Od migracji `137` gość Z ADRESEM dostaje ją mailem, na równi z kontem —
 * wcześniej `sync_reserve_claim()` filtrowało `user_id IS NOT NULL` i pomijało
 * go PO CICHU, choć mail „jesteś na rezerwie" obiecywał mu ofertę wprost.
 *
 * Gość BEZ adresu jest dalej pomijany, bo nie ma jak go zawiadomić — i to musi
 * być widoczne dla organizatora, patrz `pominietyWKolejce()`.
 */
export function czekaNaOferte(p: EventParticipant): boolean {
  return wKolejce(p) && (!!p.userId || !!p.maGuestEmail);
}

/**
 * Odwrotność `czekaNaOferte()` dla wpisów, które STOJĄ w kolejce, ale nigdy nie
 * zostaną zaproszone: gość bez adresu e-mail.
 *
 * Osobna funkcja, a nie negacja w komponencie, bo to jest ostrzeżenie DLA
 * ORGANIZATORA, nie stan gracza — i ma się pokazać wyłącznie tam, gdzie da się
 * z nim coś zrobić (dopisać adres albo awansować ręcznie).
 */
export function pominietyWKolejce(p: EventParticipant): boolean {
  return wKolejce(p) && !p.userId && !p.maGuestEmail;
}

/**
 * Kiedy wygaśnie AKTYWNA oferta tego wpisu — deadline, do którego trzeba
 * kliknąć „Wchodzę", zanim `sync_reserve_claim()` przekaże miejsce dalej.
 * `null`, gdy nikt nie ma teraz wystawionej oferty.
 *
 * Jedno źródło tej daty: dotąd liczył ją tylko banner „jesteś następny" dla
 * WŁASNEJ oferty (`EventDetailClient.tsx`) — kolejka widoczna dla innych
 * (organizator, reszta rezerwy) pokazywała samą etykietkę „czeka na decyzję"
 * bez terminu, więc nikt poza samym zainteresowanym nie wiedział, ile czasu
 * zostało (zgłoszone wprost, audyt S-1, druga część).
 */
export function terminOferty(p: EventParticipant, reserveClaimMinutes: number): Date | null {
  return p.claimOfferedAt
    ? new Date(new Date(p.claimOfferedAt).getTime() + reserveClaimMinutes * 60_000)
    : null;
}
