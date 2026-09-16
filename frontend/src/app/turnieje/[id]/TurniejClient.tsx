'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowLeft, CalendarDays, MapPin, Users, Navigation, Settings, Share2, ChevronDown } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import {
  getTurniej, uprawnieniaTurnieju, getMojaOsobe, przyjmujeZgloszenia,
  getOgloszenia, dodajOgloszenie, usunOgloszenie, getBlikTurnieju,
} from '@/lib/turnieje';
import { getDruzyny, getDruzynyZeSkladem, getMojaDruzyne, zamienDruzyneWEkipe } from '@/lib/turniejDruzyny';
import { getMecze, getAreny, getGrupy, getZdarzeniaTurnieju } from '@/lib/turniejMecze';
import { STATUS_TURNIEJU } from '@/lib/turniejEtykiety';
import { obliczTabele, posortujTabele, opisAwansu } from '@/lib/turniejTabela';
import { obliczKlasyfikacje, posortujKlasyfikacje } from '@/lib/turniejStatystyki';
import { linkDoTurnieju, udostepnijTurniej } from '@/lib/turniejShare';
import { linkDojazdu } from '@/lib/utils';
import { sportEmoji } from '@/lib/sports';
import KartaMeczu from '@/components/turnieje/KartaMeczu';
import TabelaGrupy from '@/components/turnieje/TabelaGrupy';
import Drabinka from '@/components/turnieje/Drabinka';
import Klasyfikacja from '@/components/turnieje/Klasyfikacja';
import Ogloszenia from '@/components/turnieje/Ogloszenia';
import KartaDruzyny from '@/components/turnieje/KartaDruzyny';
import SciankaLogowania from '@/components/turnieje/SciankaLogowania';
import type { Turniej, TurniejDruzyna, TurniejOsoba, TurniejMecz, TurniejArena, TurniejGrupa, TurniejZdarzenie, TurniejOgloszenie } from '@/types';

// Sześć zakładek zamiast czterech. „Terminarz" i „Wyniki" dzieliły wcześniej
// ten sam zbiór meczów, a tabela i drabinka siedziały razem w „Wynikach" —
// czyli jedna zakładka odpowiadała na trzy różne pytania naraz („kiedy gramy",
// „jak poszło", „kto awansuje"). Dziś każde ma swoje miejsce, a zakładki bez
// treści (tabela bez grup, drabinka bez fazy pucharowej) w ogóle się nie
// pokazują — pusta zakładka jest gorsza niż jej brak.
type Zakladka = 'info' | 'druzyny' | 'terminarz' | 'wyniki' | 'tabela' | 'drabinka';

const ETYKIETY_ZAKLADEK: Record<Zakladka, string> = {
  info: 'Info',
  druzyny: 'Drużyny',
  terminarz: 'Terminarz',
  wyniki: 'Wyniki',
  tabela: 'Tabela',
  drabinka: 'Drabinka',
};

