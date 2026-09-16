'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowLeft, CalendarDays, MapPin, Users, Navigation, Settings, Lock, Share2, Repeat } from 'lucide-react';
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
import { STATUS_TURNIEJU, STATUS_DRUZYNY, odmienZawodnikow } from '@/lib/turniejEtykiety';
import { obliczTabele, posortujTabele } from '@/lib/turniejTabela';
import { obliczKlasyfikacje, posortujKlasyfikacje } from '@/lib/turniejStatystyki';
import { linkDoTurnieju, udostepnijTurniej } from '@/lib/turniejShare';
import { linkDojazdu } from '@/lib/utils';
import { sportEmoji } from '@/lib/sports';
import KartaMeczu from '@/components/turnieje/KartaMeczu';
import TabelaGrupy from '@/components/turnieje/TabelaGrupy';
import Drabinka from '@/components/turnieje/Drabinka';
import Klasyfikacja from '@/components/turnieje/Klasyfikacja';
import Ogloszenia from '@/components/turnieje/Ogloszenia';
import type { Turniej, TurniejDruzyna, TurniejOsoba, TurniejMecz, TurniejArena, TurniejGrupa, TurniejZdarzenie, TurniejOgloszenie } from '@/types';

type Zakladka = 'info' | 'druzyny' | 'terminarz' | 'wyniki';

function SciankaLogowania({ tytul }: { tytul: string }) {
  const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 text-center">
      <Lock className="mx-auto mb-2 h-5 w-5 text-slate-400" />
      <p className="text-sm font-semibold text-ink">{tytul}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Składy i statystyki widzą zalogowani gracze.</p>
      <div className="mt-3 flex flex-col gap-2">
        <Link href={`/logowanie?next=${encodeURIComponent(next)}`}>
          <Button size="sm" className="w-full">Zaloguj się</Button>
        </Link>
      </div>
    </div>
  );
}

function KartaDruzyny({
  d, zalogowany, czyMoja, onZamienWEkipe,
}: {
  d: TurniejDruzyna; zalogowany: boolean; czyMoja: boolean; onZamienWEkipe: (d: TurniejDruzyna) => void;
}) {
  const [rozwinieta, setRozwinieta] = useState(false);
  const status = STATUS_DRUZYNY[d.status];
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button onClick={() => setRozwinieta((v) => !v)} className="w-full flex items-center gap-3 p-3.5 text-left">
        <div className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{d.nazwa}</span>
          {zalogowany && d.liczbaZawodnikow !== undefined && (
            <span className="text-xs text-slate-400">{odmienZawodnikow(d.liczbaZawodnikow)}</span>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.ton}`}>{status.label}</span>
      </button>
      {rozwinieta && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-3.5 space-y-3">
          {!zalogowany ? (
            <SciankaLogowania tytul={`Skład drużyny ${d.nazwa}`} />
          ) : d.zawodnicy && d.zawodnicy.length > 0 ? (
            <ul className="space-y-1.5">
              {d.zawodnicy.map((z) => (
                <li key={z.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  {z.numer !== undefined && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-[11px] font-mono">{z.numer}</span>
                  )}
                  <span className="truncate">{z.imie}</span>
                  {z.kapitan && <span className="text-xs text-slate-400">(kapitan)</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Skład jeszcze pusty.</p>
          )}
          {czyMoja && (
            <button
              onClick={() => onZamienWEkipe(d)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600"
            >
              <Repeat className="h-3.5 w-3.5" /> Zamień drużynę w ekipę
            </button>
          )}
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
    tabParam === 'druzyny' ? 'druzyny' : tabParam === 'terminarz' ? 'terminarz' : tabParam === 'wyniki' ? 'wyniki' : 'info';

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
          {(['info', 'druzyny', 'terminarz', 'wyniki'] as Zakladka[]).map((z) => (
            <button
              key={z}
              onClick={() => router.push(`/turnieje/${id}?tab=${z}`)}
              className={[
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                zakladka === z ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {z === 'info' ? 'Info' : z === 'druzyny' ? `Drużyny (${druzyny.length})` : z === 'terminarz' ? 'Terminarz' : 'Wyniki'}
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

        {zakladka === 'info' && (
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

        {zakladka === 'druzyny' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{druzyny.length}/{turniej.maxDruzyn} drużyn</span>
              {przyjmujeZgloszenia(turniej, druzyny.length) && (
                <Link href={`/turnieje/${id}/zglos`} className="text-sm font-medium text-primary-600">+ Zgłoś drużynę</Link>
              )}
            </div>
            {druzyny.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Nikt się jeszcze nie zgłosił.</p>
            ) : (
              <div className="space-y-2">
                {druzyny.map((d) => (
                  <KartaDruzyny
                    key={d.id}
                    d={d}
                    zalogowany={!!user}
                    czyMoja={d.id === mojaDruzyna?.id && d.kapitanId === user?.id}
                    onZamienWEkipe={zamienWEkipeAkcja}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {zakladka === 'terminarz' && (
          mecze.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {uprawnienia.mozeEdytowac ? 'Terminarz jeszcze nie jest wygenerowany.' : 'Terminarz jeszcze nie jest gotowy.'}
            </p>
          ) : (
            <div className="space-y-2">
              {mecze.map((m) => (
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
          )
        )}

        {zakladka === 'wyniki' && (
          <div className="space-y-6">
            {tabeleGrup.map(({ grupa, wiersze }) => (
              <div key={grupa?.id ?? 'liga'} className="space-y-2">
                {grupa && <h2 className="text-sm font-semibold text-slate-500">Grupa {grupa.nazwa}</h2>}
                <TabelaGrupy wiersze={wiersze} awansujeZGrupy={grupa ? turniej.awansujeZGrupy : undefined} />
              </div>
            ))}

            {meczeDrabinki.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-500">Drabinka</h2>
                <Drabinka
                  mecze={meczeDrabinki}
                  druzynyPoId={druzynyPoId}
                  meczePoId={meczePoId}
                  arenyPoId={arenyPoId}
                  onKlikMeczu={(meczId) => router.push(`/turnieje/${id}/mecz/${meczId}`)}
                />
              </div>
            )}

            {tabeleGrup.length === 0 && meczeDrabinki.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">Jeszcze nie ma czego pokazać — poczekaj na pierwsze wyniki.</p>
            )}

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
      </main>
      {oknoPotwierdzenia}
    </div>
  );
}
