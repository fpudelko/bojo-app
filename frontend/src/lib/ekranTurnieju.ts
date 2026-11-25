// Ekran turnieju na halę (`/turnieje/[id]/ekran`): układy, motyw, adres
// i logika „co teraz pokazać”. Jedno źródło dla ekranu i dla panelu
// organizatora (menu „Ekran na halę”, Ustawienia), żeby lista układów i ich
// opisy nie rozjechały się między dwoma miejscami. Czyste funkcje: zegar
// przychodzi z zewnątrz.
import type { TurniejPrzerwa } from '@/types';

export type UkladEkranu = 'wszystko' | 'mecz' | 'wynik' | 'tabele' | 'mecze' | 'terminarz' | 'ogloszenie' | 'zmiana';
export type MotywEkranu = 'ciemny' | 'jasny';

/**
 * Kolejność = kolejność w menu. Opis odpowiada na pytanie organizatora
 * „kiedy tego użyć”, nie „co to jest”.
 */
export const UKLADY_EKRANU: readonly { klucz: UkladEkranu; etykieta: string; opis: string }[] = [
  { klucz: 'wszystko', etykieta: 'Pełny widok', opis: 'mecz na żywo i kolejne mecze, obok na zmianę tabele, wyniki i strzelcy' },
  // BIEŻĄCY MECZ (2026-11-25, prośba właściciela): jeden mecz na cały ekran,
  // np. telewizor przy boisku. Przy kilku boiskach wybór boiska (`?boisko=`).
  { klucz: 'mecz', etykieta: 'Bieżący mecz', opis: 'jeden mecz na cały ekran: wynik, zegar i strzelcy; przy kilku boiskach wybierasz boisko' },
  { klucz: 'wynik', etykieta: 'Tablica wyników', opis: 'wynik meczu w toku na pół ekranu, jak na stadionie' },
  { klucz: 'tabele', etykieta: 'Tabele grup', opis: 'wszystkie grupy w dużym rozmiarze, np. przed fazą pucharową' },
  { klucz: 'mecze', etykieta: 'Mecze i wyniki', opis: 'mecz na żywo, kolejne mecze i wyniki, bez tabel' },
  { klucz: 'terminarz', etykieta: 'Terminarz dnia', opis: 'wszystkie mecze do końca dnia: odpowiedź na „kiedy gramy?”' },
  { klucz: 'ogloszenie', etykieta: 'Ogłoszenie i zbiórka', opis: 'Twój tekst i duży kod QR zbiórki na cały ekran, na przerwy' },
  { klucz: 'zmiana', etykieta: 'Pokaz na zmianę', opis: 'ekran sam przełącza tablicę wyników, tabele, terminarz i ogłoszenie co 20 s' },
];

/** Miniatura układu (zrzut przykładowego turnieju, `scripts/podglady-ekranu.mjs`). */
export function podgladUkladu(uklad: Exclude<UkladEkranu, 'zmiana'>, motyw: MotywEkranu): string {
  return `/ekran-podglad/${uklad}-${motyw}.jpg`;
}

export const CZAS_UKLADU_NA_ZMIANE_MS = 20_000;

export function czyUkladEkranu(x: string | null | undefined): x is UkladEkranu {
  return !!x && UKLADY_EKRANU.some((u) => u.klucz === x);
}

/** Adres ekranu z wybranym układem i motywem; domyślne wartości nie trafiają do adresu. */
export function adresEkranu(adresTurnieju: string, opcje: { uklad?: UkladEkranu; motyw?: MotywEkranu; boisko?: string } = {}): string {
  const p = new URLSearchParams();
  if (opcje.uklad && opcje.uklad !== 'wszystko') p.set('uklad', opcje.uklad);
  if (opcje.boisko) p.set('boisko', opcje.boisko);
  if (opcje.motyw === 'jasny') p.set('motyw', 'jasny');
  const q = p.toString();
  return `/turnieje/${adresTurnieju}/ekran${q ? `?${q}` : ''}`;
}

/**
 * Układy, przez które przechodzi „Na zmianę”: tylko te, które mają co
 * pokazać. Ogłoszenie bez tekstu i linku to pusty ekran, a tabele w pucharze
 * bez grup nie istnieją.
 */
export function ukladyNaZmiane(stan: { maMecz: boolean; maTabele: boolean; maTerminarz: boolean; maOgloszenie: boolean }): UkladEkranu[] {
  const lista: UkladEkranu[] = [];
  if (stan.maMecz) lista.push('wynik');
  if (stan.maTabele) lista.push('tabele');
  if (stan.maTerminarz) lista.push('terminarz');
  if (stan.maOgloszenie) lista.push('ogloszenie');
  return lista.length > 0 ? lista : ['wszystko'];
}

/** Przerwa z nazwą (176), która trwa w tej chwili: ekran pokazuje ją zamiast „Następny mecz”. */
export function przerwaTeraz<P extends Pick<TurniejPrzerwa, 'odAt' | 'doAt'>>(przerwy: readonly P[], teraz: Date): P | null {
  const t = teraz.getTime();
  return przerwy.find((p) => new Date(p.odAt).getTime() <= t && t < new Date(p.doAt).getTime()) ?? null;
}

/** Adres bez `https://` i bez końcowego ukośnika, do podpisu pod kodem QR. */
export function adresDoPodpisu(link: string): string {
  return link.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}