/** Rozegrane mecze jednej grupy, zwinięte pod jej tabelą. */
function MeczeGrupy({
  mecze, druzynyPoId, meczePoId, arenyPoId, onKlikMeczu,
}: {
  mecze: TurniejMecz[];
  druzynyPoId: Map<string, string>;
  meczePoId: Map<string, TurniejMecz>;
  arenyPoId: Map<string, string>;
  onKlikMeczu: (meczId: string) => void;
}) {
  const [rozwiniete, setRozwiniete] = useState(false);
  if (mecze.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setRozwiniete((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600"
        aria-expanded={rozwiniete}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${rozwiniete ? 'rotate-180' : ''}`} />
        {rozwiniete ? 'Zwiń wyniki' : `Pokaż wyniki (${mecze.length})`}
      </button>
      {rozwiniete && (
        <div className="mt-2 space-y-2">
          {mecze.map((m) => (
            <KartaMeczu
              key={m.id}
              mecz={m}
              druzynyPoId={druzynyPoId}
              meczePoId={meczePoId}
              arenyPoId={arenyPoId}
              onClick={() => onKlikMeczu(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TurniejClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();

  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [osoba, setOsoba] = useState<TurniejOsoba | null>(null);
  const [mecze, setMecze] = useState<TurniejMecz[]>([]);
  const [areny, setAreny] = useState<TurniejArena[]>([]);
  const [grupy, setGrupy] = useState<TurniejGrupa[]>([]);
  const [zdarzenia, setZdarzenia] = useState<TurniejZdarzenie[]>([]);
  const [ogloszenia, setOgloszenia] = useState<TurniejOgloszenie[]>([]);
  const [mojaDruzyna, setMojaDruzyna] = useState<TurniejDruzyna | null>(null);
  const [blikTelefon, setBlikTelefon] = useState<string | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const tabParam = searchParams.get('tab');
  const zakladka: Zakladka =
    tabParam === 'druzyny' || tabParam === 'terminarz' || tabParam === 'wyniki'
      || tabParam === 'tabela' || tabParam === 'drabinka'
      ? tabParam
      : 'info';

  useEffect(() => {
    let aktualne = true;
    setLadowanie(true);
    getTurniej(id)
      .then(async (t) => {
        if (!aktualne) return;
        if (!t) { setNotFound(true); setLadowanie(false); return; }
        setTurniej(t);
        const [d, o, m, a, g, z, og, mj] = await Promise.all([
          user ? getDruzynyZeSkladem(id) : getDruzyny(id),
          user ? getMojaOsobe(id, user.id) : Promise.resolve(null),
          getMecze(id),
          getAreny(id),
          getGrupy(id),
          getZdarzeniaTurnieju(id),
          getOgloszenia(id),
          user ? getMojaDruzyne(id, user.id) : Promise.resolve(null),
        ]);
        if (!aktualne) return;
        setDruzyny(d);
        setOsoba(o);
        setMecze(m);
        setAreny(a);
        setGrupy(g);
        setZdarzenia(z);
        setOgloszenia(og);
        setMojaDruzyna(mj);
        // BLIK: tylko organizator/zarządzający i kapitanowie mają RLS-owe
        // prawo do wiersza — reszta po prostu nie dostanie nic, więc wołanie
        // „na wszelki wypadek" jest bezpieczne i nie wymaga sprawdzania roli
        // z wyprzedzeniem.
        if (t.wpisoweGrosze > 0 && user) {
          getBlikTurnieju(id).then((tel) => { if (aktualne) setBlikTelefon(tel); }).catch(() => {});
        }
      })
      .catch(() => { if (aktualne) setNotFound(true); })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [id, user]);

  if (ladowanie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (notFound || !turniej) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center">
          <p className="font-medium text-ink">Nie znaleziono turnieju</p>
          <Link href="/turnieje" className="mt-2 inline-block text-sm text-primary-600">Wróć do listy turniejów</Link>
        </div>
      </div>
    );
  }

  const uprawnienia = uprawnieniaTurnieju(turniej, osoba, user?.id);
  const druzynyPoId = new Map(druzyny.map((d) => [d.id, d.nazwa]));
  const meczePoId = new Map(mecze.map((m) => [m.id, m]));
  const arenyPoId = new Map(areny.map((a) => [a.id, a.nazwa]));
  const status = STATUS_TURNIEJU[turniej.status];

  const meczeGrupowe = mecze.filter((m) => m.faza === 'grupa' || m.faza === 'liga');
  const meczeDrabinki = mecze.filter((m) => m.faza !== 'grupa' && m.faza !== 'liga');

  // Rozegrany = ma wynik, który się już nie zmieni. Mecz TRWAJĄCY nie jest
  // wynikiem, tylko najbliższą rzeczą do obejrzenia, więc ląduje na górze
  // terminarza, nie w wynikach — tak samo liczy go `obliczTabele()`, które
  // bierze wyłącznie `zakonczony` i `walkower`.
  const rozegrany = (m: TurniejMecz) => m.status === 'zakonczony' || m.status === 'walkower';
  const meczePrzyszle = mecze
    .filter((m) => !rozegrany(m))
    .sort((a, b) => (a.status === 'trwa' ? -1 : b.status === 'trwa' ? 1 : a.numer - b.numer));
  const meczeRozegrane = mecze.filter(rozegrany).sort((a, b) => b.numer - a.numer);
  const pozycjeReczne = new Map(
    druzyny.filter((d) => d.pozycjaRecznie !== undefined).map((d) => [d.id, d.pozycjaRecznie!]),
  );
  const opcjeTabeli = { punktyZaWygrana: turniej.punktyZaWygrana, punktyZaRemis: turniej.punktyZaRemis };
  const tabeleGrup: { grupa?: TurniejGrupa; wiersze: ReturnType<typeof posortujTabele> }[] =
    grupy.length > 0
      ? grupy.map((g) => ({
          grupa: g,
          wiersze: posortujTabele(
            obliczTabele(
              meczeGrupowe.filter((m) => m.grupaId === g.id),
              druzyny.filter((d) => d.grupaId === g.id),
              opcjeTabeli,
            ),
            pozycjeReczne,
          ),
        }))
      : meczeGrupowe.length > 0 || turniej.format === 'liga'
        ? [{ grupa: undefined, wiersze: posortujTabele(obliczTabele(meczeGrupowe, druzyny, opcjeTabeli), pozycjeReczne) }]
        : [];

  // Drużyny pogrupowane tak, jak realnie grają. „Bez grupy" zbiera te, których
  // losowanie jeszcze nie dotknęło albo których turniej nie ma grup wcale.
  const sekcjeDruzyn =
    grupy.length > 0
      ? [
          ...grupy.map((g) => ({ tytul: `Grupa ${g.nazwa}`, lista: druzyny.filter((d) => d.grupaId === g.id) })),
          { tytul: 'Bez grupy', lista: druzyny.filter((d) => !d.grupaId) },
        ].filter((sekcja) => sekcja.lista.length > 0)
      : [{ tytul: 'Wszystkie drużyny', lista: druzyny }];

  const legendaAwansu = opisAwansu(
    tabeleGrup.filter((t) => t.grupa).map((t) => t.wiersze.length),
    turniej.awansujeZGrupy,
  );

  const widoczneZakladki: Zakladka[] = [
    'info',
    'druzyny',
    ...(meczePrzyszle.length > 0 ? ['terminarz' as const] : []),
    ...(meczeRozegrane.length > 0 ? ['wyniki' as const] : []),
    ...(tabeleGrup.length > 0 ? ['tabela' as const] : []),
    ...(meczeDrabinki.length > 0 ? ['drabinka' as const] : []),
  ];
  // Wejście z linku na zakładkę, której ten turniej nie ma (np. `?tab=drabinka`
  // przed wygenerowaniem drabinki), pokazuje Info zamiast pustej strony.
  const aktywna: Zakladka = widoczneZakladki.includes(zakladka) ? zakladka : 'info';

  const zawodnicyDoStatystyk = druzyny.flatMap((d) => d.zawodnicy ?? []);
  const mvpPoMeczach = mecze
    .filter((m) => m.status === 'zakonczony' || m.status === 'walkower')
    .map((m) => ({ mvpZawodnikId: m.mvpZawodnikId }));
  const klasyfikacje = obliczKlasyfikacje(zdarzenia, mvpPoMeczach, zawodnicyDoStatystyk, druzynyPoId);
  const strzelcy = posortujKlasyfikacje(klasyfikacje, 'gole');
  const asystenci = posortujKlasyfikacje(klasyfikacje, 'asysty');
  const mvpList = posortujKlasyfikacje(klasyfikacje, 'mvp');
  const dojazd = linkDojazdu({ lat: turniej.lat, lng: turniej.lng, adres: turniej.miejsceAdres });
  let dataLabel = turniej.dataStartu;
  try { dataLabel = format(parseISO(turniej.dataStartu), 'EEEE, d MMMM', { locale: pl }); } catch { /* zostaw surową datę */ }

  const udostepnij = async () => {
    const wynik = await udostepnijTurniej(turniej, linkDoTurnieju(id));
    if (wynik === 'copied') toast('Link skopiowany');
    else if (wynik === 'failed') toast('Nie udało się udostępnić', 'error');
  };

  const dodajOgloszenieAkcja = async (tresc: string) => {
    if (!user) return;
    try {
      await dodajOgloszenie(id, user.id, tresc);
      setOgloszenia(await getOgloszenia(id));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się opublikować ogłoszenia', 'error');
    }
  };

  const usunOgloszenieAkcja = async (ogloszenieId: string) => {
    try {
      await usunOgloszenie(ogloszenieId);
      setOgloszenia((poprzednie) => poprzednie.filter((o) => o.id !== ogloszenieId));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się usunąć ogłoszenia', 'error');
    }
  };

  const zamienWEkipeAkcja = async (d: TurniejDruzyna) => {
    const wynik = await potwierdz({
      tytul: `Zamienić ${d.nazwa} w ekipę?`,
      konsekwencje: [
        'Cały skład z kontem w Bojo dołączy jako członkowie nowej ekipy',
        'Będziesz mógł umawiać z nimi mecze poza turniejami',
      ],
      potwierdzLabel: 'Zamień w ekipę',
    });
    if (wynik !== 'tak') return;
    try {
      const grupaId = await zamienDruzyneWEkipe(d.id);
      toast('Ekipa utworzona');
      router.push(`/grupy/${grupaId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się utworzyć ekipy', 'error');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <div className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/turnieje')} aria-label="Wróć" className="shrink-0 text-slate-500 hover:text-ink">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-ink">{turniej.nazwa}</h1>
          {uprawnienia.mozeEdytowac && (
            <Link href={`/turnieje/${id}/panel`} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Settings className="h-3.5 w-3.5" /> Panel
            </Link>
          )}
        </div>
        <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {widoczneZakladki.map((z) => (
            <button
              key={z}
              onClick={() => router.push(`/turnieje/${id}?tab=${z}`)}
              className={[
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                aktywna === z ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {z === 'druzyny' ? `Drużyny (${druzyny.length})` : ETYKIETY_ZAKLADEK[z]}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5">
        {turniej.status === 'szkic' && uprawnienia.mozeEdytowac && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-sm text-amber-800 dark:text-amber-300">
            Ten turniej jest szkicem — nikt poza Tobą go nie widzi.
          </div>
        )}

        {aktywna === 'info' && (
          <>
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{sportEmoji(turniej.sport)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.ton}`}>{status.label}</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>{dataLabel} · {turniej.godzinaStartu}</span>
              </div>
              {(turniej.miejsceNazwa || turniej.miejsceAdres) && (
                <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    {turniej.miejsceNazwa && <div className="font-medium text-ink">{turniej.miejsceNazwa}</div>}
                    {turniej.miejsceAdres && <div className="text-xs text-slate-400">{turniej.miejsceAdres}</div>}
                  </div>
                </div>
              )}
              {dojazd && (
                <a href={dojazd} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600">
                  <Navigation className="h-4 w-4" /> Nawiguj
                </a>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Users className="h-4 w-4 shrink-0 text-slate-400" />
                <span>{druzyny.length}/{turniej.maxDruzyn} drużyn</span>
                {turniej.wpisoweGrosze > 0 && <span>· {(turniej.wpisoweGrosze / 100).toFixed(0)} zł wpisowe</span>}
              </div>
              {turniej.opis && <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{turniej.opis}</p>}
              {turniej.regulamin && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-ink">Regulamin</summary>
                  <p className="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{turniej.regulamin}</p>
                </details>
              )}
              <button onClick={udostepnij} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600">
                <Share2 className="h-4 w-4" /> Udostępnij
              </button>
            </div>

            {turniej.wpisoweGrosze > 0 && !!mojaDruzyna && mojaDruzyna.kapitanId === user?.id && (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-1.5 text-sm">
                <p className="font-medium text-ink">
                  Wpisowe: {(turniej.wpisoweGrosze / 100).toFixed(0)} zł
                  {mojaDruzyna.wpisoweOplaconeAt ? (
                    <span className="ml-2 text-primary-700">Opłacone ✓</span>
                  ) : (
                    <span className="ml-2 text-slate-400">jeszcze nieopłacone</span>
                  )}
                </p>
                {blikTelefon ? (
                  <p className="text-slate-600 dark:text-slate-300">BLIK: {blikTelefon}</p>
                ) : (
                  <p className="text-slate-400">Organizator jeszcze nie podał numeru BLIK.</p>
                )}
              </div>
            )}

            <Ogloszenia
              ogloszenia={ogloszenia}
              mozeZarzadzac={uprawnienia.mozeEdytowac}
              onDodaj={dodajOgloszenieAkcja}
              onUsun={usunOgloszenieAkcja}
            />

            {przyjmujeZgloszenia(turniej, druzyny.length) && (
              <Link href={`/turnieje/${id}/zglos`}>
                <Button className="w-full">Zgłoś drużynę</Button>
              </Link>
            )}
          </>
        )}

        {aktywna === 'druzyny' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{druzyny.length}/{turniej.maxDruzyn} drużyn</span>
              {przyjmujeZgloszenia(turniej, druzyny.length) && (
                <Link href={`/turnieje/${id}/zglos`} className="text-sm font-medium text-primary-600">+ Zgłoś drużynę</Link>
              )}
            </div>
            {druzyny.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Nikt się jeszcze nie zgłosił.</p>
            ) : (
              /* Drużyny pod nagłówkami grup, a nie jedną listą: przy ośmiu
                 drużynach w dwóch grupach lista bez podziału wymaga trzymania
                 w głowie, kto z kim gra. Drużyny bez grupy (faza pucharowa,
                 zgłoszenia przed losowaniem) mają własną sekcję na końcu. */
              sekcjeDruzyn.map(({ tytul, lista }) => (
                <div key={tytul} className="space-y-2">
                  {sekcjeDruzyn.length > 1 && (
                    <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {tytul}
                    </h2>
                  )}
                  {lista.map((d) => (
                    <KartaDruzyny
                      key={d.id}
                      d={d}
                      zalogowany={!!user}
                      czyMoja={d.id === mojaDruzyna?.id && d.kapitanId === user?.id}
                      onZamienWEkipe={zamienWEkipeAkcja}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {aktywna === 'terminarz' && (
          <div className="space-y-2">
            {meczePrzyszle.map((m) => (
              <KartaMeczu
                key={m.id}
                mecz={m}
                druzynyPoId={druzynyPoId}
                meczePoId={meczePoId}
                arenyPoId={arenyPoId}
                przygaszona={m.status === 'walkower' && !m.zaplanowanyAt}
                onClick={() => router.push(`/turnieje/${id}/mecz/${m.id}`)}
              />
            ))}
          </div>
        )}

        {aktywna === 'wyniki' && (
          <div className="space-y-6">
            <div className="space-y-2">
              {meczeRozegrane.map((m) => (
                <KartaMeczu
                  key={m.id}
                  mecz={m}
                  druzynyPoId={druzynyPoId}
                  meczePoId={meczePoId}
                  arenyPoId={arenyPoId}
                  przygaszona={m.status === 'walkower' && !m.zaplanowanyAt}
                  onClick={() => router.push(`/turnieje/${id}/mecz/${m.id}`)}
                />
              ))}
            </div>

            <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
              <h2 className="text-sm font-semibold text-slate-500">Statystyki graczy</h2>
              {!user ? (
                <SciankaLogowania tytul="Statystyki graczy" />
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Najwięcej goli</h3>
                    <Klasyfikacja wpisy={strzelcy} klucz="gole" etykietaKolumny="Gole" pusteMiejsce="Jeszcze nikt nie strzelił." />
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Najwięcej asyst</h3>
                    <Klasyfikacja wpisy={asystenci} klucz="asysty" etykietaKolumny="Asysty" pusteMiejsce="Jeszcze nikt nie zaliczył asysty." />
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Najwięcej tytułów MVP</h3>
                    <Klasyfikacja wpisy={mvpList} klucz="mvp" etykietaKolumny="MVP" pusteMiejsce="MVP jeszcze nie wybrano." />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {aktywna === 'tabela' && (
          <div className="space-y-5">
            {tabeleGrup.map(({ grupa, wiersze }) => (
              <div key={grupa?.id ?? 'liga'} className="space-y-2">
                {grupa && (
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Grupa {grupa.nazwa}
                  </h2>
                )}
                <TabelaGrupy wiersze={wiersze} awansujeZGrupy={grupa ? turniej.awansujeZGrupy : undefined} />
                {grupa && (
                  /* Wyniki grupy pod jej tabelą, zwinięte. Tabela mówi, JAK
                     stoją; pytanie „po czym" wymagało dotąd wyjścia do innej
                     zakładki i wyłowienia z niej meczów tej jednej grupy. */
                  <MeczeGrupy
                    mecze={meczeGrupowe.filter((m) => m.grupaId === grupa.id && rozegrany(m))}
                    druzynyPoId={druzynyPoId}
                    meczePoId={meczePoId}
                    arenyPoId={arenyPoId}
                    onKlikMeczu={(meczId) => router.push(`/turnieje/${id}/mecz/${meczId}`)}
                  />
                )}
              </div>
            ))}

            {/* JEDNA legenda pod wszystkimi tabelami, nie pod każdą z osobna:
                reguła awansu jest wspólna dla całego turnieju, a powtórzona
                przy każdej grupie czyta się jak osobna informacja o tej grupie. */}
            {legendaAwansu && (
              <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="h-3 w-[3px] shrink-0 rounded-full bg-primary-600" aria-hidden />
                {legendaAwansu}
              </p>
            )}
          </div>
        )}

        {aktywna === 'drabinka' && (
          <Drabinka
            mecze={meczeDrabinki}
            druzynyPoId={druzynyPoId}
            meczePoId={meczePoId}
            arenyPoId={arenyPoId}
            onKlikMeczu={(meczId) => router.push(`/turnieje/${id}/mecz/${meczId}`)}
          />
        )}
      </main>
      {oknoPotwierdzenia}
    </div>
  );
}
