// Etykiety statusów, formatów i faz turnieju — jedno miejsce, żeby ta sama
// wartość bazy nie doczekała się dwóch różnych podpisów w dwóch komponentach.
// Wzorem `lib/teamLabels.ts` i `lib/tournamentLabels.ts` (usunięte razem ze
// starym modułem — to jest ich duchowy następca, inny kształt danych).

import { plural, withCount } from './plural';
import type { DruzynaStatus, MeczFaza, MeczStatus, TurniejFormat, TurniejStatus, Turniej } from '@/types';

export const STATUS_TURNIEJU: Record<TurniejStatus, { label: string; ton: string }> = {
  szkic:            { label: 'W przygotowaniu', ton: 'bg-slate-100 text-slate-600' },
  zapisy:           { label: 'Trwają zapisy',   ton: 'bg-primary-50 text-primary-700' },
  // Ten sam szary i to samo znaczenie co „Zapisy zamknięte" przy meczu
  // (`lib/stanZapisow.ts`, migracja `141`) — „ta droga jest zamknięta, nic
  // się nie zepsuło", nie czerwień („coś poszło źle") ani błękit (zajęty przez
  // „wymaga akceptacji" i komplet). Patrz AGENTS.md, sekcja o kolorystyce.
  zamkniete_zapisy: { label: 'Zapisy zamknięte', ton: 'bg-slate-100 text-slate-600' },
  trwa:             { label: 'Trwa',             ton: 'bg-primary-50 text-primary-700' },
  zakonczony:       { label: 'Zakończony',       ton: 'bg-slate-100 text-slate-600' },
  odwolany:         { label: 'Odwołany',         ton: 'bg-red-50 text-red-600' },
};

/**
 * Które drużyny ZAJMUJĄ MIEJSCE w turnieju.
 *
 * Powstało, bo trzy miejsca liczyły to na trzy sposoby: kafelek na liście brał
 * WSZYSTKIE wiersze (więc drużyna odrzucona dalej zajmowała slot i blokowała
 * zapisy), pulpit organizatora liczył wyłącznie `przyjeta` (więc pokazywał
 * zero przy jednej czekającej), a `przyjmujeZgloszenia()` znów wszystkie.
 * Organizator widział przez to dwie różne liczby na dwóch ekranach.
 *
 * Miejsce zajmuje drużyna przyjęta ORAZ czekająca na decyzję: dopóki
 * organizator nie odpowie, ta druga ma prawo do slotu. Odrzucona i wycofana
 * nie zajmują nic. To jest cała reguła.
 */
export function zajmujeMiejsce(status: DruzynaStatus): boolean {
  return status === 'zgloszona' || status === 'przyjeta';
}

export function liczDruzynyWTurnieju(
  druzyny: readonly { status: DruzynaStatus }[],
): number {
  return druzyny.filter((d) => zajmujeMiejsce(d.status)).length;
}

export const STATUS_DRUZYNY: Record<DruzynaStatus, { label: string; ton: string }> = {
  // Niebieski jak wszędzie w tej apce: „wymaga akceptacji uczestnictwa"
  // (organizator ma decyzję do podjęcia), nie inny odcień znaczenia.
  zgloszona: { label: 'Czeka na przyjęcie', ton: 'bg-blue-50 text-blue-600' },
  przyjeta:  { label: 'W turnieju',         ton: 'bg-primary-50 text-primary-700' },
  rezerwa:   { label: 'Rezerwa',            ton: 'bg-slate-100 text-slate-600' },
  odrzucona: { label: 'Nieprzyjęta',        ton: 'bg-slate-100 text-slate-600' },
  wycofana:  { label: 'Wycofana',           ton: 'bg-slate-100 text-slate-600' },
};

