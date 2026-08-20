// Dokąd wraca strzałka „wstecz" na stronie boiska (VenueDetailClient) —
// wcześniej nosił to `?wroc=` w URL-u linku do /boisko/[id]. Google śledzi
// każdy <a href> osobno, więc dwa linki do tego samego boiska (z mapy i ze
// strony meczu) liczyły się jako dwa różne adresy do zeskanowania, mimo
// że canonical i tak je zwijał w jeden przy indeksowaniu — czysty koszt
// budżetu skanowania bez korzyści.
//
// sessionStorage zamiast tego: link do boiska zostaje czystym, kanonicznym
// adresem, a cel „wstecz" jedzie w stanie przeglądarki, nie w URL-u. Osobny
// klucz od `lib/powrotPoLogowaniu.ts` (ten sam pomysł, inny powód — tamten
// żyje 15 minut i dotyczy logowania, ten jest jednorazowy i dotyczy tylko
// nawigacji do /boisko/[id]) — współdzielimy wyłącznie walidację ścieżki,
// żeby nie mieć dwóch kopii tego samego sprawdzenia „czy to bezpieczny cel".
import { bezpiecznyCel } from './powrotPoLogowaniu';

const KLUCZ = 'bojo:wroc';

export function zapiszPowrot(sciezka: string): void {
  if (!bezpiecznyCel(sciezka)) return;
  try {
    sessionStorage.setItem(KLUCZ, sciezka);
  } catch {
    // prywatne okno / storage wyłączony — po prostu nie będzie „wstecz"
  }
}

/** Odczytuje i OD RAZU kasuje wpis — jednorazowy, żeby stara wartość nie
 *  podpowiadała złego celu przy kolejnej, niepowiązanej wizycie na /boisko/[id]. */
export function odczytajPowrot(): string | null {
  try {
    const wroc = sessionStorage.getItem(KLUCZ);
    sessionStorage.removeItem(KLUCZ);
    return bezpiecznyCel(wroc) ? wroc : null;
  } catch {
    return null;
  }
}
