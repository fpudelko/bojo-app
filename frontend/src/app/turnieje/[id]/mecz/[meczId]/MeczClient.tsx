'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Undo2, Timer, ChevronRight, MoreHorizontal } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useToast } from '@/lib/toast';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import { useWstecz } from '@/lib/historia';
import { getTurniej } from '@/lib/turnieje';
import { getDruzynyZeSkladem } from '@/lib/turniejDruzyny';
import {
  getMecz, getMecze, getAreny, getZdarzenia, dodajZdarzenie, cofnijOstatnieZdarzenie,
  rozpocznijMecz, zakonczMecz, updateMecz, czyProwadziMecz, walkowerMeczu,
} from '@/lib/turniejMecze';
import {
  wynikZeZdarzen, wymaganeKarne, jestSportemSetowym, jestKoszykowka, wygranSetow,
  czasGry, poCzasie,
} from '@/lib/turniejWynik';
import { FAZA_LABEL, STATUS_MECZU, etykietaTerminu } from '@/lib/turniejEtykiety';
import ArkuszSkladu from '@/components/turnieje/ArkuszSkladu';
import type { Turniej, TurniejMecz, TurniejDruzyna, TurniejArena, TurniejZdarzenie, ZdarzenieTyp } from '@/types';

const TYTUL_ARKUSZA: Record<ZdarzenieTyp, string> = {
  gol: 'Kto strzelił?',
  punkty: 'Kto zdobył punkty?',
  samobojczy: 'Kto strzelił samobójczego?',
  zolta: 'Kto dostał żółtą kartkę?',
  czerwona: 'Kto dostał czerwoną kartkę?',
};

const ETYKIETA_ZDARZENIA: Record<ZdarzenieTyp, string> = {
  gol: '⚽ Gol', samobojczy: '⚽ Samobójczy', zolta: '🟨 Żółta kartka', czerwona: '🟥 Czerwona kartka', punkty: '🏀 Punkty',
};