export const STATUS_MECZU: Record<MeczStatus, { label: string; ton: string }> = {
  zaplanowany: { label: 'Zaplanowany', ton: 'bg-slate-100 text-slate-500' },
  // Zielony jak licznik meczów w dolnej nawigacji: to STAN, nie zdarzenie
  // wymagające reakcji — nie błękit (zajęty przez „wymaga akceptacji").
  trwa:        { label: 'Na żywo',     ton: 'bg-primary-50 text-primary-700' },
  zakonczony:  { label: 'Zakończony',  ton: 'bg-slate-100 text-slate-500' },
  walkower:    { label: 'Walkower',    ton: 'bg-slate-100 text-slate-500' },
  odwolany:    { label: 'Odwołany',    ton: 'bg-red-50 text-red-600' },
};

export const FORMAT_LABEL: Record<TurniejFormat, string> = {
  grupy_puchar: 'Grupy → puchar',
  puchar:       'Puchar',
  liga:         'Liga',
};

export const FORMAT_OPIS: Record<TurniejFormat, string> = {
  grupy_puchar: 'Drużyny grają najpierw w grupach, dwie najlepsze z każdej awansują do drabinki pucharowej.',
  puchar:       'Od razu drabinka pucharowa, przegrana kończy udział w turnieju.',
  liga:         'Każdy z każdym, bez fazy pucharowej, liczy się tylko tabela.',
};

export const FAZA_LABEL: Record<MeczFaza, string> = {
  grupa:        'Faza grupowa',
  liga:         'Liga',
  '1/32':       '1/32 finału',
  '1/16':       '1/16 finału',
  '1/8':        '1/8 finału',
  cwierc:       'Ćwierćfinał',
  polfinal:     'Półfinał',
  o_3_miejsce:  'Mecz o 3. miejsce',
  final:        'Finał',
};

/** Zdanie po ludzku pod nazwą formatu w kreatorze i na stronie turnieju. */
export function opisFormatu(t: Pick<Turniej, 'format'>, liczbaDruzyn: number): string {
  const baza = FORMAT_OPIS[t.format];
  if (t.format === 'liga') {
    return `${baza} ${odmienDruzyny(liczbaDruzyn)} gra między sobą.`;
  }
  return baza;
}

export function odmienDruzyny(n: number): string {
  return withCount(n, 'drużyna', 'drużyny', 'drużyn');
}

// Rzeczownik męskoosobowy — ta sama odmiana co „gracz" (`EventBrowseCard.tsx`):
// 1 zawodnik, 2-4 zawodnicy, 5+/12-14 zawodników.
export function odmienZawodnikow(n: number): string {
  return withCount(n, 'zawodnik', 'zawodnicy', 'zawodników');
}

// ---------------------------------------------------------------------------
// Termin i stan — czyste funkcje, bo obie odpowiadają na pytania zadawane
// w kilku miejscach naraz i obie łatwo policzyć inaczej w każdym z nich.
// ---------------------------------------------------------------------------

/**
 * Godzina bez sekund. `turnieje.godzina_startu` to kolumna `time`, którą
 * PostgREST oddaje jako `"10:00:00"` — wypisana wprost pokazywała użytkownikowi
 * sekundy, których nikt nigdy nie ustawił.
 */
export function bezSekund(godzina: string): string {
  return godzina.slice(0, 5);
}

/**
 * Jeden format terminu dla całego modułu: „śr, 16 września, 18:00", a dla
 * najbliższych dni „Dziś, 18:00" / „Jutro, 18:00".
 *
 * Powstała, bo to samo wydarzenie pokazywało się w trzech zapisach naraz:
 * „środa, 9 września" (lista), „środa, 16 września · 10:00:00" (turniej)
 * i „Środa 16.09, 18:00" (karta meczu). Data przeczytana trzy razy inaczej
 * każe czytającemu sprawdzać, czy to na pewno ten sam mecz.
 *
 * `dzisiaj` wstrzykiwalne — inaczej test „Dziś" przechodziłby tylko w dniu,
 * w którym go napisano.
 */
