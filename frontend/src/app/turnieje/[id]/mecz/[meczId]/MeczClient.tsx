'use client';

import { useAdres, useAdresWPasku } from '@/lib/useAdres';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Undo2, Timer, ChevronRight, MoreHorizontal, Minus, Plus } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useToast } from '@/lib/toast';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import RamkaTurnieju, { SZEROKOSC_TURNIEJU } from '@/components/turnieje/RamkaTurnieju';
import { withCount } from '@/lib/plural';
import { getTurniej } from '@/lib/turnieje';
import { getDruzynyZeSkladem } from '@/lib/turniejDruzyny';
import {
  getMecz, getMecze, getAreny, getZdarzenia, dodajZdarzenie, cofnijOstatnieZdarzenie,
  rozpocznijMecz, zakonczMecz, updateMecz, czyProwadziMecz, walkowerMeczu, wpiszWynikMeczu,
  wpiszWynikZeStrzelcami, cofnijWynikMeczu, resetujMecz, getGrupy,
  ustawStrzelca, dopiszZawodnikaWMeczu,
} from '@/lib/turniejMecze';
import {
  wynikZeZdarzen, wymaganeKarne, jestSportemSetowym, jestKoszykowka, wygranSetow,
  czyWolnyLos,
} from '@/lib/turniejWynik';
import { STATUS_MECZU, etykietaTerminuMeczu, etykietaFazyMeczu, porownajTermin } from '@/lib/turniejEtykiety';
import { nazwaMiejscaWGrupie } from '@/lib/turniejFormat';
import ArkuszSkladu from '@/components/turnieje/ArkuszSkladu';
import {
  fazaZegara, sekundyPolowy, formatZegara, minutaMeczu, poCzasiePolowy,
  startZegara, pauzaZegara, koniecPolowy, type ZmianaZegara,
} from '@/lib/zegarMeczu';
import type { Turniej, TurniejMecz, TurniejDruzyna, TurniejArena, TurniejZdarzenie, ZdarzenieTyp, TurniejGrupa } from '@/types';

