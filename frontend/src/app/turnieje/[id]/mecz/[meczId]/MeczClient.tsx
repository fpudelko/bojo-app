'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Undo2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useToast } from '@/lib/toast';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import { useWstecz } from '@/lib/historia';
import { getTurniej } from '@/lib/turnieje';
import { getDruzynyZeSkladem } from '@/lib/turniejDruzyny';
import {
  getMecz, getAreny, getZdarzenia, dodajZdarzenie, cofnijOstatnieZdarzenie,
  rozpocznijMecz, zakonczMecz, updateMecz, czyProwadziMecz,
} from '@/lib/turniejMecze';
import {
  wynikZeZdarzen, wymaganeKarne, jestSportemSetowym, jestKoszykowka, wygranSetow,
} from '@/lib/turniejWynik';
import { FAZA_LABEL, STATUS_MECZU } from '@/lib/turniejEtykiety';
import type { Turniej, TurniejMecz, TurniejDruzyna, TurniejArena, TurniejZdarzenie, ZdarzenieTyp } from '@/types';

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

  const [wybranyA, setWybranyA] = useState('');
  const [wybranyB, setWybranyB] = useState('');
  const [asystaA, setAsystaA] = useState('');
  const [asystaB, setAsystaB] = useState('');
  const [aktualnySet, setAktualnySet] = useState({ a: 0, b: 0 });
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

  const przeliczLokalnie = (lista: TurniejZdarzenie[]) => {
    if (!mecz.druzynaAId || !mecz.druzynaBId) return;
    const { wynikA, wynikB } = wynikZeZdarzen(lista, mecz.druzynaAId, mecz.druzynaBId);
    setMecz((m) => (m ? { ...m, wynikA, wynikB } : m));
  };

  const dodajZdarzenieAkcja = async (druzynaId: string, typ: ZdarzenieTyp, zawodnikId?: string, asystaZawodnikId?: string) => {
    const tymczasowe: TurniejZdarzenie = {
      id: `tymczasowe-${Date.now()}`, meczId, turniejId: turniej?.id ?? id, druzynaId,
      zawodnikId: zawodnikId || undefined, asystaZawodnikId: asystaZawodnikId || undefined,
      typ, wartosc: 1, createdAt: new Date().toISOString(),
    };
    const nowaLista = [...zdarzenia, tymczasowe];
    setZdarzenia(nowaLista);
    przeliczLokalnie(nowaLista);
    try {
      const realne = await dodajZdarzenie(meczId, { druzynaId, typ, zawodnikId: zawodnikId || undefined, asystaZawodnikId: asystaZawodnikId || undefined });
      setZdarzenia((obecne) => obecne.map((z) => (z.id === tymczasowe.id ? realne : z)));
    } catch (e) {
      const cofnieta = nowaLista.filter((z) => z.id !== tymczasowe.id);
      setZdarzenia(cofnieta);
      przeliczLokalnie(cofnieta);
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać zdarzenia', 'error');
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
    const wynik = await potwierdz({
      tytul: 'Zakończyć mecz?',
      konsekwencje: [
        'Wyniku nie da się później cofnąć',
        obieDruzynyZnane ? 'Zwycięzca przejdzie do kolejnej rundy (jeśli to mecz drabinki)' : '',
      ].filter(Boolean),
      potwierdzLabel: 'Zakończ mecz',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
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
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5">
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.ton}`}>{status.label}</span>
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

        {prowadzi && trwajacy && !setowy && obieDruzynyZnane && (
          <div className="space-y-3">
            {([
              { druzyna: druzynaA, druzynaId: mecz.druzynaAId!, wybrany: wybranyA, setWybrany: setWybranyA, asysta: asystaA, setAsysta: setAsystaA },
              { druzyna: druzynaB, druzynaId: mecz.druzynaBId!, wybrany: wybranyB, setWybrany: setWybranyB, asysta: asystaB, setAsysta: setAsystaB },
            ] as const).map(({ druzyna, druzynaId, wybrany, setWybrany, asysta, setAsysta }) => (
              <div key={druzynaId} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 space-y-2">
                <p className="text-sm font-medium text-ink">{druzyna?.nazwa}</p>
                {druzyna?.zawodnicy && druzyna.zawodnicy.length > 0 && (
                  <select
                    value={wybrany}
                    onChange={(e) => setWybrany(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="">Bez wskazania zawodnika</option>
                    {druzyna.zawodnicy.map((z) => <option key={z.id} value={z.id}>{z.imie}</option>)}
                  </select>
                )}
                {!koszykowka && druzyna?.zawodnicy && druzyna.zawodnicy.length > 1 && (
                  <select
                    value={asysta}
                    onChange={(e) => setAsysta(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="">Bez asysty</option>
                    {druzyna.zawodnicy.filter((z) => z.id !== wybrany).map((z) => <option key={z.id} value={z.id}>Asysta: {z.imie}</option>)}
                  </select>
                )}
                <div className="flex flex-wrap gap-2">
                  {koszykowka ? (
                    [1, 2, 3].map((pkt) => (
                      <button
                        key={pkt}
                        onClick={() => dodajZdarzenieAkcja(druzynaId, 'punkty', wybrany)}
                        className="rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700"
                      >
                        +{pkt}
                      </button>
                    ))
                  ) : (
                    <>
                      <button onClick={() => dodajZdarzenieAkcja(druzynaId, 'gol', wybrany, asysta)} className="rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700">{ETYKIETA_ZDARZENIA.gol}</button>
                      <button onClick={() => dodajZdarzenieAkcja(druzynaId, 'samobojczy', wybrany)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">{ETYKIETA_ZDARZENIA.samobojczy}</button>
                      <button onClick={() => dodajZdarzenieAkcja(druzynaId, 'zolta', wybrany)} className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">{ETYKIETA_ZDARZENIA.zolta}</button>
                      <button onClick={() => dodajZdarzenieAkcja(druzynaId, 'czerwona', wybrany)} className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600">{ETYKIETA_ZDARZENIA.czerwona}</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {zdarzenia.length > 0 && (
              <button onClick={cofnijAkcja} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink">
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
                <div className="flex gap-2">
                  <Button onClick={zakonczMeczAkcja}>Potwierdź zakończenie</Button>
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
                <div key={z.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>{ETYKIETA_ZDARZENIA[z.typ]}</span>
                  <span className="text-slate-400">:</span>
                  <span className="min-w-0 truncate">
                    {zawodnik ? `${zawodnik.imie} (${nazwaDruzyny})` : nazwaDruzyny}
                    {asysta && <span className="text-slate-400"> · asysta: {asysta.imie}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
      {oknoPotwierdzenia}
    </div>
  );
}