export default function MeczClient() {
  const { id, meczId } = useParams<{ id: string; meczId: string }>();
  const { toast } = useToast();
  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();
  const wstecz = useWstecz(`/turnieje/${id}?tab=terminarz`);

  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [mecz, setMecz] = useState<TurniejMecz | null>(null);
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [areny, setAreny] = useState<TurniejArena[]>([]);
  const [zdarzenia, setZdarzenia] = useState<TurniejZdarzenie[]>([]);
  const [prowadzi, setProwadzi] = useState(false);
  const [ladowanie, setLadowanie] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Arkusz składu zastąpił dwa natywne `<select>` (strzelec + asysta) —
  // `krok` mówi, o co właśnie pytamy, a `wTrakcie` trzyma zdarzenie do
  // zapisania, dopóki prowadzący nie odpowie na oba pytania.
  const [arkusz, setArkusz] = useState<{
    krok: 'strzelec' | 'asysta';
    druzynaId: string;
    typ: ZdarzenieTyp;
    wartosc: number;
    zawodnikId?: string;
  } | null>(null);
  const [aktualnySet, setAktualnySet] = useState({ a: 0, b: 0 });
  const [menuOtwarte, setMenuOtwarte] = useState(false);
  const [nastepnyNaArenie, setNastepnyNaArenie] = useState<TurniejMecz | null>(null);
  // Tyka co sekundę wyłącznie wtedy, gdy mecz trwa — zegar liczy się i tak
  // z `rozpoczetyAt`, to tylko powód do przerysowania.
  const [tik, setTik] = useState(0);
  const [pokazZakoncz, setPokazZakoncz] = useState(false);
  const [karneA, setKarneA] = useState(0);
  const [karneB, setKarneB] = useState(0);
  const [mvpId, setMvpId] = useState('');

  const wczytaj = useCallback(async () => {
    const m = await getMecz(meczId);
    if (!m) { setNotFound(true); return; }
    const [t, d, a, z, p] = await Promise.all([
      getTurniej(id), getDruzynyZeSkladem(id), getAreny(id), getZdarzenia(meczId), czyProwadziMecz(meczId),
    ]);
    setMecz(m);
    setTurniej(t);
    setDruzyny(d);
    setAreny(a);
    setZdarzenia(z);
    setProwadzi(p);
  }, [id, meczId]);

  useEffect(() => {
    let aktualne = true;
    setLadowanie(true);
    wczytaj()
      .catch(() => { if (aktualne) setNotFound(true); })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [wczytaj]);

  const trwa = mecz?.status === 'trwa';
  useEffect(() => {
    if (!trwa) return;
    const id = setInterval(() => setTik((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [trwa]);

  // Co dalej na tej arenie — pytanie, które prowadzący zadaje sobie w sekundzie
  // po ostatnim gwizdku. Dotąd wracał na listę meczów i szukał wzrokiem.
  const rozstrzygniety = mecz?.status === 'zakonczony' || mecz?.status === 'walkower';
  useEffect(() => {
    if (!rozstrzygniety || !mecz?.arenaId || !prowadzi) { setNastepnyNaArenie(null); return; }
    let aktualne = true;
    getMecze(id)
      .then((lista) => {
        if (!aktualne) return;
        const kolejny = lista
          .filter((m) => m.arenaId === mecz.arenaId && m.id !== mecz.id && m.status === 'zaplanowany')
          .sort((a, b) => (a.zaplanowanyAt ?? '').localeCompare(b.zaplanowanyAt ?? '') || a.numer - b.numer)[0];
        setNastepnyNaArenie(kolejny ?? null);
      })
      .catch(() => undefined);
    return () => { aktualne = false; };
  }, [rozstrzygniety, mecz?.arenaId, mecz?.id, prowadzi, id]);

  if (ladowanie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (notFound || !mecz) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center">
          <p className="font-medium text-ink">Nie znaleziono meczu</p>
          <Link href={`/turnieje/${id}`} className="mt-2 inline-block text-sm text-primary-600">Wróć do turnieju</Link>
        </div>
      </div>
    );
  }

  const druzynaA = druzyny.find((d) => d.id === mecz.druzynaAId);
  const druzynaB = druzyny.find((d) => d.id === mecz.druzynaBId);
  const arena = mecz.arenaId ? areny.find((a) => a.id === mecz.arenaId) : undefined;
  const status = STATUS_MECZU[mecz.status];
  const sport = turniej?.sport ?? '';
  const setowy = jestSportemSetowym(sport);
  const koszykowka = jestKoszykowka(sport);
  const obieDruzynyZnane = !!mecz.druzynaAId && !!mecz.druzynaBId;
  const trwajacy = mecz.status === 'trwa';
  const mozeZaczac = mecz.status === 'zaplanowany' && obieDruzynyZnane;
  const wszyscyZawodnicy = [...(druzynaA?.zawodnicy ?? []), ...(druzynaB?.zawodnicy ?? [])];
  const skladDruzyny = (druzynaId: string) =>
    (druzynaId === mecz.druzynaAId ? druzynaA?.zawodnicy : druzynaB?.zawodnicy) ?? [];
  const nazwaDruzyny = (druzynaId: string) =>
    (druzynaId === mecz.druzynaAId ? druzynaA?.nazwa : druzynaB?.nazwa) ?? 'drużyna';
  /** Następny mecz na arenie gra INNYMI drużynami niż ten — nazwa musi przyjść
   *  z pełnej listy, nie z dwóch drużyn tego meczu. */
  const nazwaDruzynyZListy = (druzynaId?: string) =>
    (druzynaId ? druzyny.find((d) => d.id === druzynaId)?.nazwa : undefined) ?? 'TBD';

  // `tik` jest tu po to, żeby zegar przerysował się co sekundę — wartość
  // nieużywana wprost, liczy się sam fakt zmiany stanu.
  void tik;
  const czas = czasGry(mecz.rozpoczetyAt, new Date(), turniej?.czasMeczuMin);
  const meczPucharowy = mecz.faza !== 'grupa' && mecz.faza !== 'liga';
  const minalCzas = poCzasie(mecz.rozpoczetyAt, turniej?.czasMeczuMin ?? 0);

  const przeliczLokalnie = (lista: TurniejZdarzenie[]) => {
    if (!mecz.druzynaAId || !mecz.druzynaBId) return;
    const { wynikA, wynikB } = wynikZeZdarzen(lista, mecz.druzynaAId, mecz.druzynaBId);
    setMecz((m) => (m ? { ...m, wynikA, wynikB } : m));
  };

  /**
   * `wartosc` JEST PRZEKAZYWANA — i to jest poprawka błędu, nie nowa funkcja.
   * Koszykarskie przyciski `+1/+2/+3` wołały tę funkcję bez tego argumentu,
   * a `dodajZdarzenie()` domyślała `wartosc: 1`. Trójka zapisywała się jako
   * punkt: kolumna `turniej_zdarzenia.wartosc` i wyzwalacz `przelicz_wynik_meczu()`
   * (147) liczyły wszystko poprawnie, tylko nikt im nie powiedział ile.
   * Turniej koszykarski prowadzony tą konsolą kończył się fałszywym wynikiem.
   */
  /** Minuta meczu liczona z `rozpoczetyAt`, a nie wpisywana z ręki.
   *  Kolumna `minuta` istniała od migracji 147 i była ZAWSZE pusta, bo nic jej
   *  nie podawało: przebieg meczu czytał się „⚽ Gol : Ekipa z Osiedla", bez
   *  informacji, kiedy padł. Prowadzący nie ma jak wpisywać minut, ale zegar
   *  i tak je zna. Gdy mecz nie jest rozpoczęty, zostaje `undefined`. */
  const minutaTeraz = (): number | undefined => {
    if (!mecz?.rozpoczetyAt) return undefined;
    const od = new Date(mecz.rozpoczetyAt).getTime();
    if (Number.isNaN(od)) return undefined;
    return Math.max(0, Math.floor((Date.now() - od) / 60_000));
  };

  const dodajZdarzenieAkcja = async (
    druzynaId: string, typ: ZdarzenieTyp, zawodnikId?: string, asystaZawodnikId?: string, wartosc = 1,
  ) => {
    const minuta = minutaTeraz();
    const tymczasowe: TurniejZdarzenie = {
      id: `tymczasowe-${Date.now()}`, meczId, turniejId: turniej?.id ?? id, druzynaId,
      zawodnikId: zawodnikId || undefined, asystaZawodnikId: asystaZawodnikId || undefined,
      typ, wartosc, minuta, createdAt: new Date().toISOString(),
    };
    const nowaLista = [...zdarzenia, tymczasowe];
    setZdarzenia(nowaLista);
    przeliczLokalnie(nowaLista);
    try {
      const realne = await dodajZdarzenie(meczId, {
        druzynaId, typ, wartosc, minuta,
        zawodnikId: zawodnikId || undefined,
        asystaZawodnikId: asystaZawodnikId || undefined,
      });
      setZdarzenia((obecne) => obecne.map((z) => (z.id === tymczasowe.id ? realne : z)));
    } catch (e) {
      const cofnieta = nowaLista.filter((z) => z.id !== tymczasowe.id);
      setZdarzenia(cofnieta);
      przeliczLokalnie(cofnieta);
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać zdarzenia', 'error');
    }
  };

  /** Zdarzenie wymagające wskazania człowieka otwiera arkusz; reszta (kartka
   *  bez nazwiska, samobójczy) zapisuje się od razu. */
  const zapytajOZawodnika = (druzynaId: string, typ: ZdarzenieTyp, wartosc = 1) => {
    setArkusz({ krok: 'strzelec', druzynaId, typ, wartosc });
  };

  const odpowiedzArkusza = (zawodnikId: string | undefined) => {
    if (!arkusz) return;
    // Piłkarski gol pyta jeszcze o asystę — ale tylko wtedy, gdy strzelec jest
    // wskazany. „Asysta przy golu nieznanego strzelca" to dane, których nikt
    // nie potrzebuje, a jedno pytanie mniej to sekunda na boisku.
    const pytacOAsyste = arkusz.krok === 'strzelec'
      && arkusz.typ === 'gol'
      && !koszykowka
      && !!zawodnikId
      && skladDruzyny(arkusz.druzynaId).length > 1;
    if (pytacOAsyste) {
      setArkusz({ ...arkusz, krok: 'asysta', zawodnikId });
      return;
    }
    const strzelec = arkusz.krok === 'asysta' ? arkusz.zawodnikId : zawodnikId;
    const asysta = arkusz.krok === 'asysta' ? zawodnikId : undefined;
    setArkusz(null);
    void dodajZdarzenieAkcja(arkusz.druzynaId, arkusz.typ, strzelec, asysta, arkusz.wartosc);
  };

  const walkowerAkcja = async (zwyciezcaId: string, nazwaZwyciezcy: string) => {
    setMenuOtwarte(false);
    const wynik = await potwierdz({
      tytul: 'Walkower?',
      konsekwencje: [
        `${nazwaZwyciezcy} wygrywa bez gry`,
        'Wynik zostaje 0:0, a drużyna dostaje trzy punkty',
        'Tego nie da się cofnąć',
      ],
      potwierdzLabel: 'Wpisz walkower',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try {
      await walkowerMeczu(meczId, zwyciezcaId);
      await wczytaj();
      toast('Walkower zapisany');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać walkoweru', 'error');
    }
  };

  const cofnijAkcja = async () => {
    if (zdarzenia.length === 0) return;
    const bezOstatniego = zdarzenia.slice(0, -1);
    setZdarzenia(bezOstatniego);
    przeliczLokalnie(bezOstatniego);
    try {
      await cofnijOstatnieZdarzenie(meczId);
    } catch (e) {
      await wczytaj();
      toast(e instanceof Error ? e.message : 'Nie udało się cofnąć zdarzenia', 'error');
    }
  };

  const rozpocznijAkcja = async () => {
    try { await rozpocznijMecz(meczId); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się rozpocząć meczu', 'error'); }
  };

  const zapiszPunktSetu = async (nowySet: { a: number; b: number }) => {
    setAktualnySet(nowySet);
    const ukonczone = mecz.sety ?? [];
    try { await updateMecz(meczId, { sety: [...ukonczone, nowySet] }); }
    catch { /* najbliższe „Zakończ set" i tak zapisze aktualny stan */ }
  };

  const zakonczSetAkcja = async () => {
    if (!mecz.druzynaAId || !mecz.druzynaBId) return;
    const noweSety = [...(mecz.sety ?? []), aktualnySet];
    const wygrane = wygranSetow(noweSety);
    setAktualnySet({ a: 0, b: 0 });
    setMecz({ ...mecz, sety: noweSety, wynikA: wygrane.a, wynikB: wygrane.b });
    try {
      await updateMecz(meczId, { sety: noweSety, wynikA: wygrane.a, wynikB: wygrane.b });
    } catch (e) {
      await wczytaj();
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać seta', 'error');
    }
  };

  const wymagaKarnych = wymaganeKarne(mecz.faza, mecz.wynikA, mecz.wynikB);

  const zakonczMeczAkcja = async () => {
    if (wymagaKarnych && karneA === karneB) {
      toast('Wpisz różne wyniki karnych, remis w tej fazie musi mieć rozstrzygnięcie', 'error');
      return;
    }
    // BEZ OSOBNEGO OKNA. Zakończenie meczu wymagało trzech stuknięć:
    // „Zakończ mecz" otwierało panel, „Potwierdź zakończenie" w panelu,
    // a potem jeszcze okno „Zakończyć mecz?". Panel JEST potwierdzeniem:
    // trzeba go świadomie otworzyć, wpisać w nim karne i MVP, i dopiero
    // wtedy zatwierdzić. Czwarta bramka w tym miejscu niczego nie chroni,
    // a prowadzący robi to kilkanaście razy w ciągu dnia, jedną ręką.
    // Konsekwencje przeniesione do panelu, nad przycisk.
    try {
      await zakonczMecz(meczId, {
        karneA: wymagaKarnych ? karneA : undefined,
        karneB: wymagaKarnych ? karneB : undefined,
        mvpZawodnikId: mvpId || undefined,
      });
      await wczytaj();
      setPokazZakoncz(false);
      toast('Mecz zakończony');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zakończyć meczu', 'error');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <div className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button onClick={wstecz} aria-label="Wróć" className="shrink-0 text-slate-500 hover:text-ink">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-ink">
            M{mecz.numer} · {FAZA_LABEL[mecz.faza]}
          </h1>
          {/* WALKOWER. Status istniał od migracji `146` i wpisywał go wyłącznie
              generator terminarza przy wolnych losach — prowadzący, któremu
              drużyna nie dojechała, nie miał jak go zapisać. Pod „⋯", bo to
              wyjście awaryjne, nie codzienna akcja. */}
          {prowadzi && (mecz.status === 'zaplanowany' || mecz.status === 'trwa') && obieDruzynyZnane && (
            <div className="relative shrink-0">
              <button
                onClick={() => setMenuOtwarte((v) => !v)}
                aria-label="Więcej"
                aria-expanded={menuOtwarte}
                className="flex h-10 w-10 items-center justify-center text-slate-500 hover:text-ink"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {menuOtwarte && (
                <div className="absolute right-0 top-11 w-60 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                  <p className="px-3 pt-2.5 text-xs font-medium text-slate-400">Drużyna się nie zgłosiła</p>
                  {([mecz.druzynaAId!, mecz.druzynaBId!] as const).map((zwyciezcaId) => (
                    <button
                      key={zwyciezcaId}
                      onClick={() => walkowerAkcja(zwyciezcaId, nazwaDruzyny(zwyciezcaId))}
                      className="block w-full px-3 py-2.5 text-left text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      Walkower dla {nazwaDruzyny(zwyciezcaId)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5">
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.ton}`}>{status.label}</span>
            {(mecz.zaplanowanyAt || arena) && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {arena && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {arena.nazwa}</span>}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
              {druzynaA?.nazwa ?? 'TBD'}
            </span>
            <span className="shrink-0 font-mono text-2xl font-bold text-ink">{mecz.wynikA}:{mecz.wynikB}</span>
            <span className="min-w-0 flex-1 truncate text-right text-base font-semibold text-ink">
              {druzynaB?.nazwa ?? 'TBD'}
            </span>
          </div>
          {/* ZEGAR MECZU. Prowadzący pilnuje „2×10 minut" — dotąd stoperem
              w innej aplikacji, przełączając się tam i z powrotem. Czas liczy
              się z `rozpoczetyAt` (kolumna), więc odświeżenie strony w 34.
              minucie nie zaczyna odliczania od zera. Ceną jest brak pauzy —
              napisany wprost pod zegarem, bo zegar, który po odświeżeniu
              kłamie, byłby gorszy niż zegar bez pauzy. */}
          {/* Bez zegara, gdy przekroczył dwukrotność regulaminowego czasu:
              zamiast liczby, która wygląda na błąd, zdanie, które mówi prawdę
              o stanie meczu. */}
          {trwajacy && !czas && (
            <p className="text-center text-sm font-medium text-slate-500">
              Mecz w toku. Wynik aktualizuje prowadzący.
            </p>
          )}
          {trwajacy && czas && (
            <div className="text-center">
              <p className={`inline-flex items-center gap-1.5 font-mono text-2xl font-bold ${
                minalCzas ? 'text-amber-600' : 'text-ink'
              }`}>
                <Timer className="h-5 w-5" /> {czas}
              </p>
              <p className="text-xs text-slate-400">
                {minalCzas
                  ? `Regulaminowe ${turniej?.czasMeczuMin ?? 0} min minęło`
                  : `od pierwszego gwizdka · ${turniej?.czasMeczuMin ?? 0} min regulaminowe`}
              </p>
            </div>
          )}
          {mecz.karneA !== undefined && mecz.karneB !== undefined && (
            <p className="text-center text-xs text-slate-400">Karne: {mecz.karneA}:{mecz.karneB}</p>
          )}
          {!obieDruzynyZnane && (
            <p className="text-center text-xs text-slate-400">Ten mecz czeka jeszcze na obie drużyny.</p>
          )}
        </div>

        {prowadzi && mozeZaczac && (
          <Button onClick={rozpocznijAkcja} className="w-full">Rozpocznij mecz</Button>
        )}

        {/* DWA WIELKIE PRZYCISKI OBOK SIEBIE, po jednym na drużynę. Sześć
            godzin na stojąco, w słońcu, jedną ręką: gol pada i trzeba go
            zapisać w jednym dotknięciu, a dopiero potem odpowiedzieć na
            pytanie „kto strzelił" (arkusz ze składem, `ArkuszSkladu`). */}
        {prowadzi && trwajacy && !setowy && obieDruzynyZnane && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {([mecz.druzynaAId!, mecz.druzynaBId!] as const).map((druzynaId) => (
                <div key={druzynaId} className="space-y-2">
                  {koszykowka ? (
                    <>
                      <p className="truncate text-center text-sm font-medium text-ink">{nazwaDruzyny(druzynaId)}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[1, 2, 3].map((pkt) => (
                          <button
                            key={pkt}
                            onClick={() => zapytajOZawodnika(druzynaId, 'punkty', pkt)}
                            className="min-h-[64px] rounded-xl bg-primary-50 dark:bg-primary-950 text-lg font-bold text-primary-700 dark:text-primary-300 active:bg-primary-100"
                          >
                            +{pkt}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => zapytajOZawodnika(druzynaId, 'gol')}
                      className="flex min-h-[96px] w-full flex-col items-center justify-center gap-1 rounded-2xl bg-primary-50 dark:bg-primary-950 px-2 py-3 active:bg-primary-100 dark:active:bg-primary-900"
                    >
                      <span className="text-sm font-bold text-primary-700 dark:text-primary-300">GOL</span>
                      <span className="line-clamp-2 text-center text-xs text-slate-500 dark:text-slate-400">
                        {nazwaDruzyny(druzynaId)}
                      </span>
                    </button>
                  )}

                  {!koszykowka && (
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => zapytajOZawodnika(druzynaId, 'zolta')}
                        aria-label={`Żółta kartka, ${nazwaDruzyny(druzynaId)}`}
                        className="min-h-[44px] min-w-[44px] rounded-lg bg-amber-50 dark:bg-amber-950 text-base"
                      >🟨</button>
                      <button
                        onClick={() => zapytajOZawodnika(druzynaId, 'czerwona')}
                        aria-label={`Czerwona kartka, ${nazwaDruzyny(druzynaId)}`}
                        className="min-h-[44px] min-w-[44px] rounded-lg bg-red-50 dark:bg-red-950 text-base"
                      >🟥</button>
                      <button
                        onClick={() => dodajZdarzenieAkcja(druzynaId, 'samobojczy')}
                        aria-label={`Samobójczy, ${nazwaDruzyny(druzynaId)}`}
                        className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300"
                      >sam.</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {zdarzenia.length > 0 && (
              <button onClick={cofnijAkcja} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink">
                <Undo2 className="h-4 w-4" /> Cofnij ostatnie
              </button>
            )}
          </div>
        )}

        {prowadzi && trwajacy && setowy && obieDruzynyZnane && (
          <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
            <p className="text-sm font-medium text-ink">
              Set {(mecz.sety?.length ?? 0) + 1}, dotychczas wygrane sety: {wygranSetow(mecz.sety ?? []).a}:{wygranSetow(mecz.sety ?? []).b}
            </p>
            <div className="flex items-center justify-around gap-3">
              {(['a', 'b'] as const).map((strona) => (
                <div key={strona} className="flex flex-col items-center gap-2">
                  <span className="text-xs text-slate-400">{strona === 'a' ? druzynaA?.nazwa : druzynaB?.nazwa}</span>
                  <span className="font-mono text-3xl font-bold text-ink">{aktualnySet[strona]}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => zapiszPunktSetu({ ...aktualnySet, [strona]: Math.max(0, aktualnySet[strona] - 1) })}
                      className="h-9 w-9 rounded-lg bg-slate-100 text-lg font-semibold text-slate-600"
                    >−</button>
                    <button
                      onClick={() => zapiszPunktSetu({ ...aktualnySet, [strona]: aktualnySet[strona] + 1 })}
                      className="h-9 w-9 rounded-lg bg-primary-50 text-lg font-semibold text-primary-700"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={zakonczSetAkcja} className="w-full">Zakończ set</Button>
          </div>
        )}

        {prowadzi && trwajacy && obieDruzynyZnane && (
          <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
            {!pokazZakoncz ? (
              <Button variant="outline" onClick={() => setPokazZakoncz(true)} className="w-full">Zakończ mecz</Button>
            ) : (
              <div className="space-y-3">
                {wymagaKarnych && (
                  <div>
                    <p className="text-sm font-medium text-ink">Remis: potrzebny wynik karnych</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input type="number" min={0} value={karneA} onChange={(e) => setKarneA(Number(e.target.value) || 0)}
                        className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-100" />
                      <span className="text-slate-400">:</span>
                      <input type="number" min={0} value={karneB} onChange={(e) => setKarneB(Number(e.target.value) || 0)}
                        className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-100" />
                    </div>
                  </div>
                )}
                {wszyscyZawodnicy.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-ink">MVP meczu (opcjonalnie)</label>
                    <select
                      value={mvpId}
                      onChange={(e) => setMvpId(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-100"
                    >
                      <option value="">Bez wskazania</option>
                      {wszyscyZawodnicy.map((z) => <option key={z.id} value={z.id}>{z.imie}</option>)}
                    </select>
                  </div>
                )}
                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  Wyniku nie da się później cofnąć.
                  {/* Zdanie o kolejnej rundzie tylko w meczu PUCHAROWYM.
                      Wcześniej stało wszędzie z dopiskiem „(jeśli to mecz
                      drabinki)", czyli aplikacja pytała prowadzącego o coś,
                      co sama wie. */}
                  {meczPucharowy && ' Zwycięzca przejdzie do kolejnej rundy.'}
                </div>
                <div className="flex gap-2">
                  <Button onClick={zakonczMeczAkcja}>Zakończ mecz</Button>
                  <Button variant="outline" onClick={() => setPokazZakoncz(false)}>Anuluj</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {zdarzenia.length > 0 && !setowy && (
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold text-slate-500">Przebieg meczu</h2>
            {zdarzenia.map((z) => {
              const nazwaDruzyny = z.druzynaId === mecz.druzynaAId ? druzynaA?.nazwa : druzynaB?.nazwa;
              const zawodnik = wszyscyZawodnicy.find((zw) => zw.id === z.zawodnikId);
              const asysta = wszyscyZawodnicy.find((zw) => zw.id === z.asystaZawodnikId);
              return (
                /* Dwukropek stał tu ZAWSZE, także gdy po nim nie było nazwiska
                   (drużyna bez wpisanego składu), więc wiersz czytał się
                   „⚽ Gol : Ekipa z Osiedla". Separator pojawia się teraz
                   tylko wtedy, gdy faktycznie coś rozdziela. */
                <div key={z.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  {z.minuta !== undefined && (
                    <span className="shrink-0 font-mono text-xs text-slate-400">{z.minuta}&apos;</span>
                  )}
                  <span className="shrink-0">{ETYKIETA_ZDARZENIA[z.typ]}</span>
                  <span className="min-w-0 truncate">
                    {zawodnik ? `${zawodnik.imie} (${nazwaDruzyny})` : nazwaDruzyny}
                    {asysta && <span className="text-slate-400"> · asysta: {asysta.imie}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {/* CO DALEJ NA TEJ ARENIE. Sekunda po ostatnim gwizdku prowadzący
            wracał na listę meczów i szukał kolejnego wzrokiem. Jedno zdanie
            zamienia sześć godzin klikania po terminarzu w kolejkę. */}
        {prowadzi && nastepnyNaArenie && (
          <Link
            href={`/turnieje/${id}/mecz/${nastepnyNaArenie.id}`}
            className="flex items-center gap-3 rounded-2xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Następny na tej arenie
              </p>
              <p className="truncate text-sm font-semibold text-ink">
                {nazwaDruzynyZListy(nastepnyNaArenie.druzynaAId)} – {nazwaDruzynyZListy(nastepnyNaArenie.druzynaBId)}
              </p>
              {nastepnyNaArenie.zaplanowanyAt && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {etykietaTerminu(
                    nastepnyNaArenie.zaplanowanyAt.slice(0, 10),
                    nastepnyNaArenie.zaplanowanyAt.slice(11, 16),
                  )}
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-primary-600" />
          </Link>
        )}
      </main>

      {arkusz && (
        <ArkuszSkladu
          tytul={arkusz.krok === 'asysta' ? 'Asysta?' : TYTUL_ARKUSZA[arkusz.typ]}
          podtytul={nazwaDruzyny(arkusz.druzynaId)}
          zawodnicy={
            arkusz.krok === 'asysta'
              ? skladDruzyny(arkusz.druzynaId).filter((z) => z.id !== arkusz.zawodnikId)
              : skladDruzyny(arkusz.druzynaId)
          }
          etykietaPominiecia={arkusz.krok === 'asysta' ? 'Bez asysty' : 'Nie wiem kto, zapisz bez nazwiska'}
          onWybor={odpowiedzArkusza}
          onZamknij={() => {
            // Zamknięcie arkusza STRZELCA anuluje całe zdarzenie (prowadzący
            // pomylił drużynę), zamknięcie arkusza ASYSTY zapisuje gol bez
            // niej — bo gol już padł i cofanie go byłoby zaskoczeniem.
            if (arkusz.krok === 'asysta') odpowiedzArkusza(undefined);
            else setArkusz(null);
          }}
        />
      )}
      {oknoPotwierdzenia}
    </div>
  );
}
