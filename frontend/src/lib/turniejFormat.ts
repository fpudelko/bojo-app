// Generator terminarza — WYŁĄCZNIE czyste funkcje. Baza (migracja 146,
// `zapisz_terminarz()`) tylko PRZYJMUJE gotowy plan i pilnuje jego
// integralności (własności, blokada nadpisania rozegranego terminarza).
// Kolejność drużyn na wejściu ustala WYWOŁUJĄCY (np. `rozlosujGrupy()` niżej)
// — te funkcje same niczego nie losują, żeby dało się je testować bez mocków.
import type { MeczFaza } from '@/types';

/** Kształt jednego meczu do zapisania przez `zapiszTerminarz()`
 *  (`lib/turniejMecze.ts` → RPC `zapisz_terminarz`, migracja 146). Klucze po
 *  camelCase — to jest kontrakt z `zapisz_terminarz()`, nie kolumny bazy. */
export interface NowyMecz {
  id: string;
  numer: number;
  faza: MeczFaza;
  grupaId?: string;
  kolejka?: number;
  pozycjaWDrabince?: number;
  druzynaAId?: string;
  druzynaBId?: string;
  zrodloAMeczId?: string;
  zrodloBMeczId?: string;
  zrodloATyp?: 'zwyciezca' | 'przegrany';
  zrodloBTyp?: 'zwyciezca' | 'przegrany';
  arenaId?: string;
  zaplanowanyAt?: string;
  status?: 'zaplanowany' | 'walkower';
  zwyciezcaId?: string;
  walkowerDla?: string;
}

/**
 * Ile grup dla danej liczby drużyn — cel: 3-4 drużyny w grupie, żeby każda
 * rozegrała choć 2-3 mecze fazy grupowej. Poniżej 5 drużyn grupa jest jedna
 * (dzielenie nie miałoby sensu).
 */
export function domyslnaLiczbaGrup(liczbaDruzyn: number): number {
  if (liczbaDruzyn <= 4) return 1;
  let grupy = Math.max(1, Math.round(liczbaDruzyn / 4));
  while (grupy > 1 && liczbaDruzyn / grupy < 3) grupy--;
  return grupy;
}

/**
 * Losowy podział na grupy równej (±1) wielkości. Tasowanie Fisher-Yates
 * z wstrzykiwalnym RNG (domyślnie `Math.random`) — bez tego test losowania
 * musiałby mockować globalny `Math.random`, co jest kruche i nieczytelne.
 */
export function rozlosujGrupy<T>(
  druzyny: readonly T[],
  liczbaGrup: number,
  losuj: () => number = Math.random,
): T[][] {
  const n = Math.max(1, Math.floor(liczbaGrup));
  const potasowane = [...druzyny];
  for (let i = potasowane.length - 1; i > 0; i--) {
    const j = Math.floor(losuj() * (i + 1));
    [potasowane[i], potasowane[j]] = [potasowane[j], potasowane[i]];
  }
  const wynik: T[][] = Array.from({ length: n }, () => []);
  potasowane.forEach((druzyna, i) => wynik[i % n].push(druzyna));
  return wynik;
}

export interface OpcjeRundy {
  startNumer: number;
  grupaId?: string;
  /** Domyślnie 'grupa', gdy podano `grupaId`, inaczej 'liga'. */
  faza?: MeczFaza;
  /** Domyślnie `crypto.randomUUID` — patrz nagłówek `146_turniej_terminarz.sql`
   *  o tym, dlaczego ID meczów nadaje przeglądarka. Wstrzykiwalne dla testów. */
  noweId?: () => string;
}

const PAUZA = Symbol('pauza');

/**
 * „Każdy z każdym" metodą karuzeli: przy nieparzystej liczbie drużyn dokłada
 * jeden wolny los (PAUZA) — drużyna sparowana z nim pauzuje w tej kolejce,
 * bez meczu. `kolejka` na każdym meczu pozwala `ulozHarmonogram()` rozstawić
 * je po turach, nie zgadując z kolejności w tablicy.
 */
export function meczeKazdyZKazdym(druzynyId: readonly string[], opcje: OpcjeRundy): NowyMecz[] {
  if (druzynyId.length < 2) return [];
  const noweId = opcje.noweId ?? (() => crypto.randomUUID());
  const faza: MeczFaza = opcje.faza ?? (opcje.grupaId ? 'grupa' : 'liga');

  const lista: (string | typeof PAUZA)[] = [...druzynyId];
  if (lista.length % 2 !== 0) lista.push(PAUZA);

  const n = lista.length;
  const polowa = n / 2;
  const mecze: NowyMecz[] = [];
  let numer = opcje.startNumer;
  let arr = lista;

  for (let kolejka = 1; kolejka <= n - 1; kolejka++) {
    for (let i = 0; i < polowa; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== PAUZA && b !== PAUZA) {
        // Na przemian, która strona jest „gospodarzem" — bez tego drużyna na
        // pozycji 0 (nieruszana przez obrót karuzeli) grałaby jako A w KAŻDEJ
        // kolejce.
        const aGospodarzem = kolejka % 2 === 1;
        mecze.push({
          id: noweId(),
          numer: numer++,
          faza,
          grupaId: opcje.grupaId,
          kolejka,
          druzynaAId: aGospodarzem ? a : b,
          druzynaBId: aGospodarzem ? b : a,
        });
      }
    }
    // Karuzela: pozycja 0 stoi w miejscu, reszta obraca się o jedno miejsce.
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return mecze;
}

