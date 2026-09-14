'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowLeft, CalendarDays, MapPin, Users, Navigation, Settings, Lock } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { getTurniej, uprawnieniaTurnieju, getMojaOsobe, przyjmujeZgloszenia } from '@/lib/turnieje';
import { getDruzyny, getDruzynyZeSkladem } from '@/lib/turniejDruzyny';
import { getMecze, getAreny } from '@/lib/turniejMecze';
import { STATUS_TURNIEJU, STATUS_DRUZYNY, odmienZawodnikow } from '@/lib/turniejEtykiety';
import { linkDojazdu } from '@/lib/utils';
import { sportEmoji } from '@/lib/sports';
import KartaMeczu from '@/components/turnieje/KartaMeczu';
import type { Turniej, TurniejDruzyna, TurniejOsoba, TurniejMecz, TurniejArena } from '@/types';

type Zakladka = 'info' | 'druzyny' | 'terminarz';

function SciankaLogowania({ nazwaDruzyny }: { nazwaDruzyny: string }) {
  const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 text-center">
      <Lock className="mx-auto mb-2 h-5 w-5 text-slate-400" />
      <p className="text-sm font-semibold text-ink">Skład drużyny {nazwaDruzyny}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Składy i statystyki widzą zalogowani gracze.</p>
      <div className="mt-3 flex flex-col gap-2">
        <Link href={`/logowanie?next=${encodeURIComponent(next)}`}>
          <Button size="sm" className="w-full">Zaloguj się</Button>
        </Link>
      </div>
    </div>
  );
}

function KartaDruzyny({ d, zalogowany }: { d: TurniejDruzyna; zalogowany: boolean }) {
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
        <div className="border-t border-slate-100 dark:border-slate-700 p-3.5">
          {!zalogowany ? (
            <SciankaLogowania nazwaDruzyny={d.nazwa} />
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

  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [osoba, setOsoba] = useState<TurniejOsoba | null>(null);
  const [mecze, setMecze] = useState<TurniejMecz[]>([]);
  const [areny, setAreny] = useState<TurniejArena[]>([]);
  const [ladowanie, setLadowanie] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const tabParam = searchParams.get('tab');
  const zakladka: Zakladka = tabParam === 'druzyny' ? 'druzyny' : tabParam === 'terminarz' ? 'terminarz' : 'info';

  useEffect(() => {
    let aktualne = true;
    setLadowanie(true);
    getTurniej(id)
      .then(async (t) => {
        if (!aktualne) return;
        if (!t) { setNotFound(true); setLadowanie(false); return; }
        setTurniej(t);
        const [d, o, m, a] = await Promise.all([
          user ? getDruzynyZeSkladem(id) : getDruzyny(id),
          user ? getMojaOsobe(id, user.id) : Promise.resolve(null),
          getMecze(id),
          getAreny(id),
        ]);
        if (!aktualne) return;
        setDruzyny(d);
        setOsoba(o);
        setMecze(m);
        setAreny(a);
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
  const dojazd = linkDojazdu({ lat: turniej.lat, lng: turniej.lng, adres: turniej.miejsceAdres });
  let dataLabel = turniej.dataStartu;
  try { dataLabel = format(parseISO(turniej.dataStartu), 'EEEE, d MMMM', { locale: pl }); } catch { /* zostaw surową datę */ }

  const kopiujLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Link skopiowany');
    } catch {
      toast('Nie udało się skopiować linku', 'error');
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
          {(['info', 'druzyny', 'terminarz'] as Zakladka[]).map((z) => (
            <button
              key={z}
              onClick={() => router.push(`/turnieje/${id}?tab=${z}`)}
              className={[
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                zakladka === z ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {z === 'info' ? 'Info' : z === 'druzyny' ? `Drużyny (${druzyny.length})` : 'Terminarz'}
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
              <button onClick={kopiujLink} className="text-sm font-medium text-primary-600">Kopiuj link</button>
            </div>

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
                {druzyny.map((d) => <KartaDruzyny key={d.id} d={d} zalogowany={!!user} />)}
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
      </main>
    </div>
  );
}
