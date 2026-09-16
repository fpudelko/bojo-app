// Tabela ligowa/grupowa — WYŁĄCZNIE czyste funkcje, zero widoku SQL. Liczona
// w przeglądarce z już pobranych meczów i drużyn, żeby nie omijać RLS drugą
// drogą do tych samych danych (widok SQL czytałby tabele wprost, z pominięciem
// polityk nałożonych na `turniej_mecze`/`turniej_druzyny`).
import type { TurniejMecz, WierszTabeli } from '@/types';

export interface OpcjeTabeli {
  punktyZaWygrana: number;
  punktyZaRemis: number;
}

/**
 * Liczy tabelę z już rozegranych meczów. Wywołujący filtruje `mecze`/`druzyny`
 * do JEDNEJ grupy przed wywołaniem — funkcja sama nie zna pojęcia grupy, tylko
 * przetwarza to, co dostała (ten sam wzorzec co `meczeKazdyZKazdym()`
 * w `lib/turniejFormat.ts`, które też nie losuje, tylko układa przekazane dane).
 *
 * Remis liczy się wprost z `zwyciezca_id IS NULL` — nie z porównania wyniku —
 * bo tak samo liczy go `zakoncz_mecz()` (147): remis w fazie innej niż
 * grupa/liga jest niedozwolony (wymaga karnych), więc w tabeli grupowej/ligowej
 * ta rozbieżność nie ma prawa wystąpić, ale sprawdzenie po `zwyciezca_id`
 * zostaje poprawne także dla walkowerów (0:0, a mimo to jest zwycięzca).
 */
export function obliczTabele(
  mecze: readonly Pick<TurniejMecz, 'status' | 'druzynaAId' | 'druzynaBId' | 'wynikA' | 'wynikB' | 'zwyciezcaId'>[],
  druzyny: readonly { id: string; nazwa: string; grupaId?: string }[],
  opcje: OpcjeTabeli,
): WierszTabeli[] {
  const wiersze = new Map<string, WierszTabeli>();
  for (const d of druzyny) {
    wiersze.set(d.id, {
      druzynaId: d.id,
      nazwa: d.nazwa,
      grupaId: d.grupaId,
      mecze: 0, wygrane: 0, remisy: 0, przegrane: 0,
      bramkiZdobyte: 0, bramkiStracone: 0, roznica: 0, punkty: 0,
      rozstrzygnietyRecznie: false,
    });
  }

  const rozegrane = mecze.filter((m) => m.status === 'zakonczony' || m.status === 'walkower');
  for (const m of rozegrane) {
    if (!m.druzynaAId || !m.druzynaBId) continue;
    const a = wiersze.get(m.druzynaAId);
    const b = wiersze.get(m.druzynaBId);
    if (!a || !b) continue; // drużyna spoza przekazanej listy (np. inna grupa)

    a.mecze += 1;
    b.mecze += 1;
    a.bramkiZdobyte += m.wynikA;
    a.bramkiStracone += m.wynikB;
    b.bramkiZdobyte += m.wynikB;
    b.bramkiStracone += m.wynikA;

    if (m.zwyciezcaId === m.druzynaAId) {
      a.wygrane += 1;
      a.punkty += opcje.punktyZaWygrana;
      b.przegrane += 1;
    } else if (m.zwyciezcaId === m.druzynaBId) {
      b.wygrane += 1;
      b.punkty += opcje.punktyZaWygrana;
      a.przegrane += 1;
    } else {
      a.remisy += 1;
      b.remisy += 1;
      a.punkty += opcje.punktyZaRemis;
      b.punkty += opcje.punktyZaRemis;
    }
  }

  for (const w of Array.from(wiersze.values())) w.roznica = w.bramkiZdobyte - w.bramkiStracone;
  return Array.from(wiersze.values());
}

/**
 * Porządkuje tabelę: punkty → różnica bramek → bramki zdobyte → nazwa
 * (deterministyczny tie-break, żeby kolejność nie skakała między odświeżeniami).
 *
 * `pozycjeReczne` to ucieczka organizatora od kryteriów, których ta funkcja
 * świadomie NIE liczy (mecze bezpośrednie, kartki) — `turniej_druzyny.pozycja_recznie`
 * wstawia drużynę na WSKAZANE miejsce, reszta układa się wokół niej w kolejności
 * liczonej. Bez tego jedyną drogą rozstrzygnięcia dogrywkowego byłoby ręczne
 * dopisanie punktów, co zafałszowałoby "bramki zdobyte"/"różnica" na resztę sezonu.
 */
export function posortujTabele(
  wiersze: readonly WierszTabeli[],
  pozycjeReczne: ReadonlyMap<string, number> = new Map(),
): WierszTabeli[] {
  const policzone = [...wiersze]
    .sort((a, b) => {
      if (b.punkty !== a.punkty) return b.punkty - a.punkty;
      if (b.roznica !== a.roznica) return b.roznica - a.roznica;
      if (b.bramkiZdobyte !== a.bramkiZdobyte) return b.bramkiZdobyte - a.bramkiZdobyte;
      return a.nazwa.localeCompare(b.nazwa, 'pl');
    })
    .map((w) => ({ ...w, rozstrzygnietyRecznie: false }));

  if (pozycjeReczne.size === 0) return policzone;

  const wynik: (WierszTabeli | undefined)[] = new Array(policzone.length).fill(undefined);
  const bezRecznej: WierszTabeli[] = [];
  for (const w of policzone) {
    const pozycja = pozycjeReczne.get(w.druzynaId);
    if (pozycja !== undefined && pozycja >= 1 && pozycja <= policzone.length && !wynik[pozycja - 1]) {
      wynik[pozycja - 1] = { ...w, rozstrzygnietyRecznie: true };
    } else {
      bezRecznej.push(w);
    }
  }
  let i = 0;
  return wynik.map((slot) => slot ?? bezRecznej[i++]);
}