export interface OpcjeDrabinki {
  startNumer: number;
  /** Mecz o 3. miejsce między przegranymi półfinałów. Domyślnie false. */
  meczO3Miejsce?: boolean;
  noweId?: () => string;
}

/** Kolejność siewu dla drabinki o rozmiarze `rozmiar` (potęga dwójki) metodą
 *  rekurencyjnego podwajania: [1] → [1,2] → [1,4,2,3] → [1,8,4,5,2,7,3,6] …
 *  Standardowy sposób na rozstawienie tak, żeby wolne losy (gdy drużyn jest
 *  mniej niż `rozmiar`) rozłożyły się równo, a nie zbiły w jednym rogu. */
function kolejnoscObsadzenia(rozmiar: number): number[] {
  let kolejnosc = [1];
  while (kolejnosc.length < rozmiar) {
    const dl = kolejnosc.length * 2;
    const nowa: number[] = [];
    for (const s of kolejnosc) nowa.push(s, dl + 1 - s);
    kolejnosc = nowa;
  }
  return kolejnosc;
}

// Nazwa fazy licząc OD FINAŁU wstecz (0 = finał, 1 = półfinał, …) — bo liczba
// rund zależy od rozmiaru drabinki, a nazwa fazy zależy od ODLEGŁOŚCI od
// finału, nie od numeru rundy licząc od początku.
const FAZY_OD_KONCA: MeczFaza[] = ['final', 'polfinal', 'cwierc', '1/8', '1/16', '1/32'];

function fazaRundy(rundOdKonca: number): MeczFaza {
  return FAZY_OD_KONCA[rundOdKonca] ?? '1/32';
}

/**
 * Drabinka pucharowa pojedynczej eliminacji. Drużyny wchodzą w kolejności
 * PRZEKAZANEJ (losowanie robi wywołujący, np. `rozlosujGrupy()` z jedną
 * „grupą" albo zwykłe tasowanie) — funkcja tylko rozstawia je w siatce.
 *
 * Wolne losy (drabinka niebędąca potęgą dwójki) wchodzą do pierwszej rundy
 * OD RAZU jako `status: 'walkower'` z ustawionym zwycięzcą — `zapisz_terminarz()`
 * propaguje je do drugiej rundy bez czyjegokolwiek kliknięcia (patrz migracja 146).
 */
export function zbudujDrabinke(druzynyId: readonly string[], opcje: OpcjeDrabinki): NowyMecz[] {
  const n = druzynyId.length;
  if (n < 2) return [];
  const noweId = opcje.noweId ?? (() => crypto.randomUUID());

  let rozmiarDrabinki = 1;
  while (rozmiarDrabinki < n) rozmiarDrabinki *= 2;
  const liczbaRund = Math.log2(rozmiarDrabinki);

  const kolejnosc = kolejnoscObsadzenia(rozmiarDrabinki);
  const sloty: (string | undefined)[] = kolejnosc.map((pozycjaSiewu) => druzynyId[pozycjaSiewu - 1]);

  let numer = opcje.startNumer;
  const rundy: NowyMecz[][] = [];

  const runda1: NowyMecz[] = [];
  for (let i = 0; i < rozmiarDrabinki / 2; i++) {
    const a = sloty[2 * i];
    const b = sloty[2 * i + 1];
    const mecz: NowyMecz = {
      id: noweId(),
      numer: numer++,
      faza: fazaRundy(liczbaRund - 1),
      kolejka: 1,
      pozycjaWDrabince: i,
      druzynaAId: a,
      druzynaBId: b,
    };
    if (a && !b) {
      mecz.status = 'walkower';
      mecz.zwyciezcaId = a;
      mecz.walkowerDla = a;
    } else if (b && !a) {
      mecz.status = 'walkower';
      mecz.zwyciezcaId = b;
      mecz.walkowerDla = b;
    }
    runda1.push(mecz);
  }
  rundy.push(runda1);

  for (let r = 2; r <= liczbaRund; r++) {
    const poprzednia = rundy[r - 2];
    const biezaca: NowyMecz[] = [];
    for (let i = 0; i < poprzednia.length / 2; i++) {
      biezaca.push({
        id: noweId(),
        numer: numer++,
        faza: fazaRundy(liczbaRund - r),
        kolejka: r,
        pozycjaWDrabince: i,
        zrodloAMeczId: poprzednia[2 * i].id,
        zrodloATyp: 'zwyciezca',
        zrodloBMeczId: poprzednia[2 * i + 1].id,
        zrodloBTyp: 'zwyciezca',
      });
    }
    rundy.push(biezaca);
  }

  const wszystkie = rundy.flat();

  if (opcje.meczO3Miejsce && liczbaRund >= 2) {
    const polfinaly = rundy[liczbaRund - 2];
    wszystkie.push({
      id: noweId(),
      numer: numer++,
      faza: 'o_3_miejsce',
      kolejka: liczbaRund,
      zrodloAMeczId: polfinaly[0].id,
      zrodloATyp: 'przegrany',
      zrodloBMeczId: polfinaly[1].id,
      zrodloBTyp: 'przegrany',
    });
  }

  return wszystkie;
}

