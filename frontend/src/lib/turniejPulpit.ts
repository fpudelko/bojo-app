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
import type { Turniej, TurniejDruzyna, TurniejMecz } from '@/types';

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
 * Ile meczów turnieju jest już rozstrzygniętych (wynik albo walkower).
 *
 * ZASTĄPIŁO `opoznienieWMinutach()`. Pulpit w dniu turnieju mówił „Opóźnienie:
 * +40 min" i proponował „Przesuń resztę", licząc obsuwę z godzin w terminarzu.
 * Decyzja właściciela z 2026-11-08: turniejem steruje KLIKANIE organizatora,
 * nie zegar. Godziny w terminarzu na amatorskim turnieju rozjeżdżają się od
 * pierwszego meczu, więc komunikat o spóźnieniu był szumem, a nie informacją.
 * Postęp „rozegrane X z Y" mówi prawdę niezależnie od tego, co pokazuje zegar.
 */
export function postepTurnieju(
  mecze: readonly Pick<TurniejMecz, 'status'>[],
): { rozegrane: number; wszystkie: number } {
  const rozegrane = mecze.filter((m) => m.status === 'zakonczony' || m.status === 'walkower').length;
  return { rozegrane, wszystkie: mecze.filter((m) => m.status !== 'odwolany').length };
}

/**
 * Mecze, w które organizator może teraz wpisać wynik: obie drużyny znane,
 * mecz jeszcze nierozstrzygnięty. Najpierw te w toku, potem po NUMERZE
 * meczu, nie po godzinie: kolejność gry na boisku i tak ustala organizator.
 */
export function meczeDoWpisania<T extends Pick<TurniejMecz, 'status' | 'numer' | 'druzynaAId' | 'druzynaBId'>>(
  mecze: readonly T[],
): T[] {
  return mecze
    .filter((m) => (m.status === 'zaplanowany' || m.status === 'trwa') && m.druzynaAId && m.druzynaBId)
    .sort((a, b) => (a.status === 'trwa' ? 0 : 1) - (b.status === 'trwa' ? 0 : 1) || a.numer - b.numer);
}

/**
 * Czy organizator może kliknąć „Rozpocznij turniej". Warunkiem jest gotowy
 * terminarz i stan przed startem. Data i godzina startu NIE są sprawdzane:
 * turniej zaczyna się, kiedy organizator tak zdecyduje.
 */
export function mozeRozpoczacTurniej(
  t: Pick<Turniej, 'status'>,
  mecze: readonly unknown[],
): boolean {
  return (t.status === 'zapisy' || t.status === 'zamkniete_zapisy') && mecze.length > 0;
}