const TYTUL_ARKUSZA: Record<ZdarzenieTyp, string> = {
  gol: 'Kto strzelił?',
  punkty: 'Kto zdobył punkty?',
  samobojczy: 'Kto strzelił samobója?',
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
  // Powrót ZAWSZE na turniej (decyzja właściciela z 2026-11-21): „‹ Mecze”
  // w ramce turnieju (2026-11-25), a do pozostałych zakładek prowadzi ramka.
  const adresTurnieju = useAdres('turniej', id) ?? id;

  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [mecz, setMecz] = useState<TurniejMecz | null>(null);
  // Adres z nazwą (177): /turnieje/<nazwa-i-data>/mecz/<numer> w pasku przeglądarki.
  useAdresWPasku({
    [id]: useAdres('turniej', id),
    [meczId]: mecz?.numer !== undefined ? String(mecz.numer) : undefined,
  });
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [areny, setAreny] = useState<TurniejArena[]>([]);
  const [zdarzenia, setZdarzenia] = useState<TurniejZdarzenie[]>([]);
  const [prowadzi, setProwadzi] = useState(false);
  const [ladowanie, setLadowanie] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Arkusz składu zastąpił natywny `<select>` strzelca; trzyma zdarzenie do
  // zapisania, dopóki prowadzący nie wskaże zawodnika albo nie pominie.
  const [arkusz, setArkusz] = useState<{
    druzynaId: string;
    typ: ZdarzenieTyp;
    wartosc: number;
    /** Zmiana strzelca w zdarzeniu już zapisanym (194), zamiast nowego. */
    zdarzenieId?: string;
  } | null>(null);
  const [aktualnySet, setAktualnySet] = useState({ a: 0, b: 0 });
  const [menuOtwarte, setMenuOtwarte] = useState(false);
  const [nastepnyNaArenie, setNastepnyNaArenie] = useState<TurniejMecz | null>(null);
  // Gdy po tym meczu nic na arenie nie zostało, karta wskazuje zaległy mecz
  // sprzed niego i MÓWI to wprost (audyt 2026-11-18, F6).
  const [nastepnyZalegly, setNastepnyZalegly] = useState(false);
  // Tyka co sekundę wyłącznie wtedy, gdy mecz trwa — zegar liczy się i tak
  // z `rozpoczetyAt`, to tylko powód do przerysowania.
  const [tik, setTik] = useState(0);
  const [pokazZakoncz, setPokazZakoncz] = useState(false);
  const [karneA, setKarneA] = useState(0);
  const [karneB, setKarneB] = useState(0);
  const [mvpId, setMvpId] = useState('');
  // Szybkie wpisanie wyniku końcowego (bez prowadzenia meczu na żywo).
  const [wpisA, setWpisA] = useState(0);
  const [wpisB, setWpisB] = useState(0);
  // Strzelcy wskazani przy szybkim wyniku: opcjonalni (2026-11-08).
  const [strzelcyWpis, setStrzelcyWpis] = useState<{ a: string[]; b: string[] }>({ a: [], b: [] });
  /** Poprawa wyniku rozstrzygniętego meczu: formularz z obecnym wynikiem, bez zerowania (2026-11-27). */
  const [poprawia, setPoprawia] = useState(false);
  const [zapisujeWynik, setZapisujeWynik] = useState(false);
  const [grupyPoId, setGrupyPoId] = useState<Map<string, TurniejGrupa>>(new Map());

  const wczytaj = useCallback(async () => {
    const m = await getMecz(meczId);
    if (!m) { setNotFound(true); return; }
    const [t, d, a, z, p, g] = await Promise.all([
      getTurniej(id), getDruzynyZeSkladem(id), getAreny(id), getZdarzenia(meczId), czyProwadziMecz(meczId),
      getGrupy(id),
    ]);
    setGrupyPoId(new Map(g.map((x) => [x.id, x])));
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

  // ODŚWIEŻANIE WYNIKU NA ŻYWO (2026-11-27, zgłoszenie z testu: organizator
  // widział inny wynik niż gracz). Strona meczu wczytywała wynik RAZ, przy
  // otwarciu, więc kibic i drugi prowadzący patrzyli na stary stan do
  // przeładowania. Co 10 s, gdy mecz trwa albo zaraz się zacznie, i od razu
  // po powrocie do karty. Tylko mecz i zdarzenia, nie cały komplet.
  const zywy = mecz?.status === 'trwa' || mecz?.status === 'zaplanowany';
  useEffect(() => {
    if (!zywy) return;
    const odswiez = () => {
      if (document.visibilityState !== 'visible') return;
      void Promise.all([getMecz(meczId), getZdarzenia(meczId)])
        .then(([m, z]) => { if (m) setMecz(m); setZdarzenia(z); })
        .catch(() => { /* następna próba za chwilę */ });
    };
    const t = window.setInterval(odswiez, 10_000);
    document.addEventListener('visibilitychange', odswiez);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', odswiez); };
  }, [zywy, meczId]);

  // Co dalej na tej arenie — pytanie, które prowadzący zadaje sobie w sekundzie
  // po ostatnim gwizdku. Dotąd wracał na listę meczów i szukał wzrokiem.
  const rozstrzygniety = mecz?.status === 'zakonczony' || mecz?.status === 'walkower';
  useEffect(() => {
    if (!rozstrzygniety || !mecz?.arenaId || !prowadzi) { setNastepnyNaArenie(null); return; }
    let aktualne = true;
    getMecze(id)
      .then((lista) => {
        if (!aktualne) return;
        // „Następny" znaczy PO tym meczu w terminarzu, nie najwcześniejszy
        // bez wyniku: przy wpisywaniu poza kolejnością (najpierw cała grupa A)
        // karta cofała organizatora z M20 13:14 do M2 08:44.
        const naArenie = lista
          .filter((m) => m.arenaId === mecz.arenaId && m.id !== mecz.id && m.status === 'zaplanowany')
          .sort(porownajTermin);
        const pozniejszy = naArenie.find((m) => porownajTermin(m, mecz) > 0);
        setNastepnyNaArenie(pozniejszy ?? naArenie[0] ?? null);
        setNastepnyZalegly(!pozniejszy && naArenie.length > 0);
      })
      .catch(() => undefined);
    return () => { aktualne = false; };
  }, [rozstrzygniety, mecz?.arenaId, mecz?.id, prowadzi, id]);

  if (ladowanie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (notFound || !mecz) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <div className="flex-1 py-24 text-center">
          <p className="font-medium text-ink">Nie znaleziono meczu</p>
          <Link prefetch={false} href={`/turnieje/${id}`} className="mt-2 inline-block text-sm text-primary-600">Wróć do turnieju</Link>
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
  // Turniej na zapisach zaczyna się sam przy pierwszym meczu (190,
  // 2026-11-27): prowadzący może zacząć mecz od razu, a okno pyta, czy
  // rozpocząć turniej. Godzina meczu w terminarzu NIE jest sprawdzana: kolejność i tempo gry
  // ustala organizator na boisku (decyzja właściciela z 2026-11-08).
  const turniejTrwa = turniej?.status === 'trwa';
  // Po „Popraw wynik" mecz wraca do planu także w turnieju już zakończonym,
  // więc formularz wyniku musi się wtedy pokazać, inaczej poprawka utknęłaby
  // w połowie.
  const turniejPrzedStartem = turniej?.status === 'zapisy' || turniej?.status === 'zamkniete_zapisy';
  const mozeZaczac = mecz.status === 'zaplanowany' && obieDruzynyZnane
    && (turniejTrwa || turniej?.status === 'zakonczony' || turniejPrzedStartem);
  const mozePoprawic = prowadzi && (mecz.status === 'zakonczony' || mecz.status === 'walkower')
    && !czyWolnyLos(mecz);
  const wszyscyZawodnicy = [...(druzynaA?.zawodnicy ?? []), ...(druzynaB?.zawodnicy ?? [])];
  const skladDruzyny = (druzynaId: string) =>
    (druzynaId === mecz.druzynaAId ? druzynaA?.zawodnicy : druzynaB?.zawodnicy) ?? [];
  const nazwaDruzyny = (druzynaId: string) =>
    (druzynaId === mecz.druzynaAId ? druzynaA?.nazwa : druzynaB?.nazwa) ?? 'drużyna';
  /** Następny mecz na arenie gra INNYMI drużynami niż ten — nazwa musi przyjść
   *  z pełnej listy, nie z dwóch drużyn tego meczu. */
  /** „Zwycięzca A" zamiast „TBD", dopóki grupa się nie rozstrzygnie (175). */
  const slotZGrupy = (strona: 'a' | 'b') => {
    const grupaId = strona === 'a' ? mecz.zrodloAGrupaId : mecz.zrodloBGrupaId;
    const miejsce = strona === 'a' ? mecz.zrodloAMiejsce : mecz.zrodloBMiejsce;
    const nazwa = grupaId ? grupyPoId.get(grupaId)?.nazwa : undefined;
    return nazwa && miejsce ? nazwaMiejscaWGrupie(nazwa, miejsce) : 'TBD';
  };
  const nazwaDruzynyZListy = (druzynaId?: string) =>
    (druzynaId ? druzyny.find((d) => d.id === druzynaId)?.nazwa : undefined) ?? 'TBD';

  // `tik` jest tu po to, żeby zegar przerysował się co sekundę — wartość
  // nieużywana wprost, liczy się sam fakt zmiany stanu.
  void tik;
  // ZEGAR STEROWANY RĘCZNIE (182, 2026-11-22): start, pauza, koniec połowy.
  const faza = fazaZegara(mecz);
  const czas = formatZegara(sekundyPolowy(mecz, new Date()));
  const polowaMin = Math.round((turniej?.czasMeczuMin ?? 0) / 2);
  const meczPucharowy = mecz.faza !== 'grupa' && mecz.faza !== 'liga';
  const minalCzas = poCzasiePolowy(mecz, new Date(), turniej?.czasMeczuMin ?? 0);
  const zmienZegar = async (z: ZmianaZegara) => {
    setMecz((m) => (m ? { ...m, zegarOd: z.zegarOd ?? undefined, zegarSekundy: z.zegarSekundy, polowa: z.polowa } : m));
    try { await updateMecz(meczId, z); }
    catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać zegara', 'error');
      await wczytaj();
    }
  };
  const doKoncaMeczu = () => {
    setPokazZakoncz(true);
    window.setTimeout(() => document.getElementById('koniec-meczu')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

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
  const minutaTeraz = (): number | undefined =>
    mecz ? minutaMeczu(mecz, new Date(), turniej?.czasMeczuMin ?? 0) : undefined;

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
    setArkusz({ druzynaId, typ, wartosc });
  };

  const przeciwnik = (druzynaId: string): string | undefined =>
    druzynaId === mecz?.druzynaAId ? mecz?.druzynaBId : druzynaId === mecz?.druzynaBId ? mecz?.druzynaAId : undefined;

  const odpowiedzArkusza = (zawodnikId: string | undefined) => {
    if (!arkusz) return;
    // Bez pytania o asystę: asysty wypadły z modułu (decyzja właściciela
    // z 2026-11-08). Jedno pytanie mniej to sekunda na boisku.
    setArkusz(null);
    if (arkusz.zdarzenieId) {
      void zmienStrzelcaAkcja(arkusz.zdarzenieId, zawodnikId ?? null);
      return;
    }
    void dodajZdarzenieAkcja(arkusz.druzynaId, arkusz.typ, zawodnikId, undefined, arkusz.wartosc);
  };

  /** STRZELEC PO FAKCIE (194, 2026-11-28): w trwającym i rozegranym meczu.
   *  Zmienia tylko zawodnika, wynik zostaje. */
  const zmienStrzelcaAkcja = async (zdarzenieId: string, zawodnikId: string | null) => {
    const poprzednie = zdarzenia;
    setZdarzenia((lista) => lista.map((z) => (z.id === zdarzenieId ? { ...z, zawodnikId: zawodnikId ?? undefined } : z)));
    try {
      await ustawStrzelca(zdarzenieId, zawodnikId);
      toast(zawodnikId ? 'Strzelec zapisany' : 'Zapisano bez strzelca');
    } catch (e) {
      setZdarzenia(poprzednie);
      toast(e instanceof Error ? e.message : 'Nie udało się zmienić strzelca', 'error');
    }
  };

  /** Dopisanie zawodnika spoza składu prosto z arkusza (194). */
  const dopiszZawodnikaAkcja = async (druzynaId: string, imie: string): Promise<string> => {
    try {
      const noweId = await dopiszZawodnikaWMeczu(meczId, druzynaId, imie);
      await wczytaj();
      return noweId;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się dopisać zawodnika', 'error');
      throw e;
    }
  };

  const walkowerAkcja = async (zwyciezcaId: string, nazwaZwyciezcy: string) => {
    setMenuOtwarte(false);
    const wynik = await potwierdz({
      tytul: 'Walkower?',
      konsekwencje: [
        `${nazwaZwyciezcy} wygrywa bez gry`,
        'Wynik zostaje 0:0, a drużyna dostaje trzy punkty',
        'Pomyłkę cofniesz przyciskiem „Popraw wynik”',
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

  /** Pierwszy mecz rusza turniej (190): pytamy, zanim to się stanie. */
  const zgodaNaStartTurnieju = async (): Promise<boolean> => {
    if (!turniejPrzedStartem) return true;
    const wynik = await potwierdz({
      tytul: 'Rozpocząć turniej?',
      konsekwencje: [
        'To pierwszy mecz, więc turniej przejdzie w „w trakcie”',
        'Zapisy zostaną zamknięte',
        'Zawodnicy z kontami dostaną powiadomienie przed swoim kolejnym meczem',
      ],
      potwierdzLabel: 'Rozpocznij turniej',
    });
    return wynik === 'tak';
  };

  const rozpocznijAkcja = async () => {
    if (!(await zgodaNaStartTurnieju())) return;
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
  const wpisWymagaKarnych = wymaganeKarne(mecz.faza, wpisA, wpisB);
  const jednostkaWyniku = setowy ? 'Wygrane sety' : koszykowka ? 'Punkty' : 'Gole';

  // Strzelców pytamy tylko w sportach z golami i tylko, gdy jest kogo wskazać.
  const strzelcyMozliwi = !setowy && !koszykowka
    && ((druzynaA?.zawodnicy?.length ?? 0) > 0 || (druzynaB?.zawodnicy?.length ?? 0) > 0);
  const ustawWpis = (strona: 'a' | 'b', wartosc: number) => {
    const n = Math.max(0, Math.min(99, Math.floor(wartosc) || 0));
    (strona === 'a' ? setWpisA : setWpisB)(n);
    // Mniej goli niż wskazanych strzelców: obcinamy od końca listy.
    setStrzelcyWpis((st) => ({ ...st, [strona]: st[strona].slice(0, n) }));
  };

  const zapiszWynikAkcja = async () => {
    if (wpisWymagaKarnych && karneA === karneB) {
      toast('Remis w tej fazie musi mieć rozstrzygnięcie: wpisz różne wyniki karnych', 'error');
      return;
    }
    // Pytanie z prośby właściciela: „na pewno chcesz wpisać wynik bez wpisania
    // wszystkich strzelców?". Raz, przy zapisie, nie przy każdym golu.
    const bezStrzelca = strzelcyMozliwi
      ? Math.max(0, wpisA - strzelcyWpis.a.length) + Math.max(0, wpisB - strzelcyWpis.b.length)
      : 0;
    if (bezStrzelca > 0) {
      const wynik = await potwierdz({
        tytul: 'Zapisać wynik bez wszystkich strzelców?',
        konsekwencje: [
          `${withCount(bezStrzelca, 'gol zostanie', 'gole zostaną', 'goli zostanie')} bez strzelca`,
          'Takie gole liczą się do wyniku, ale nie do klasyfikacji strzelców',
        ],
        potwierdzLabel: 'Zapisz wynik',
      });
      if (wynik !== 'tak') return;
    }
    if (!poprawia && !(await zgodaNaStartTurnieju())) return;
    setZapisujeWynik(true);
    try {
      const wynik = {
        wynikA: wpisA,
        wynikB: wpisB,
        karneA: wpisWymagaKarnych ? karneA : undefined,
        karneB: wpisWymagaKarnych ? karneB : undefined,
      };
      // Poprawa: stary wynik znika dopiero tutaj, tuż przed zapisem nowego.
      if (poprawia) await cofnijWynikMeczu(meczId);
      const saStrzelcy = strzelcyWpis.a.length + strzelcyWpis.b.length > 0;
      if (saStrzelcy && mecz?.druzynaAId && mecz.druzynaBId) {
        await wpiszWynikZeStrzelcami(meczId, { a: mecz.druzynaAId, b: mecz.druzynaBId }, wynik, strzelcyWpis);
      } else {
        await wpiszWynikMeczu(meczId, wynik);
      }
      setPoprawia(false);
      await wczytaj();
      toast(poprawia ? 'Wynik poprawiony' : 'Wynik zapisany');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać wyniku', 'error');
    } finally {
      setZapisujeWynik(false);
    }
  };

  // POPRAW WYNIK (Luboń, 2026-11-18). Do tej pory pomyłka w wyniku była
  // nieodwracalna, a na turnieju z jednym boiskiem i 33 meczami ktoś w końcu
  // wpisze 2:1 zamiast 1:2. Baza (`cofnij_wynik_meczu()`, migracja 175)
  // otwiera mecz od nowa i cofa drużynę z kolejnej rundy albo grupy
  // finałowej; odmawia, gdy tamten mecz już się zaczął. Nowy wynik idzie
  // tą samą drogą co pierwszy, więc tabela i drabinka liczą się same.
  // POPRAWA WYNIKU BEZ ZEROWANIA (2026-11-27, test przed turniejem: „resetuje
  // wynik od razu po kliknięciu zamiast poprawić”). Formularz startuje z
  // obecnym wynikiem i strzelcami; mecz zostaje nietknięty, dopóki prowadzący
  // nie zapisze nowego wyniku (`zapiszWynikAkcja` cofa stary tuż przed zapisem).
  // RESET MECZU (193, dzień turnieju 2026-11-28): zły mecz wystartowany albo
  // gole nabite nie tej drużynie. Mecz wraca do „zaplanowany”, 0:0, bez
  // zdarzeń, i da się go odpalić od nowa. W trakcie i po meczu.
  const resetujAkcja = async () => {
    const wynik = await potwierdz({
      tytul: `Zresetować M${mecz.numer}?`,
      konsekwencje: [
        'Gole, kartki, wynik i zegar znikną',
        'Mecz wróci do listy „do rozegrania” i odpalisz go od nowa',
        'Tego nie da się cofnąć',
      ],
      potwierdzLabel: 'Resetuj mecz',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try {
      await resetujMecz(meczId);
      setPoprawia(false);
      setPokazZakoncz(false);
      await wczytaj();
      toast(`M${mecz.numer} zresetowany`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zresetować meczu', 'error');
    }
  };

  const poprawWynikAkcja = () => {
    if (!mecz) return;
    const strzelcy = (druzynaId?: string) => zdarzenia
      .filter((z) => z.typ === 'gol' && z.druzynaId === druzynaId && z.zawodnikId)
      .map((z) => z.zawodnikId!);
    setWpisA(mecz.wynikA);
    setWpisB(mecz.wynikB);
    setKarneA(mecz.karneA ?? 0);
    setKarneB(mecz.karneB ?? 0);
    setStrzelcyWpis({ a: strzelcy(mecz.druzynaAId), b: strzelcy(mecz.druzynaBId) });
    setPoprawia(true);
    window.setTimeout(() => document.getElementById('wynik-koncowy')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };


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
      <Header showMobileWordmark />
      {/* STAŁA RAMKA (2026-11-25): ten sam nagłówek i zakładki co na stronie
          turnieju; zaznaczone „Mecze”, a „‹ Mecze” wraca do listy. */}
      {turniej && (
        <RamkaTurnieju
          turniej={turniej}
          adres={adresTurnieju}
          // Prowadzący przychodzi z „Prowadź” i tam ma wrócić (2026-11-27,
          // test: „klikam mecz, żeby go prowadzić, a przenosi mnie do Mecze”).
          aktywna={prowadzi ? 'prowadz' : 'mecze'}
          // Prowadzący nie dostaje „‹ Prowadź” (2026-11-27): zakładka
          // „Prowadź” jest zaznaczona w ramce tuż nad, a linia zabierała
          // miejsce na ekranie prowadzenia.
          powrot={prowadzi ? undefined : { etykieta: 'Mecze', href: `/turnieje/${adresTurnieju}?tab=mecze` }}
          // Na meczu nagłówek nie jedzie za ekranem: na telefonie zabierał
          // miejsce, w którym prowadzący ma mieć gole, kartki i zegar.
          przyklejona={false}
          akcje={<>
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
                <div className="absolute right-0 top-11 z-30 w-60 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
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
          </>}
        />
      )}

      {/* ZBITY EKRAN PROWADZENIA (2026-11-27, uwaga właściciela: „żeby było
          na jednym ekranie”): numer i faza meczu w karcie wyniku zamiast
          osobnego nagłówka, zegar w dwóch liniach, mniejsze odstępy. */}
      <main className={`mx-auto w-full ${SZEROKOSC_TURNIEJU} flex-1 px-4 py-3`}>
        <div className="space-y-3 lg:mx-auto lg:max-w-2xl">
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.ton}`}>{status.label}</span>
              <h1 className="truncate text-sm font-semibold text-ink">
                M{mecz.numer} · {etykietaFazyMeczu(mecz, grupyPoId)}
              </h1>
            </div>
            {(mecz.zaplanowanyAt || arena) && (
              <div className="flex shrink-0 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                {/* Termin obok boiska: przed startem było widać samo „Boisko 1"
                    (audyt 5, N9). */}
                {mecz.zaplanowanyAt && mecz.status === 'zaplanowany' && (
                  <span>{etykietaTerminuMeczu(mecz.zaplanowanyAt)}</span>
                )}
                {arena && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {arena.nazwa}</span>}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            {/* Nazwy drużyn prowadzą do ich kart (skład, wyniki), także
                w trakcie prowadzenia meczu (prośba właściciela 2026-11-27). */}
            {druzynaA ? (
              <Link prefetch={false} href={`/turnieje/${id}/druzyna/${druzynaA.id}`} className="min-w-0 flex-1 line-clamp-2 break-words text-lg font-semibold leading-6 text-ink underline-offset-2 hover:underline sm:text-2xl">
                {druzynaA.nazwa}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 line-clamp-2 break-words text-lg font-semibold leading-6 text-ink sm:text-2xl">{slotZGrupy('a')}</span>
            )}
            {/* Przed pierwszym gwizdkiem „0:0" wyglądało jak wynik (audyt 6). */}
            {mecz.status === 'zaplanowany' ? (
              <span className="shrink-0 text-sm font-medium text-slate-400">vs</span>
            ) : (
              <span className="shrink-0 font-mono text-3xl font-bold text-ink">{mecz.wynikA}:{mecz.wynikB}</span>
            )}
            {druzynaB ? (
              <Link prefetch={false} href={`/turnieje/${id}/druzyna/${druzynaB.id}`} className="min-w-0 flex-1 line-clamp-2 break-words text-right text-lg font-semibold leading-6 text-ink underline-offset-2 hover:underline sm:text-2xl">
                {druzynaB.nazwa}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 line-clamp-2 break-words text-right text-lg font-semibold leading-6 text-ink sm:text-2xl">{slotZGrupy('b')}</span>
            )}
          </div>
          {/* ZEGAR MECZU (182): rusza dopiero po „Start” prowadzącego, ma pauzę
              i dwie połowy. Stan w bazie, więc odświeżenie strony i inne
              ekrany (hala, panel) pokazują ten sam czas. */}
          {trwajacy && !setowy && (
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {faza === 'przerwa' ? 'Przerwa po 1. połowie' : faza === 'czeka' ? 'Przed pierwszym gwizdkiem' : `${mecz.polowa ?? 1}. połowa${faza === 'pauza' ? ' · pauza' : ''}`}
                {polowaMin > 0 && faza !== 'przerwa' && (
                  <span className={`font-normal normal-case tracking-normal ${minalCzas ? 'text-amber-600' : 'text-slate-400'}`}>
                    {' · '}{minalCzas ? `minęło ${polowaMin} min` : `${polowaMin} min`}
                  </span>
                )}
              </p>
              {faza !== 'przerwa' && (
                <p className={`inline-flex items-center gap-1.5 font-mono text-3xl font-bold leading-tight ${minalCzas ? 'text-amber-600' : faza === 'gra' ? 'text-ink' : 'text-slate-400'}`}>
                  <Timer className="h-5 w-5" /> {czas}
                </p>
              )}
              {prowadzi && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {faza === 'czeka' && (
                    <Button onClick={() => zmienZegar(startZegara(mecz, new Date()))} className="col-span-2 min-h-[48px]">Start</Button>
                  )}
                  {faza === 'gra' && (
                    <Button variant="outline" onClick={() => zmienZegar(pauzaZegara(mecz, new Date()))} className="min-h-[48px]">Pauza</Button>
                  )}
                  {faza === 'pauza' && (
                    <Button onClick={() => zmienZegar(startZegara(mecz, new Date()))} className="min-h-[48px]">Wznów</Button>
                  )}
                  {(faza === 'gra' || faza === 'pauza') && ((mecz.polowa ?? 1) === 1 ? (
                    <Button variant="outline" onClick={() => zmienZegar(koniecPolowy())} className="min-h-[48px]">Koniec połowy</Button>
                  ) : (
                    <Button variant="outline" onClick={() => { void zmienZegar(pauzaZegara(mecz, new Date())); doKoncaMeczu(); }} className="min-h-[48px]">Koniec meczu</Button>
                  ))}
                  {faza === 'przerwa' && (
                    <Button onClick={() => zmienZegar(startZegara(mecz, new Date()))} className="col-span-2 min-h-[48px]">Start 2. połowy</Button>
                  )}
                </div>
              )}
            </div>
          )}
          {mecz.karneA !== undefined && mecz.karneB !== undefined && (
            <p className="text-center text-xs text-slate-400">Karne: {mecz.karneA}:{mecz.karneB}</p>
          )}
          {!obieDruzynyZnane && (
            <p className="text-center text-xs text-slate-400">
              {/* Konkretnie na kogo, nie „na obie”, gdy jedna już jest (F7). */}
              {!mecz.druzynaAId && !mecz.druzynaBId
                ? 'Ten mecz czeka jeszcze na obie drużyny.'
                : (() => {
                    const brak = slotZGrupy(!mecz.druzynaAId ? 'a' : 'b');
                    return brak === 'TBD' ? 'Czekamy jeszcze na drugą drużynę.' : `Czekamy na: ${brak}.`;
                  })()}
            </p>
          )}
        </div>


        {/* PROWADZENIE NA ŻYWO NA GÓRZE, Z OPISEM (sugestia Jana, 2026-11-22).
            Przycisk stał pod formularzem wyniku i nie mówił, co się stanie po
            kliknięciu: był „lekki opór, żeby kliknąć”. Teraz karta mówi
            hasłami, co tam jest, a szybki wynik zostaje pod nią jako druga
            droga („albo”). */}
        {prowadzi && mozeZaczac && (
          <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-4 dark:border-primary-900 dark:bg-primary-950/30">
            <p className="text-sm font-semibold text-ink">Prowadź mecz na żywo</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              {setowy
                ? 'Punkty w setach na bieżąco · kibice widzą wynik od razu · tabela liczy się sama'
                : 'Zegar meczu · gol jednym dotknięciem · strzelcy i kartki · kibice widzą wynik od razu'}
            </p>
            <Button onClick={rozpocznijAkcja} className="mt-3 w-full">
              Zacznij mecz teraz
            </Button>
          </div>
        )}
        {prowadzi && mozeZaczac && (
          <p className="text-center text-xs font-medium uppercase tracking-wide text-slate-400">albo, gdy mecz już się skończył</p>
        )}

        {/* WYNIK KOŃCOWY JEDNYM RUCHEM. Główna ścieżka prowadzącego: po meczu
            wpisuje „3:1" i gotowe. Gole ze strzelcami to opcja dla chętnych,
            pod przyciskiem niżej, bo przy kilku boiskach naraz nikt nie stoi
            z telefonem przy każdej bramce. */}
        {prowadzi && (mozeZaczac || poprawia) && (
          <div id="wynik-koncowy" className={`scroll-mt-40 rounded-xl border p-4 space-y-4 ${poprawia
            ? 'border-primary-300 bg-white dark:border-primary-700 dark:bg-slate-800'
            : 'border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
            <p className="text-sm font-semibold text-ink">{poprawia ? 'Popraw wynik' : 'Wpisz wynik końcowy'}</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['a', druzynaA?.nazwa, wpisA],
                ['b', druzynaB?.nazwa, wpisB],
              ] as const).map(([strona, nazwa, wartosc]) => (
                <div key={strona} className="flex flex-col items-center gap-2">
                  <span className="line-clamp-2 min-h-[2.5rem] text-center text-sm font-medium text-ink">{nazwa ?? 'TBD'}</span>
                  {/* Liczbę da się WPISAĆ, nie tylko wyklikać (2026-11-08):
                      przy 7:5 stukanie plusa dwanaście razy to strata czasu. */}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    value={wartosc}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => ustawWpis(strona, Number(e.target.value))}
                    aria-label={`${jednostkaWyniku}, ${nazwa ?? 'drużyna'}`}
                    className="w-20 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent py-1 text-center font-mono text-4xl font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => ustawWpis(strona, wartosc - 1)}
                      aria-label={`Odejmij, ${nazwa ?? 'drużyna'}`}
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 active:bg-slate-200"
                    ><Minus className="h-5 w-5" /></button>
                    <button
                      onClick={() => ustawWpis(strona, wartosc + 1)}
                      aria-label={`Dodaj, ${nazwa ?? 'drużyna'}`}
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 active:bg-primary-100"
                    ><Plus className="h-5 w-5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400">{jednostkaWyniku}</p>
            {/* STRZELCY OPCJONALNIE. Wskazani zapisują się jako gole ze
                strzelcem, reszta jako gole bez strzelca (`goleZWyniku()`),
                więc wynik zawsze równa się sumie goli w historii meczu. */}
            {strzelcyMozliwi && wpisA + wpisB > 0 && (
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                <p className="text-sm font-medium text-ink">Strzelcy <span className="font-normal text-slate-400">(opcjonalnie)</span></p>
                {([
                  ['a', druzynaA, wpisA],
                  ['b', druzynaB, wpisB],
                ] as const).map(([strona, druzyna, gole]) => {
                  if (!druzyna || gole === 0) return null;
                  const wybrani = strzelcyWpis[strona];
                  const sklad = druzyna.zawodnicy ?? [];
                  return (
                    <div key={strona}>
                      <p className="text-xs text-slate-500">
                        {druzyna.nazwa}: {wybrani.length} z {gole}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {wybrani.map((zid, i) => (
                          <button
                            key={`${zid}-${i}`}
                            onClick={() => setStrzelcyWpis((st) => ({ ...st, [strona]: st[strona].filter((_, k) => k !== i) }))}
                            className="rounded-full bg-primary-50 dark:bg-primary-950 px-2.5 py-1 text-xs font-medium text-primary-700 dark:text-primary-300"
                            aria-label={`Usuń strzelca ${sklad.find((z) => z.id === zid)?.imie ?? ''}`}
                          >
                            ⚽ {sklad.find((z) => z.id === zid)?.imie ?? 'zawodnik'} ×
                          </button>
                        ))}
                        {wybrani.length < gole && sklad.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              const zid = e.target.value;
                              if (zid) setStrzelcyWpis((st) => ({ ...st, [strona]: [...st[strona], zid] }));
                            }}
                            aria-label={`Dodaj strzelca, ${druzyna.nazwa}`}
                            className="rounded-full border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs dark:bg-slate-700 dark:text-slate-100"
                          >
                            <option value="">+ strzelec</option>
                            {sklad.map((z) => <option key={z.id} value={z.id}>{z.imie}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {wpisWymagaKarnych && (
              <div>
                <p className="text-sm font-medium text-ink">Remis: potrzebny wynik karnych</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <input type="number" min={0} inputMode="numeric" value={karneA} onChange={(e) => setKarneA(Number(e.target.value) || 0)}
                    aria-label={`Karne, ${druzynaA?.nazwa ?? 'drużyna A'}`}
                    className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-100" />
                  <span className="text-slate-400">:</span>
                  <input type="number" min={0} inputMode="numeric" value={karneB} onChange={(e) => setKarneB(Number(e.target.value) || 0)}
                    aria-label={`Karne, ${druzynaB?.nazwa ?? 'drużyna B'}`}
                    className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-100" />
                </div>
              </div>
            )}
            <Button onClick={zapiszWynikAkcja} disabled={zapisujeWynik} className="w-full">
              {poprawia ? `Zapisz poprawiony wynik ${wpisA}:${wpisB}` : `Zapisz wynik ${wpisA}:${wpisB}`}
            </Button>
            {poprawia ? (
              <Button variant="outline" onClick={() => setPoprawia(false)} disabled={zapisujeWynik} className="w-full">
                Anuluj, zostaw {mecz.wynikA}:{mecz.wynikB}
              </Button>
            ) : (
              <p className="text-xs text-slate-400">
                {meczPucharowy ? 'Zwycięzca przejdzie do kolejnej rundy. ' : ''}Pomyłkę poprawisz później przyciskiem „Popraw wynik”.
              </p>
            )}
          </div>
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
                      // Niższy przycisk (2026-11-27): kartki i „Cofnij” mają
                      // się zmieścić na jednym ekranie telefonu z zegarem.
                      className="flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 rounded-2xl bg-primary-50 dark:bg-primary-950 px-2 py-2 active:bg-primary-100 dark:active:bg-primary-900"
                    >
                      {/* Plus mówi „dodaj” (prośba właściciela 2026-11-22):
                          samo „GOL” czytało się jak etykieta, nie przycisk. */}
                      <span className="text-base font-bold text-primary-700 dark:text-primary-300">⚽ + GOL</span>
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
                        className="min-h-[44px] min-w-[56px] rounded-lg bg-amber-50 px-2 text-base font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                      >+ 🟨</button>
                      <button
                        onClick={() => zapytajOZawodnika(druzynaId, 'czerwona')}
                        aria-label={`Czerwona kartka, ${nazwaDruzyny(druzynaId)}`}
                        // Neutralne tło: czerwień w Bojo znaczy „coś poszło źle",
                        // a znaczenie niesie sama ikona kartki (audyt 5, N10).
                        className="min-h-[44px] min-w-[56px] rounded-lg bg-slate-100 px-2 text-base font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                      >+ 🟥</button>
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
                      className="h-11 w-11 rounded-lg bg-slate-100 text-lg font-semibold text-slate-600"
                    >−</button>
                    <button
                      onClick={() => zapiszPunktSetu({ ...aktualnySet, [strona]: aktualnySet[strona] + 1 })}
                      className="h-11 w-11 rounded-lg bg-primary-50 text-lg font-semibold text-primary-700"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={zakonczSetAkcja} className="w-full">Zakończ set</Button>
          </div>
        )}

        {prowadzi && trwajacy && obieDruzynyZnane && (
          <div id="koniec-meczu" className="scroll-mt-24 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
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
                {/* Zawodnik meczu: zwinięty, bo bardzo opcjonalny (2026-11-08). */}
                {wszyscyZawodnicy.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm text-slate-500">Zawodnik meczu (opcjonalnie)</summary>
                    <select
                      value={mvpId}
                      onChange={(e) => setMvpId(e.target.value)}
                      aria-label="Zawodnik meczu"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-100"
                    >
                      <option value="">Bez wskazania</option>
                      {wszyscyZawodnicy.map((z) => <option key={z.id} value={z.id}>{z.imie}</option>)}
                    </select>
                  </details>
                )}
                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  Pomyłkę poprawisz później przyciskiem „Popraw wynik”.
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

        {mozePoprawic && !poprawia && (
          <Button variant="outline" onClick={poprawWynikAkcja} className="w-full">
            Popraw wynik
          </Button>
        )}

        {prowadzi && (trwajacy || mecz.status === 'zakonczony' || mecz.status === 'walkower') && !czyWolnyLos(mecz) && (
          <button
            type="button"
            onClick={resetujAkcja}
            className="w-full min-h-[44px] text-sm font-medium text-slate-500 hover:text-red-600"
          >
            Resetuj mecz (od nowa, 0:0)
          </button>
        )}

        {zdarzenia.length > 0 && !setowy && (
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold text-slate-500">Przebieg meczu</h2>
            {prowadzi && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Dotknij gola albo kartki, żeby dodać lub zmienić zawodnika.</p>
            )}
            {/* PRZEBIEG PO STRONIE DRUŻYNY (2026-11-27, prośba właściciela):
                zdarzenie stoi po stronie drużyny, której dotyczy, jak nazwy
                w karcie wyniku. Gol (i samobój) po stronie drużyny, która
                dostała bramkę; kartka po stronie ukaranej. Minuta na środku,
                ikona przy zewnętrznej krawędzi: po prawej napis, a ikona na
                końcu. Nazwy drużyny w wierszu już nie ma, mówi o niej strona. */}
            {zdarzenia.map((z) => {
              const zDruzynyA = z.druzynaId === mecz.druzynaAId;
              const poLewej = z.typ === 'samobojczy' ? !zDruzynyA : zDruzynyA;
              const zawodnik = wszyscyZawodnicy.find((zw) => zw.id === z.zawodnikId);
              const [ikona, ...nazwaTypu] = ETYKIETA_ZDARZENIA[z.typ].split(' ');
              const tekst = zawodnik
                ? `${zawodnik.imie}${z.typ === 'samobojczy' ? ' (sam.)' : ''}${z.typ === 'punkty' && z.wartosc > 1 ? ` +${z.wartosc}` : ''}`
                : nazwaTypu.join(' ');
              const opis = (
                <span className={`flex min-w-0 items-center gap-2 ${poLewej ? '' : 'justify-end text-right'}`}>
                  {poLewej && <span className="shrink-0" aria-hidden>{ikona}</span>}
                  <span className="min-w-0 truncate">{tekst}</span>
                  {!poLewej && <span className="shrink-0" aria-hidden>{ikona}</span>}
                </span>
              );
              // Prowadzący dotyka wiersza i zmienia albo dopisuje strzelca
              // (194, 2026-11-28), także po meczu. Wynik się nie zmienia.
              const doEdycji = prowadzi && !z.id.startsWith('tymczasowe-');
              const etykieta = `${nazwaTypu.join(' ')}, ${zDruzynyA ? druzynaA?.nazwa : druzynaB?.nazwa}${zawodnik ? `, ${zawodnik.imie}` : ''}`;
              const wnetrze = (
                <>
                  {poLewej ? opis : <span />}
                  <span className="w-8 text-center font-mono text-xs text-slate-400">
                    {z.minuta !== undefined ? `${z.minuta}'` : ''}
                  </span>
                  {poLewej ? <span /> : opis}
                </>
              );
              return doEdycji ? (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setArkusz({ druzynaId: z.druzynaId, typ: z.typ, wartosc: z.wartosc, zdarzenieId: z.id })}
                  aria-label={`${etykieta}. ${zawodnik ? 'Zmień' : 'Dodaj'} ${z.typ === 'zolta' || z.typ === 'czerwona' ? 'zawodnika' : 'strzelca'}`}
                  className="-mx-2 grid min-h-[40px] w-[calc(100%+1rem)] grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg px-2 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {wnetrze}
                </button>
              ) : (
                <div
                  key={z.id}
                  aria-label={etykieta}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                >
                  {wnetrze}
                </div>
              );
            })}
          </div>
        )}
        {/* CO DALEJ NA TEJ ARENIE. Sekunda po ostatnim gwizdku prowadzący
            wracał na listę meczów i szukał kolejnego wzrokiem. Jedno zdanie
            zamienia sześć godzin klikania po terminarzu w kolejkę. */}
        {prowadzi && nastepnyNaArenie && (
          <Link prefetch={false}
            href={`/turnieje/${id}/mecz/${nastepnyNaArenie.id}`}
            className="flex items-center gap-3 rounded-2xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {nastepnyZalegly ? 'Najwcześniejszy mecz bez wyniku' : 'Następny na tym boisku'}
              </p>
              <p className="truncate text-sm font-semibold text-ink">
                {nazwaDruzynyZListy(nastepnyNaArenie.druzynaAId)} – {nazwaDruzynyZListy(nastepnyNaArenie.druzynaBId)}
              </p>
              {nastepnyNaArenie.zaplanowanyAt && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {etykietaTerminuMeczu(nastepnyNaArenie.zaplanowanyAt)}
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-primary-600" />
          </Link>
        )}
        </div>
      </main>

      {arkusz && (
        <ArkuszSkladu
          tytul={TYTUL_ARKUSZA[arkusz.typ]}
          podtytul={nazwaDruzyny(arkusz.druzynaId)}
          zawodnicy={skladDruzyny(arkusz.druzynaId)}
          // „Zapisz bez strzelca”, bez „Nie wiem kto” (decyzja właściciela
          // z 2026-11-21): brak nazwiska to normalny przypadek, nie niewiedza.
          etykietaPominiecia={arkusz.zdarzenieId
            ? (arkusz.typ === 'zolta' || arkusz.typ === 'czerwona' ? 'Bez nazwiska' : 'Bez strzelca')
            : arkusz.typ === 'gol' || arkusz.typ === 'samobojczy' || arkusz.typ === 'punkty'
              ? 'Zapisz bez strzelca' : 'Zapisz bez nazwiska'}
          onDopisz={(imie) => dopiszZawodnikaAkcja(arkusz.druzynaId, imie)}
          // SAMOBÓJ POD GOLEM (2026-11-21): gol drużyny X padł z samobója
          // rywala. Osobny przycisk „Samobójczy” stał przy kartkach i nie było
          // jasne, czyj to gol. Teraz: „GOL” drużyny X → „Samobój” → skład
          // RYWALA. Zdarzenie dostaje drużynę strzelającego, a wyzwalacz z 147
          // liczy je drużynie przeciwnej.
          akcjaDodatkowa={!arkusz.zdarzenieId && arkusz.typ === 'gol' && przeciwnik(arkusz.druzynaId) ? {
            etykieta: 'Samobój',
            onClick: () => setArkusz({ druzynaId: przeciwnik(arkusz.druzynaId)!, typ: 'samobojczy', wartosc: 1 }),
          } : undefined}
          onWybor={odpowiedzArkusza}
          onZamknij={() => {
            // Zamknięcie arkusza anuluje zdarzenie (prowadzący pomylił drużynę).
            setArkusz(null);
          }}
        />
      )}
      {oknoPotwierdzenia}
    </div>
  );
}
