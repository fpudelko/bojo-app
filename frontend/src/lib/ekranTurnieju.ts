// Ekran turnieju na halę (`/turnieje/[id]/ekran`): układy, motyw, adres
// i logika „co teraz pokazać”. Jedno źródło dla ekranu i dla panelu
// organizatora (menu „Ekran na halę”, Ustawienia), żeby lista układów i ich
// opisy nie rozjechały się między dwoma miejscami. Czyste funkcje: zegar
// przychodzi z zewnątrz.
import type { TurniejPrzerwa } from '@/types';

export type UkladEkranu = 'wszystko' | 'wynik' | 'tabele' | 'mecze' | 'terminarz' | 'ogloszenie' | 'zmiana';
export type MotywEkranu = 'ciemny' | 'jasny';

/**
 * Kolejność = kolejność w menu. Opis odpowiada na pytanie organizatora
 * „kiedy tego użyć”, nie „co to jest”.
 */
export const UKLADY_EKRANU: readonly { klucz: UkladEkranu; etykieta: string; opis: string }[] = [
  { klucz: 'wszystko', etykieta: 'Wszystko', opis: 'na żywo i kolejne mecze, obok tabele i wyniki na zmianę' },
  { klucz: 'wynik', etykieta: 'Wynik na żywo', opis: 'tablica wyników: mecz w toku na pół ekranu' },
  { klucz: 'tabele', etykieta: 'Tabele', opis: 'wszystkie grupy w dużym rozmiarze, np. przed fazą pucharową' },
  { klucz: 'mecze', etykieta: 'Mecze i wyniki', opis: 'na żywo, kolejne mecze i wyniki, bez tabel' },
  { klucz: 'terminarz', etykieta: 'Terminarz', opis: 'wszystkie mecze do końca dnia: odpowiedź na „kiedy gramy?”' },
  { klucz: 'ogloszenie', etykieta: 'Ogłoszenie', opis: 'Twój tekst i kod QR zbiórki na cały ekran, na przerwy' },
  { klucz: 'zmiana', etykieta: 'Na zmianę', opis: 'ekran sam przełącza układy co 20 s, gdy nikt przy nim nie stoi' },
];

export const CZAS_UKLADU_NA_ZMIANE_MS = 20_000;

export function czyUkladEkranu(x: string | null | undefined): x is UkladEkranu {
  return !!x && UKLADY_EKRANU.some((u) => u.klucz === x);
}

/** Adres ekranu z wybranym układem i motywem; domyślne wartości nie trafiają do adresu. */
export function adresEkranu(adresTurnieju: string, opcje: { uklad?: UkladEkranu; motyw?: MotywEkranu } = {}): string {
  const p = new URLSearchParams();
  if (opcje.uklad && opcje.uklad !== 'wszystko') p.set('uklad', opcje.uklad);
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
