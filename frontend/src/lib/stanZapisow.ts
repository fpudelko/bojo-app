/**
 * Wygląd stanu „zapisy zamknięte" na kartach — jedno miejsce dla całej apki.
 *
 * PO CO OSOBNY PLIK, A NIE KLASY WPISANE W KAŻDĄ KARTĘ: dokładnie z tego
 * powodu, dla którego powstało `lib/komplet.ts`. Ten sam stan malowały tam
 * cztery karty i każda inaczej — dwa odcienie czerwieni, szarość, pasek raz
 * zielony, raz bursztynowy. Piąty stan wchodzi więc od razu przez jeden punkt,
 * zamiast powtarzać tamtą historię.
 *
 * DLACZEGO SZARY. W tej aplikacji kolory mają zarezerwowane znaczenia
 * (AGENTS.md): różowy to wiadomości, niebieski to „wymaga akceptacji" oraz
 * komplet (`lib/komplet.ts`), pomarańczowy to „nowość, o której nie wiesz",
 * zielony to policzalny stan. Zamknięte zapisy nie są żadną z tych rzeczy:
 *
 *  • nie są awarią, więc nie czerwony — czerwień znaczy „coś poszło źle"
 *    (mecz odwołany, błąd, usunięcie), a tu wszystko działa;
 *  • nie są kompletem, więc nie niebieski — mecz NIE MUSI być pełny, żeby
 *    organizator powiedział „gramy w tym składzie". To jest właśnie ta
 *    sytuacja, przed którą ostrzega `komplet.ts`: dwa znaczenia stanęłyby
 *    obok siebie na jednej karcie;
 *  • nie są prośbą o decyzję ani nowością.
 *
 * Szarość nie niesie dziś w Bojo żadnego zarezerwowanego znaczenia i mówi
 * dokładnie to, co trzeba: ta droga jest zamknięta, nic się nie zepsuło.
 *
 * KTO WYGRYWA, GDY MECZ JEST I ZAMKNIĘTY, I PEŁNY. „Zapisy zamknięte", bez
 * wyjątku — i dlatego jest tu `plakietkaStanuZapisow()`, a nie dwie osobne
 * gałęzie w każdej karcie. Czytający kartę zadaje jedno pytanie: „czy mogę
 * wejść". Przy zamkniętych zapisach odpowiedź brzmi „nie" niezależnie od tego,
 * ile miejsc zostało, więc komplet nie wnosi już nic — a dwie plakietki obok
 * siebie mówiłyby to samo dwa razy, w dwóch kolorach.
 */

import { PLAKIETKA_KOMPLET, PASEK_KOMPLET, KOLOR_PASKA_KOMPLET } from './komplet';

/** Klasy Tailwinda plakietki „Zapisy zamknięte" — tło, tekst, obramowanie. */
export const PLAKIETKA_ZAPISY_ZAMKNIETE = 'bg-slate-100 text-slate-600 border border-slate-300';

/** Wypełnienie paska zapełnienia, gdy zapisy są zamknięte. */
export const PASEK_ZAPISY_ZAMKNIETE = 'bg-slate-400';

/** To samo, ale jako wartość CSS — dwie karty malują pasek stylem, nie klasą
 *  (`slate-400`, ten sam odcień co `PASEK_ZAPISY_ZAMKNIETE`). */
export const KOLOR_PASKA_ZAPISY_ZAMKNIETE = '#94a3b8';

export const NAPIS_ZAPISY_ZAMKNIETE = 'Zapisy zamknięte';

/**
 * Co pokazać na pasku pojemności karty: plakietkę zamknięcia, plakietkę
 * kompletu, albo nic (wtedy karta rysuje swój zwykły licznik „taken/max").
 *
 * Zwraca `null` zamiast pustego napisu, żeby karta odróżniła „jest stan do
 * pokazania" od „pokaż licznik" jednym `if`-em. Gotowe klasy wychodzą stąd,
 * a nie z karty — inaczej każda z czterech znowu wybierałaby je sama i po
 * pół roku byłyby cztery różne szarości.
 */
export function plakietkaStanuZapisow(
  zapisyZamkniete: boolean,
  komplet: boolean,
): { napis: string; klasy: string } | null {
  if (zapisyZamkniete) {
    return { napis: NAPIS_ZAPISY_ZAMKNIETE, klasy: PLAKIETKA_ZAPISY_ZAMKNIETE };
  }
  if (komplet) return { napis: 'Komplet', klasy: PLAKIETKA_KOMPLET };
  return null;
}

/** Kolor wypełnienia paska zapełnienia — zamknięcie wygrywa z kompletem. */
export function pasekStanuZapisow(
  zapisyZamkniete: boolean,
  komplet: boolean,
  domyslny: string,
): string {
  if (zapisyZamkniete) return PASEK_ZAPISY_ZAMKNIETE;
  if (komplet) return PASEK_KOMPLET;
  return domyslny;
}

/** Wariant `pasekStanuZapisow()` dla kart malujących pasek stylem, nie klasą. */
export function kolorPaskaStanuZapisow(
  zapisyZamkniete: boolean,
  komplet: boolean,
  domyslny: string,
): string {
  if (zapisyZamkniete) return KOLOR_PASKA_ZAPISY_ZAMKNIETE;
  if (komplet) return KOLOR_PASKA_KOMPLET;
  return domyslny;
}