export function etykietaTerminu(
  data: string,
  godzina?: string,
  dzisiaj: Date = new Date(),
): string {
  const dzien = new Date(`${data}T00:00:00`);
  if (Number.isNaN(dzien.getTime())) return godzina ? `${data}, ${bezSekund(godzina)}` : data;

  const doPolnocy = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const roznicaDni = Math.round((doPolnocy(dzien) - doPolnocy(dzisiaj)) / 86_400_000);

  const nazwaDnia = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'][dzien.getDay()];
  const miesiace = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
                    'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const dataTekst =
    roznicaDni === 0 ? 'Dziś'
      : roznicaDni === 1 ? 'Jutro'
      : roznicaDni === -1 ? 'Wczoraj'
      : `${nazwaDnia} ${dzien.getDate()} ${miesiace[dzien.getMonth()]}`;

  return godzina ? `${dataTekst}, ${bezSekund(godzina)}` : dataTekst;
}

export interface StanTurnieju {
  label: string;
  ton: string;
  /** Drugi wiersz na karcie — `undefined`, gdy nie ma nic konkretnego do dodania. */
  szczegol?: string;
}

/**
 * Stan turnieju liczony z TERMINARZA, nie z samej kolumny `status`.
 *
 * SKĄD TO. `turnieje.status` zmienia organizator ręcznie i nikt tego za niego
 * nie robi — więc turniej sprzed tygodnia, w którym rozegrano wszystkie mecze,
 * nadal miał plakietkę „Trwa". Cztery turnieje na liście wyglądały wtedy
 * identycznie, choć jeden czekał na finał, a drugi skończył się dawno.
 * Kolumna dalej rządzi tam, gdzie niesie decyzję organizatora (szkic, odwołany,
 * zamknięte zapisy) — terminarz dokłada to, czego kolumna nie wie.
 */
export function stanTurnieju(
  t: Pick<Turniej, 'status' | 'dataStartu' | 'zapisyDo'>,
  mecze: readonly { status: string; zaplanowanyAt?: string; faza: MeczFaza }[],
  dzisiaj: Date = new Date(),
): StanTurnieju {
  if (t.status === 'odwolany') return { label: 'Odwołany', ton: 'bg-red-50 text-red-600' };
  if (t.status === 'szkic') return { label: 'W przygotowaniu', ton: 'bg-slate-100 text-slate-600' };
  if (t.status === 'zapisy') {
    // KONKRETNA DATA BIJE CZASOWNIK. Sam fakt, że zapisy trwają, mówi tylko,
    // że drzwi są otwarte; termin graniczny mówi, ile zostało czasu, i to jest
    // jedyny powód, żeby kapitan zgłosił drużynę dziś, a nie kiedyś.
    const doKiedy = t.zapisyDo && new Date(t.zapisyDo).getTime() > dzisiaj.getTime()
      ? etykietaTerminu(t.zapisyDo.slice(0, 10), undefined, dzisiaj).toLowerCase()
      : null;
    return {
      label: doKiedy ? `Zapisy do ${doKiedy}` : 'Trwają zapisy',
      ton: 'bg-primary-50 text-primary-700',
      szczegol: `Start ${etykietaTerminu(t.dataStartu, undefined, dzisiaj).toLowerCase()}`,
    };
  }

  const rozegrane = mecze.filter((m) => m.status === 'zakonczony' || m.status === 'walkower');
  const zostalo = mecze.filter((m) => m.status !== 'zakonczony' && m.status !== 'walkower');
  const naZywo = mecze.find((m) => m.status === 'trwa');

  if (naZywo) return { label: 'Na żywo', ton: 'bg-primary-50 text-primary-700', szczegol: 'Mecz w toku' };

  // Komplet rozegrany to koniec, choćby kolumna twierdziła inaczej.
  if (mecze.length > 0 && zostalo.length === 0) {
    return { label: 'Zakończony', ton: 'bg-slate-100 text-slate-600' };
  }
  if (t.status === 'zakonczony') return { label: 'Zakończony', ton: 'bg-slate-100 text-slate-600' };

  const najblizszy = zostalo
    .filter((m) => m.zaplanowanyAt)
    .sort((a, b) => a.zaplanowanyAt!.localeCompare(b.zaplanowanyAt!))[0];
  const szczegol = najblizszy?.zaplanowanyAt
    ? `${FAZA_LABEL[najblizszy.faza]} ${etykietaTerminu(
        najblizszy.zaplanowanyAt.slice(0, 10),
        najblizszy.zaplanowanyAt.slice(11, 16),
        dzisiaj,
      ).toLowerCase()}`
    : undefined;

  if (t.status === 'zamkniete_zapisy') {
    return { label: 'Zapisy zamknięte', ton: 'bg-slate-100 text-slate-600', szczegol };
  }
  // `trwa` z niepustym terminarzem: rozróżniamy początek od końcówki, bo
  // „zostały dwa mecze" i „nic jeszcze nie rozegrano" to dla widza dwa różne
  // turnieje, a kolumna nazywa oba tak samo.
  if (rozegrane.length > 0 && zostalo.length <= 2) {
    return { label: 'Ostatnie mecze', ton: 'bg-primary-50 text-primary-700', szczegol };
  }
  return { label: 'Trwa', ton: 'bg-primary-50 text-primary-700', szczegol };
}