export interface OpcjeHarmonogramu {
  arenyId: readonly string[];
  /** ISO — moment pierwszego meczu. */
  startAt: string;
  czasMeczuMin: number;
  przerwaMin: number;
}

/**
 * Rozstawia mecze na arenach i w czasie. Grupuje po `kolejka` (w fazie
 * grupowej/lidze — kolejny „przelot" karuzeli; w drabince — runda), bo w
 * obrębie jednej kolejki żadna drużyna nie gra dwa razy — więc mecze tej
 * samej kolejki mogą iść RÓWNOLEGLE na różnych arenach, bez ryzyka kolizji.
 * Gdy aren jest mniej niż meczów w kolejce, kolejka rozlewa się na kolejne
 * „fale" tej samej godziny startowej + wielokrotność (czas meczu + przerwa).
 *
 * Mecze już rozstrzygnięte (wolne losy z `zbudujDrabinke()`, `status` inny niż
 * `zaplanowany`) NIE dostają terminu — nie będą rozgrywane.
 */
export function ulozHarmonogram(mecze: readonly NowyMecz[], opcje: OpcjeHarmonogramu): NowyMecz[] {
  const doZaplanowania = mecze.filter((m) => (m.status ?? 'zaplanowany') === 'zaplanowany');
  const juzRozstrzygniete = mecze.filter((m) => (m.status ?? 'zaplanowany') !== 'zaplanowany');

  const poKolejkach = new Map<number, NowyMecz[]>();
  for (const m of doZaplanowania) {
    const k = m.kolejka ?? 1;
    if (!poKolejkach.has(k)) poKolejkach.set(k, []);
    poKolejkach.get(k)!.push(m);
  }
  const kolejki = Array.from(poKolejkach.keys()).sort((a, b) => a - b);

  const areny = opcje.arenyId.length > 0 ? opcje.arenyId : [undefined];
  const czasSlotuMs = (opcje.czasMeczuMin + opcje.przerwaMin) * 60_000;
  let slotStart = new Date(opcje.startAt).getTime();

  const zaplanowane: NowyMecz[] = [];
  for (const k of kolejki) {
    const meczeKolejki = poKolejkach.get(k)!;
    const liczbaFal = Math.ceil(meczeKolejki.length / areny.length);
    for (let fala = 0; fala < liczbaFal; fala++) {
      const czasFali = new Date(slotStart + fala * czasSlotuMs).toISOString();
      const naFali = meczeKolejki.slice(fala * areny.length, (fala + 1) * areny.length);
      naFali.forEach((m, i) => {
        zaplanowane.push({ ...m, arenaId: areny[i] as string | undefined, zaplanowanyAt: czasFali });
      });
    }
    slotStart += liczbaFal * czasSlotuMs;
  }

  return [...zaplanowane, ...juzRozstrzygniete].sort((a, b) => a.numer - b.numer);
}

export interface SzacunekCzasu {
  liczbaMeczow: number;
  /** Ile „fal" czasowych zajmie terminarz przy tylu arenach. */
  liczbaFal: number;
  czasCalkowityMin: number;
  /** ISO, gdy podano `startAt` — moment końca ostatniej fali. */
  koniecAt?: string;
}

/**
 * Podsumowanie do podglądu w kreatorze/panelu: „12 meczów, ok. 6 fal, koniec
 * ok. 13:40" — bez tego organizator dowiaduje się, że terminarz się nie mieści
 * w oknie boiska dopiero PO wygenerowaniu.
 */
export function szacunekCzasu(
  mecze: readonly NowyMecz[],
  opcje: { liczbaAren: number; czasMeczuMin: number; przerwaMin: number; startAt?: string },
): SzacunekCzasu {
  const doRozegrania = mecze.filter((m) => (m.status ?? 'zaplanowany') === 'zaplanowany');
  const poKolejkach = new Map<number, number>();
  for (const m of doRozegrania) {
    const k = m.kolejka ?? 1;
    poKolejkach.set(k, (poKolejkach.get(k) ?? 0) + 1);
  }
  const areny = Math.max(1, opcje.liczbaAren);
  let liczbaFal = 0;
  for (const ile of Array.from(poKolejkach.values())) liczbaFal += Math.ceil(ile / areny);

  const czasCalkowityMin = liczbaFal * (opcje.czasMeczuMin + opcje.przerwaMin);
  const wynik: SzacunekCzasu = { liczbaMeczow: doRozegrania.length, liczbaFal, czasCalkowityMin };
  if (opcje.startAt) {
    wynik.koniecAt = new Date(new Date(opcje.startAt).getTime() + czasCalkowityMin * 60_000).toISOString();
  }
  return wynik;
}
