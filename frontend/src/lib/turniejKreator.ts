/**
 * Wyliczenie czasu trwania turnieju z samych PARAMETRÓW — zanim powstanie
 * choćby jedna drużyna.
 *
 * To jest najważniejsze zdanie w kreatorze i jedyna rzecz, której organizator
 * nie policzy w głowie: „8 drużyn, grupy → puchar, 2×10 min, 2 boiska → 21
 * meczów, ostatni gwizdek ok. 16:40". Bez niej dowiaduje się, że turniej się
 * nie mieści, dopiero w sobotę o 17:00, gdy robi się ciemno — albo, w lepszym
 * wariancie, po wygenerowaniu terminarza, czyli dwa tygodnie za późno na
 * zmianę liczby drużyn.
 *
 * NIE LICZY TEGO WŁASNYM WZOREM. Odpala PRAWDZIWE generatory
 * (`rozlosujGrupy` → `meczeKazdyZKazdym` → `zbudujDrabinke`) na atrapach
 * drużyn i podaje wynik do `szacunekCzasu()`. Własny wzór („n·(n−1)/2 plus
 * drabinka") rozjechałby się z generatorem przy pierwszej zmianie w nim —
 * a rozjazd akurat TUTAJ jest kosztowny, bo organizator podejmuje na
 * podstawie tej liczby decyzję o liczbie drużyn.
 */

import {
  domyslnaLiczbaGrup, rozlosujGrupy, meczeKazdyZKazdym, zbudujDrabinke,
  szacunekCzasu, type NowyMecz, type SzacunekCzasu,
} from './turniejFormat';
import type { TurniejFormat } from '@/types';

export interface ParametryTurnieju {
  format: TurniejFormat;
  liczbaDruzyn: number;
  liczbaAren: number;
  czasMeczuMin: number;
  przerwaMin: number;
  awansujeZGrupy?: number;
  liczbaGrup?: number;
  meczO3Miejsce?: boolean;
  /** 'YYYY-MM-DD' + 'HH:MM' — gdy podane, wynik niesie godzinę końca. */
  dataStartu?: string;
  godzinaStartu?: string;
}

export interface SzacunekTurnieju extends SzacunekCzasu {
  /** 'HH:MM' — ostatni gwizdek, gdy podano start. */
  koniecGodzina?: string;
  /** Turniej przekracza dobę albo jest absurdalnie długi — nie podajemy godziny. */
  poZmroku: boolean;
}

/** Deterministyczne atrapy: `crypto.randomUUID` w podglądzie liczącym się przy
 *  każdym ruchu suwaka byłby marnotrawstwem, a wynik i tak nie zależy od id. */
function atrapy(ile: number, prefiks: string): string[] {
  return Array.from({ length: ile }, (_, i) => `${prefiks}-${i + 1}`);
}

/** Ile meczów i ile czasu zajmie turniej o takich parametrach. */
export function szacunekZParametrow(p: ParametryTurnieju): SzacunekTurnieju {
  const druzyny = atrapy(Math.max(0, p.liczbaDruzyn), 'd');
  let licznik = 0;
  const noweId = () => `m-${++licznik}`;
  const mecze: NowyMecz[] = [];

  if (druzyny.length >= 2) {
    if (p.format === 'liga') {
      mecze.push(...meczeKazdyZKazdym(druzyny, { startNumer: 1, faza: 'liga', noweId }));
    } else if (p.format === 'puchar') {
      mecze.push(...zbudujDrabinke(druzyny, {
        startNumer: 1, meczO3Miejsce: p.meczO3Miejsce, noweId,
      }));
    } else {
      const liczbaGrup = p.liczbaGrup ?? domyslnaLiczbaGrup(druzyny.length);
      const grupy = rozlosujGrupy(druzyny, liczbaGrup, () => 0.5);
      grupy.forEach((skladGrupy, indeks) => {
        mecze.push(...meczeKazdyZKazdym(skladGrupy, {
          startNumer: mecze.length + 1, grupaId: `g-${indeks}`, noweId,
        }));
      });
      // Do drabinki wchodzi `awansujeZGrupy` z każdej grupy — atrapy, bo na
      // etapie kreatora nikt nie wie, kto awansuje; liczy się sam ROZMIAR.
      const awansuje = Math.min(
        druzyny.length,
        (p.awansujeZGrupy ?? 2) * grupy.length,
      );
      if (awansuje >= 2) {
        mecze.push(...zbudujDrabinke(atrapy(awansuje, 'a'), {
          startNumer: mecze.length + 1, meczO3Miejsce: p.meczO3Miejsce, noweId,
        }));
      }
    }
  }

  const startAt = p.dataStartu && p.godzinaStartu
    ? new Date(`${p.dataStartu}T${p.godzinaStartu}:00`).toISOString()
    : undefined;

  const bazowy = szacunekCzasu(mecze, {
    liczbaAren: p.liczbaAren,
    czasMeczuMin: p.czasMeczuMin,
    przerwaMin: p.przerwaMin,
    startAt,
  });

  const koniec = bazowy.koniecAt ? new Date(bazowy.koniecAt) : undefined;
  const przekraczaDobe = !!startAt && !!koniec
    && koniec.getTime() - new Date(startAt).getTime() >= 24 * 60 * 60_000;

  return {
    ...bazowy,
    koniecGodzina: koniec && !przekraczaDobe
      ? `${String(koniec.getHours()).padStart(2, '0')}:${String(koniec.getMinutes()).padStart(2, '0')}`
      : undefined,
    poZmroku: przekraczaDobe,
  };
}

/**
 * Jedno zdanie dla kreatora. Osobno od liczenia, bo to jest COPY — i ma być
 * testowalne bez renderowania, jak reszta tekstów w `content/`.
 */
export function zdanieOCzasie(s: SzacunekTurnieju): string {
  if (s.liczbaMeczow === 0) return 'Dodaj co najmniej dwie drużyny, żeby policzyć czas.';
  const meczeTekst = `${s.liczbaMeczow} ${s.liczbaMeczow === 1 ? 'mecz' : s.liczbaMeczow < 5 ? 'mecze' : 'meczów'}`;
  const godziny = Math.floor(s.czasCalkowityMin / 60);
  const minuty = s.czasCalkowityMin % 60;
  const czasTekst = godziny > 0
    ? `${godziny} h${minuty > 0 ? ` ${minuty} min` : ''}`
    : `${minuty} min`;
  if (s.poZmroku) {
    return `${meczeTekst} · ${czasTekst} gry. To nie zmieści się w jednym dniu.`;
  }
  return s.koniecGodzina
    ? `${meczeTekst} · ${czasTekst} · ostatni gwizdek ok. ${s.koniecGodzina}`
    : `${meczeTekst} · ${czasTekst} gry`;
}