// ---------------------------------------------------------------------------
// Zapisy — plakat na stronie turnieju
// ---------------------------------------------------------------------------

export interface StanZapisow {
  /** Ile jeszcze drużyn wejdzie. Zero = komplet. */
  wolne: number;
  /** Zapełnienie 0–100, do paska. */
  procent: number;
  /** „Zostały 2 miejsca" / „Komplet drużyn" — zdanie, nie liczba. */
  miejscaLabel: string;
  /** „Zapisy do czwartku 16 października" albo `undefined`, gdy bez terminu. */
  terminLabel?: string;
  /** Czy termin już minął — zapisy zamknięte mimo wolnych miejsc. */
  poTerminie: boolean;
}

/**
 * Wszystko, co plakat mówi o zapisach, policzone raz i w jednym miejscu.
 *
 * Powód istnienia: „6/8 drużyn" to informacja, a „Zostały 2 miejsca · zapisy
 * do czwartku" to powód, żeby zgłosić drużynę DZIŚ. Ta sama różnica, którą
 * moduł meczowy rozstrzygnął dawno licznikiem miejsc i oknem zapisu.
 */
export function stanZapisowTurnieju(
  t: Pick<Turniej, 'maxDruzyn' | 'zapisyDo'>,
  liczbaDruzyn: number,
  teraz: Date = new Date(),
): StanZapisow {
  const wolne = Math.max(0, t.maxDruzyn - liczbaDruzyn);
  const procent = t.maxDruzyn > 0
    ? Math.min(100, Math.round((liczbaDruzyn / t.maxDruzyn) * 100))
    : 0;

  const poTerminie = !!t.zapisyDo && new Date(t.zapisyDo).getTime() <= teraz.getTime();

  return {
    wolne,
    procent,
    // Czasownik odmienia się razem z rzeczownikiem: „Zostało 1 miejsce",
    // „Zostały 2 miejsca", „Zostało 5 miejsc".
    miejscaLabel: wolne === 0
      ? 'Komplet drużyn'
      : `${plural(wolne, 'Zostało', 'Zostały', 'Zostało')} ${withCount(wolne, 'miejsce', 'miejsca', 'miejsc')}`,
    terminLabel: t.zapisyDo
      ? (poTerminie
          ? 'Zapisy zamknięte'
          : `Zapisy do ${etykietaTerminu(t.zapisyDo.slice(0, 10), undefined, teraz).toLowerCase()}`)
      : undefined,
    poTerminie,
  };
}
