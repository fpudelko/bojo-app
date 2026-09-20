/**
 * Podium turnieju — kto wygrał, kto był drugi, kto trzeci.
 *
 * DLACZEGO OSOBNO. Turniej nie miał dotąd końca, tylko wygasanie: po ostatnim
 * meczu status zmieniał się na `zakonczony` i strona pokazywała tabelę. A to
 * jest moment o największym zasięgu w całym module — wszyscy uczestnicy patrzą
 * w telefon w tej samej minucie, i to jedyny moment, w którym wynik sam prosi
 * się o udostępnienie.
 *
 * MIEJSCE JEST LICZONE, NIE ZAPISYWANE. Kusi, żeby dopisać kolumnę
 * `turniej_druzyny.miejsce` — i byłoby to drugą prawdą o tym, kto wygrał.
 * Przy pierwszej korekcie wyniku (a te się zdarzają: `wynik_recznie`
 * istnieje właśnie dlatego) tabela mówiłaby jedno, a podium drugie.
 */

import type { MeczFaza, TurniejMecz, WierszTabeli } from '@/types';

export interface MiejsceNaPodium {
  miejsce: 1 | 2 | 3;
  druzynaId: string;
  nazwa: string;
}

const MEDALE: Record<1 | 2 | 3, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/** Awaryjna nazwa, gdy mapa nie zna drużyny z meczu. W praktyce nie powinna się
 *  pokazać (nazwy i mecze pochodzą z tego samego pobrania), ale puste miejsce
 *  na podium czyta się jak błąd renderowania. */
const BEZ_NAZWY = 'Drużyna';

export function medal(miejsce: 1 | 2 | 3): string {
  return MEDALE[miejsce];
}

/**
 * Podium z fazy pucharowej: finał daje pierwsze i drugie miejsce, mecz o 3.
 * miejsce — trzecie.
 *
 * Gdy meczu o 3. miejsce nie było (domyślnie go nie ma), TRZECIEGO MIEJSCA NIE
 * WYMYŚLAMY. Dwaj przegrani półfinaliści są formalnie równi, a wskazanie
 * jednego z nich „bo miał lepszy bilans" byłoby rozstrzygnięciem, którego
 * organizator nie podjął.
 */
function podiumZDrabinki(
  mecze: readonly TurniejMecz[],
  nazwy: ReadonlyMap<string, string>,
): MiejsceNaPodium[] {
  const rozstrzygniety = (m: TurniejMecz) => m.status === 'zakonczony' || m.status === 'walkower';
  const znajdz = (faza: MeczFaza) => mecze.find((m) => m.faza === faza && rozstrzygniety(m));

  const final = znajdz('final');
  if (!final?.zwyciezcaId) return [];

  const przegranyFinalu = final.druzynaAId === final.zwyciezcaId ? final.druzynaBId : final.druzynaAId;
  const podium: MiejsceNaPodium[] = [
    { miejsce: 1, druzynaId: final.zwyciezcaId, nazwa: nazwy.get(final.zwyciezcaId) ?? BEZ_NAZWY },
  ];
  if (przegranyFinalu) {
    podium.push({ miejsce: 2, druzynaId: przegranyFinalu, nazwa: nazwy.get(przegranyFinalu) ?? BEZ_NAZWY });
  }

  const oTrzecie = znajdz('o_3_miejsce');
  if (oTrzecie?.zwyciezcaId) {
    podium.push({ miejsce: 3, druzynaId: oTrzecie.zwyciezcaId, nazwa: nazwy.get(oTrzecie.zwyciezcaId) ?? BEZ_NAZWY });
  }
  return podium;
}

/** Podium z tabeli — dla ligi i dla turnieju, który nie doszedł do drabinki. */
function podiumZTabeli(tabela: readonly WierszTabeli[]): MiejsceNaPodium[] {
  return tabela.slice(0, 3).map((w, i) => ({
    miejsce: (i + 1) as 1 | 2 | 3,
    druzynaId: w.druzynaId,
    nazwa: w.nazwa,
  }));
}

/**
 * Podium turnieju. Drabinka bije tabelę: gdy finał został rozegrany, to on
 * rozstrzyga, choćby tabela grupowa mówiła co innego (a mówi — mistrz potrafi
 * wyjść z grupy z drugiego miejsca).
 *
 * `tabelaLigi` ma sens wyłącznie dla turnieju bez fazy pucharowej: tabela
 * GRUPY nie jest klasyfikacją całego turnieju i nie wolno jej tak użyć.
 */
export function podiumTurnieju(
  mecze: readonly TurniejMecz[],
  nazwy: ReadonlyMap<string, string>,
  tabelaLigi?: readonly WierszTabeli[],
): MiejsceNaPodium[] {
  const zDrabinki = podiumZDrabinki(mecze, nazwy);
  if (zDrabinki.length > 0) return zDrabinki;
  if (tabelaLigi && tabelaLigi.length > 0) return podiumZTabeli(tabelaLigi);
  return [];
}

/** Tekst do udostępnienia wyniku — czysta funkcja, testowalna bez renderowania,
 *  wzorem `tekstUdostepnieniaTurnieju()`. */
export function tekstPodium(
  nazwaTurnieju: string,
  podium: readonly MiejsceNaPodium[],
  link: string,
  krolStrzelcow?: { imie: string; gole: number },
): string {
  const linie = [`🏆 Wyniki: ${nazwaTurnieju}`, ''];
  for (const m of podium) linie.push(`${medal(m.miejsce)} ${m.nazwa}`);
  if (krolStrzelcow && krolStrzelcow.gole > 0) {
    linie.push('', `👟 Król strzelców: ${krolStrzelcow.imie} (${krolStrzelcow.gole})`);
  }
  linie.push('', link);
  return linie.join('\n');
}
