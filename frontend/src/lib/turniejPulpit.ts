/**
 * Pulpit organizatora — czyste funkcje liczące to, czego panel dotąd nie mówił:
 * „jak mi idzie" przed turniejem i „co się dzieje teraz" w jego dniu.
 *
 * Panel wyglądał identycznie trzy tygodnie przed turniejem i w sobotę o 11:40:
 * cztery zakładki z listami. Organizator musiał policyć wzrokiem, ile drużyn
 * zapłaciło, i wyłuskać z terminarza, co trwa na którym boisku.
 *
 * Wszystko tutaj jest funkcją bez bazy — wynik zależy WYŁĄCZNIE od argumentów,
 * łącznie z „teraz". Zegar podawany z zewnątrz, bo inaczej nie dałoby się tego
 * przetestować, a dzień turnieju to jedyny stan, którego nie da się obejrzeć
 * bez czekania na sobotę.
 */

import { liczDruzynyWTurnieju } from './turniejEtykiety';
import { plural, withCount } from './plural';
import type { Turniej, TurniejArena, TurniejDruzyna, TurniejMecz } from '@/types';

export type StanPozycji = 'gotowe' | 'uwaga' | 'brak';

export interface PozycjaPulpitu {
  klucz: string;
  stan: StanPozycji;
  tekst: string;
  /** Dokąd prowadzi, gdy jest co zrobić — nazwa zakładki panelu. */
  zakladka?: 'druzyny' | 'ludzie' | 'terminarz' | 'ustawienia';
}

/**
 * Lista rzeczy do zrobienia przed pierwszym gwizdkiem.
 *
 * Kolejność jest kolejnością blokad: bez drużyn nie ma terminarza, bez
 * terminarza nie ma czego prowadzić. Wpisowe i BLIK stoją niżej, bo turniej
 * bez nich się odbędzie.
 */
export function pulpitPrzedTurniejem(
  t: Pick<Turniej, 'maxDruzyn' | 'wpisoweGrosze'>,
  druzyny: readonly Pick<TurniejDruzyna, 'status' | 'wpisoweOplaconeAt'>[],
  mecze: readonly unknown[],
  maNumerBlik: boolean,
): PozycjaPulpitu[] {
  const przyjete = druzyny.filter((d) => d.status === 'przyjeta');
  const czekajace = druzyny.filter((d) => d.status === 'zgloszona');
  const oplacone = przyjete.filter((d) => d.wpisoweOplaconeAt);

  const pozycje: PozycjaPulpitu[] = [];

  // Ta sama liczba co na kafelku listy i na stronie turnieju: PRZYJĘTE.
  // Spójność między powierzchniami była wymagana od początku, zmieniła się
  // tylko strona, z której ją bierzemy — patrz `zajmujeMiejsce()`. Czekające
  // zgłoszenia mają niżej własny wiersz, więc pulpit nic nie traci.
  const wTurnieju = liczDruzynyWTurnieju(druzyny);
  pozycje.push({
    klucz: 'druzyny',
    stan: wTurnieju >= t.maxDruzyn ? 'gotowe' : wTurnieju >= 2 ? 'uwaga' : 'brak',
    tekst: `${wTurnieju} z ${t.maxDruzyn} drużyn`,
    zakladka: 'druzyny',
  });

  if (czekajace.length > 0) {
    pozycje.push({
      klucz: 'zgloszenia',
      stan: 'uwaga',
      // Odmiana przez `plural()`, nie przez `=== 1`. Uproszczenie do dwóch
      // form daje „2 zgłoszeń czeka" zamiast „2 zgłoszenia czekają": polski
      // ma trzy formy, a liczebnik odmienia też czasownik obok.
      tekst: `${withCount(czekajace.length, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń')} ${
        plural(czekajace.length, 'czeka', 'czekają', 'czeka')} na decyzję`,
      zakladka: 'druzyny',
    });
  }

  pozycje.push({
    klucz: 'terminarz',
    stan: mecze.length > 0 ? 'gotowe' : 'brak',
    tekst: mecze.length > 0 ? 'Terminarz wygenerowany' : 'Terminarz niewygenerowany',
    zakladka: 'terminarz',
  });

  if (t.wpisoweGrosze > 0) {
    pozycje.push({
      klucz: 'wpisowe',
      stan: przyjete.length > 0 && oplacone.length === przyjete.length ? 'gotowe' : 'uwaga',
      tekst: `${oplacone.length} z ${przyjete.length} opłaciło wpisowe`,
      zakladka: 'druzyny',
    });
    pozycje.push({
      klucz: 'blik',
      stan: maNumerBlik ? 'gotowe' : 'brak',
      tekst: maNumerBlik ? 'Numer BLIK podany' : 'Nie masz numeru BLIK, więc kapitanowie nie wiedzą, gdzie zapłacić',
      zakladka: 'ustawienia',
    });
  }

  return pozycje;
}

/**
 * O ile minut turniej jest spóźniony względem planu.
 *
 * Miarą jest NAJWCZEŚNIEJSZY mecz, który wciąż czeka na rozpoczęcie: jeśli
 * jego godzina już minęła, tyle właśnie wynosi obsuwa. `null`, gdy nie ma
 * czego mierzyć albo wszystko idzie zgodnie z planem.
 *
 * Świadomie NIE liczymy średniej ze wszystkich meczów: organizatora interesuje
 * to, co widzi na boisku teraz, a nie statystyka dnia.
 */
export function opoznienieWMinutach(
  mecze: readonly Pick<TurniejMecz, 'status' | 'zaplanowanyAt'>[],
  teraz: Date = new Date(),
): number | null {
  const czekajace = mecze
    .filter((m) => m.status === 'zaplanowany' && m.zaplanowanyAt)
    .sort((a, b) => a.zaplanowanyAt!.localeCompare(b.zaplanowanyAt!));
  if (czekajace.length === 0) return null;

  const plan = new Date(czekajace[0].zaplanowanyAt!).getTime();
  if (Number.isNaN(plan)) return null;

  const roznica = Math.floor((teraz.getTime() - plan) / 60_000);
  return roznica > 0 ? roznica : null;
}

export interface ArenaTeraz {
  arena: TurniejArena;
  trwa?: TurniejMecz;
  nastepny?: TurniejMecz;
}

/**
 * Co się dzieje na każdej arenie: mecz w toku i pierwszy czekający.
 *
 * Areny bez czegokolwiek do pokazania wypadają z listy — pusty wiersz „Boisko 3:
 * nic" zabiera miejsce na ekranie, na który patrzy się w biegu.
 */
export function arenyTeraz(
  areny: readonly TurniejArena[],
  mecze: readonly TurniejMecz[],
): ArenaTeraz[] {
  return areny
    .map((arena) => {
      const naArenie = mecze.filter((m) => m.arenaId === arena.id);
      const trwa = naArenie.find((m) => m.status === 'trwa');
      const nastepny = naArenie
        .filter((m) => m.status === 'zaplanowany')
        .sort((a, b) => (a.zaplanowanyAt ?? '').localeCompare(b.zaplanowanyAt ?? '') || a.numer - b.numer)[0];
      return { arena, trwa, nastepny };
    })
    .filter((w) => w.trwa || w.nastepny);
}
