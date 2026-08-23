import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { pl } from 'date-fns/locale';

/**
 * Wspólne reguły wyglądu czatu.
 *
 * Rozmowa meczu (`RozmowaWydarzenia`), tablica ekipy (`RozmowaGrupy`) i rozmowa
 * prywatna (`DmRozmowaClient`) miały każda własną kopię `etykietaDnia()` i własne
 * rozumienie tego, kiedy dwie wiadomości należą do jednej grupy. Trzy kopie tej
 * samej reguły rozjeżdżają się w detalach, które użytkownik zna z komunikatorów
 * i wychwytuje natychmiast — separator dnia, sklejanie bąbelków, awatar.
 */

/**
 * Przerwa, po której wiadomości TEGO SAMEGO nadawcy zaczynają nową grupę
 * bąbelków (imię, awatar, większy odstęp).
 *
 * Bez progu czasowego grupowanie pytało wyłącznie „czy ten sam autor" — więc
 * wiadomość z rana i odpowiedź z wieczora zlewały się w jeden blok, jakby były
 * jedną myślą wypowiedzianą ciągiem. Pięć minut to próg, przy którym dwie
 * wiadomości czyta się jeszcze jako jedną wypowiedź.
 */
export const OKNO_GRUPOWANIA_MS = 5 * 60 * 1000;

/** Etykieta separatora dnia: „Dzisiaj" / „Wczoraj" / „5 sierpnia". */
export function etykietaDniaCzatu(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return 'Dzisiaj';
  if (isYesterday(d)) return 'Wczoraj';
  return format(d, 'd MMMM', { locale: pl });
}

/**
 * Czy `biezaca` kontynuuje grupę bąbelków zaczętą przez `poprzednia` — ten sam
 * nadawca i przerwa krótsza niż okno.
 *
 * Separator dnia sprawdza wywołujący osobno (`etykietaDniaCzatu`): grupa nie
 * może przechodzić przez granicę dnia, nawet gdy dwie wiadomości dzieli minuta
 * (23:59 i 00:01 to dwa różne dni na ekranie i tak muszą wyglądać).
 */
export function taSamaGrupaWiadomosci(
  poprzednia: { userId: string; createdAt: string } | undefined,
  biezaca: { userId: string; createdAt: string },
): boolean {
  if (!poprzednia || poprzednia.userId !== biezaca.userId) return false;
  const odstep = parseISO(biezaca.createdAt).getTime() - parseISO(poprzednia.createdAt).getTime();
  // `Number.isFinite` zamiast gołego porównania: zepsuty znacznik czasu daje
  // NaN, a NaN w porównaniu jest fałszem — czyli po cichu ROZBIŁBY grupę
  // zamiast ją skleić. Lepiej rozbić świadomie niż przez przypadek.
  if (!Number.isFinite(odstep)) return false;
  return Math.abs(odstep) < OKNO_GRUPOWANIA_MS;
}

/**
 * Czy ta wiadomość KOŃCZY grupę — czyli czy pod nią ma stanąć awatar.
 *
 * Awatar zamyka cudzą wypowiedź (tak robią komunikatory), więc liczy się
 * następna wiadomość, nie poprzednia. Wydzielone, bo obie strony tego warunku
 * — dzień i nadawca — trzeba sprawdzić razem, a trzy ekrany robiły to osobno.
 */
export function koniecGrupyWiadomosci(
  biezaca: { userId: string; createdAt: string },
  nastepna: { userId: string; createdAt: string } | undefined,
): boolean {
  if (!nastepna) return true;
  if (etykietaDniaCzatu(nastepna.createdAt) !== etykietaDniaCzatu(biezaca.createdAt)) return true;
  return !taSamaGrupaWiadomosci(biezaca, nastepna);
}
