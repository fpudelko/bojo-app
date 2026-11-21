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

/**
 * „Centrum dowodzenia" w dniu turnieju na komputerze (2026-11-21): co trwa,
 * co następne, co już rozegrane i czy coś czeka na decyzję. Panel na
 * telefonie pokazuje to samo jako jedną listę terminarza; od `lg` te same
 * dane stoją obok siebie, żeby organizator przy laptopie nie przełączał
 * zakładek co mecz.
 *
 * Czyste: „teraz" przychodzi z zewnątrz, jak w reszcie tego pliku.
 *
 * BEZ „OPÓŹNIENIA" (decyzja właściciela z 2026-11-08, patrz `postepTurnieju`).
 * Jedyne, co tu wynika z zegara, to wskazanie meczu, który WEDŁUG PLANU już
 * powinien grać, a nikt go nie rozpoczął. To pytanie o decyzję („rozpocząć?"),
 * nie wyrzut o obsuwę, i znika przy pierwszym trwającym meczu.
 */
export interface CentrumTurnieju<T> {
  /** Mecze w toku (zwykle jeden; przy kilku arenach więcej). */
  naZywo: T[];
  /** Kolejne mecze do rozegrania, po terminie, bez wolnych losów. */
  najblizsze: T[];
  /** Ostatnio rozstrzygnięte, od najświeższego. */
  ostatnie: T[];
  /** Ile rozstrzygniętych łącznie (do „Wszystkie rozegrane (n)"). */
  liczbaRozegranych: number;
  /** Ile nierozegranych łącznie (do „Cały terminarz (n)"). */
  liczbaDoRozegrania: number;
  /** Mecz, który według planu już powinien trwać, gdy nic nie trwa. */
  zaleglyStart: T | null;
  /**
   * Mecz do rozpoczęcia TERAZ: pierwszy gotowy (obie drużyny znane) na
   * wolnej arenie. `null`, gdy wszystkie areny grają. Przy jednej hali
   * i meczu w toku „Rozpocznij” przy następnym meczu tylko myliło: nie da
   * się zacząć drugiego meczu na zajętym boisku.
   */
  doRozpoczecia: T | null;
  /**
   * Mecze w toku dwa razy dłużej niż czas gry: prawie zawsze ktoś zapomniał
   * kliknąć „Zakończ mecz”. Ten sam próg, przy którym `czasGry()` przestaje
   * pokazywać zegar.
   */
  przeciagniete: T[];
}

type MeczCentrum = Pick<
  TurniejMecz,
  'status' | 'numer' | 'zaplanowanyAt' | 'zakonczonyAt' | 'druzynaAId' | 'druzynaBId' | 'arenaId' | 'rozpoczetyAt'
>;

export function centrumTurnieju<T extends MeczCentrum>(
  mecze: readonly T[],
  teraz: Date,
  opcje: { najblizsze?: number; ostatnie?: number; liczbaAren?: number; czasMeczuMin?: number } = {},
): CentrumTurnieju<T> {
  // Wolny los (171): nikt w nim nie gra, więc nie jest ani następnym meczem,
  // ani wynikiem. Ta sama reguła co na stronie publicznej.
  const prawdziwe = mecze.filter((m) => !(m.status === 'walkower' && (!m.druzynaAId || !m.druzynaBId)));
  const naZywo = prawdziwe.filter((m) => m.status === 'trwa').sort(porownajTerminMeczu);
  const doRozegrania = prawdziwe.filter((m) => m.status === 'zaplanowany').sort(porownajTerminMeczu);
  const rozegrane = prawdziwe
    .filter((m) => m.status === 'zakonczony' || m.status === 'walkower')
    // Od NAJŚWIEŻSZEGO zakończenia, nie od godziny w planie: „Popraw” jest
    // dla meczu, który właśnie wpisano, a ten bywa rozegrany poza kolejnością.
    .sort((a, b) => (b.zakonczonyAt ?? b.zaplanowanyAt ?? '').localeCompare(a.zakonczonyAt ?? a.zaplanowanyAt ?? '')
      || b.numer - a.numer);

  const pierwszyGotowy = doRozegrania.find((m) => m.druzynaAId && m.druzynaBId);
  const zaleglyStart = naZywo.length === 0 && pierwszyGotowy?.zaplanowanyAt
    && new Date(pierwszyGotowy.zaplanowanyAt).getTime() <= teraz.getTime()
    ? pierwszyGotowy
    : null;

  const zajeteAreny = new Set(naZywo.map((m) => m.arenaId).filter(Boolean));
  const wolnaArena = naZywo.length < Math.max(1, opcje.liczbaAren ?? 1);
  const doRozpoczecia = wolnaArena
    ? doRozegrania.find((m) => m.druzynaAId && m.druzynaBId && !(m.arenaId && zajeteAreny.has(m.arenaId))) ?? null
    : null;

  const prog = (opcje.czasMeczuMin ?? 0) * 2 * 60_000;
  const przeciagniete = prog > 0
    ? naZywo.filter((m) => m.rozpoczetyAt && teraz.getTime() - new Date(m.rozpoczetyAt).getTime() > prog)
    : [];

  return {
    doRozpoczecia,
    przeciagniete,
    naZywo,
    najblizsze: doRozegrania.slice(0, opcje.najblizsze ?? 4),
    ostatnie: rozegrane.slice(0, opcje.ostatnie ?? 4),
    liczbaRozegranych: rozegrane.length,
    liczbaDoRozegrania: doRozegrania.length,
    zaleglyStart,
  };
}

function porownajTerminMeczu(a: MeczCentrum, b: MeczCentrum): number {
  if (a.zaplanowanyAt && b.zaplanowanyAt && a.zaplanowanyAt !== b.zaplanowanyAt) {
    return a.zaplanowanyAt < b.zaplanowanyAt ? -1 : 1;
  }
  if (a.zaplanowanyAt && !b.zaplanowanyAt) return -1;
  if (!a.zaplanowanyAt && b.zaplanowanyAt) return 1;
  return a.numer - b.numer;
}
