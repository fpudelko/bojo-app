'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Download, Plus, Check, X as XIcon, Trash2, Ban } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import ToggleRow from '@/components/ui/ToggleRow';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import {
  getTurniej, uprawnieniaTurnieju, getOsobyTurnieju, setUprawnieniaOsoby,
  usunOsobeZTurnieju, updateTurniej, setStatusTurnieju, deleteTurniej,
} from '@/lib/turnieje';
import {
  getDruzynyZeSkladem, setStatusDruzyny, dodajDruzyneRecznie, getKontakty, usunDruzyne,
} from '@/lib/turniejDruzyny';
import { odmienZawodnikow } from '@/lib/turniejEtykiety';
import type { Turniej, TurniejDruzyna, TurniejOsoba } from '@/types';
import type { KontaktDruzyny } from '@/lib/turniejDruzyny';

type PanelTab = 'druzyny' | 'ludzie' | 'ustawienia';

const inputCls =
  'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';

function toCsv(kontakty: KontaktDruzyny[]): string {
  const naglowek = 'Drużyna,Kapitan,Telefon,E-mail,Wpisowe opłacone\n';
  const wiersze = kontakty.map((k) => [
    k.druzyna, k.kapitan ?? '', k.telefon ?? '', k.email ?? '', k.oplacone ? 'tak' : 'nie',
  ].map((v) => `"${v.replace(/"/g, '""')}"`).join(','));
  return naglowek + wiersze.join('\n');
}

export default function PanelClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();

  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [osoby, setOsoby] = useState<TurniejOsoba[]>([]);
  const [ladowanie, setLadowanie] = useState(true);
  const [nowaNazwa, setNowaNazwa] = useState('');
  const [szukajOsoby, setSzukajOsoby] = useState('');

  const tabParam = searchParams.get('tab');
  const zakladka: PanelTab = tabParam === 'ludzie' ? 'ludzie' : tabParam === 'ustawienia' ? 'ustawienia' : 'druzyny';

  const wczytaj = async () => {
    const [t, d, o] = await Promise.all([getTurniej(id), getDruzynyZeSkladem(id), getOsobyTurnieju(id)]);
    setTurniej(t);
    setDruzyny(d);
    setOsoby(o);
  };

  useEffect(() => {
    let aktualne = true;
    setLadowanie(true);
    wczytaj().finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const uprawnienia = useMemo(
    () => (turniej ? uprawnieniaTurnieju(turniej, osoby.find((o) => o.userId === user?.id) ?? null, user?.id) : null),
    [turniej, osoby, user],
  );

  const kandydaci = useMemo(() => {
    const wKlubie = new Set(osoby.map((o) => o.userId));
    const widziani = new Map<string, string>();
    druzyny.forEach((d) => {
      d.zawodnicy?.forEach((z) => {
        if (z.userId && !wKlubie.has(z.userId)) widziani.set(z.userId, z.imie);
      });
    });
    const lista = Array.from(widziani, ([userId, imie]) => ({ userId, imie }));
    if (!szukajOsoby.trim()) return lista;
    const q = szukajOsoby.trim().toLowerCase();
    return lista.filter((k) => k.imie.toLowerCase().includes(q));
  }, [druzyny, osoby, szukajOsoby]);

  if (authLoading || ladowanie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = `/logowanie?next=${encodeURIComponent(`/turnieje/${id}/panel`)}`;
    return null;
  }

  if (!turniej) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-500">Nie znaleziono turnieju.</div>
      </div>
    );
  }

  if (!uprawnienia?.mozeEdytowac && !uprawnienia?.mozeZarzadzacDruzynami) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-center">
          <p className="font-medium text-ink">Ten panel jest dla organizatora turnieju</p>
          <Link href={`/turnieje/${id}`} className="mt-3 inline-block text-sm text-primary-600">Wróć do turnieju</Link>
        </main>
      </div>
    );
  }

  const kopiuj = async (tekst: string, etykieta = 'Link') => {
    try { await navigator.clipboard.writeText(tekst); toast(`${etykieta} skopiowany`); }
    catch { toast('Nie udało się skopiować', 'error'); }
  };

  const przyjmij = async (d: TurniejDruzyna, status: TurniejDruzyna['status']) => {
    try { await setStatusDruzyny(d.id, status); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error'); }
  };

  const dodajRecznie = async () => {
    if (nowaNazwa.trim().length < 2) return;
    try {
      const druzynaId = await dodajDruzyneRecznie(id, nowaNazwa);
      setNowaNazwa('');
      await wczytaj();
      const nowa = (await getDruzynyZeSkladem(id)).find((d) => d.id === druzynaId);
      if (nowa) {
        toast(`Dodano ${nowa.nazwa}`);
        void kopiuj(`${window.location.origin}/t/${nowa.kodDolaczenia}`, 'Link drużyny');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się dodać drużyny', 'error');
    }
  };

  const usunDruzyneZTurnieju = async (d: TurniejDruzyna) => {
    const wynik = await potwierdz({
      tytul: `Usunąć drużynę ${d.nazwa}?`,
      konsekwencje: [`Zniknie ${odmienZawodnikow(d.liczbaZawodnikow ?? 0)}`, 'Link drużyny przestanie działać', 'Tego nie da się cofnąć'],
      potwierdzLabel: 'Usuń drużynę',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try { await usunDruzyne(d.id); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się usunąć drużyny', 'error'); }
  };

  const pobierzKontaktyCsv = async () => {
    try {
      const kontakty = await getKontakty(id);
      const blob = new Blob([toCsv(kontakty)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `kontakty-${turniej.nazwa}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się pobrać kontaktów', 'error');
    }
  };

  const dodajOsobe = async (userId: string) => {
    try { await setUprawnieniaOsoby(id, userId, { mozeProwadzic: true }); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się dodać osoby', 'error'); }
  };

  const zmienUprawnienie = async (userId: string, pole: 'mozeEdytowac' | 'mozeProwadzic' | 'mozeZarzadzacDruzynami', wartosc: boolean) => {
    try { await setUprawnieniaOsoby(id, userId, { [pole]: wartosc }); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się zapisać uprawnienia', 'error'); }
  };

  const zamknijLubOtworzZapisy = async () => {
    const nowyStatus = turniej.status === 'zamkniete_zapisy' ? 'zapisy' : 'zamkniete_zapisy';
    try { await setStatusTurnieju(id, nowyStatus); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się zmienić stanu zapisów', 'error'); }
  };

  const odwolaj = async () => {
    const wynik = await potwierdz({
      tytul: 'Odwołać turniej?',
      konsekwencje: ['Wszyscy zawodnicy dostaną powiadomienie', 'Turniej zostaje w aplikacji jako odwołany'],
      potwierdzLabel: 'Odwołaj turniej',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try { await setStatusTurnieju(id, 'odwolany'); await wczytaj(); toast('Turniej odwołany'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się odwołać turnieju', 'error'); }
  };

  const usunTurniej = async () => {
    const wynik = await potwierdz({
      tytul: 'Usunąć turniej?',
      konsekwencje: [
        `Zniknie ${druzyny.length === 1 ? '1 drużyna' : `${druzyny.length} drużyn`} i cały skład`,
        'Linki do turnieju i drużyn przestaną działać',
        'Tego nie da się cofnąć',
      ],
      potwierdzLabel: 'Usuń turniej',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try { await deleteTurniej(id); toast('Turniej usunięty'); router.push('/turnieje'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się usunąć turnieju', 'error'); }
  };

  const czekajace = druzyny.filter((d) => d.status === 'zgloszona');
  const wTurnieju = druzyny.filter((d) => d.status === 'przyjeta');
  const rezerwa = druzyny.filter((d) => d.status === 'rezerwa');

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <div className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button onClick={() => router.push(`/turnieje/${id}`)} aria-label="Wróć" className="shrink-0 text-slate-500 hover:text-ink">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-ink">Panel — {turniej.nazwa}</h1>
        </div>
        <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {(['druzyny', 'ludzie', 'ustawienia'] as PanelTab[]).map((z) => (
            <button
              key={z}
              onClick={() => router.push(`/turnieje/${id}/panel?tab=${z}`)}
              className={[
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                zakladka === z ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-5">
        {zakladka === 'druzyny' && (
          <div className="space-y-6">
            {czekajace.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-blue-700">Czekają na decyzję</h2>
                {czekajace.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 dark:bg-blue-950/30 p-3">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{d.nazwa}</span>
                    <button onClick={() => przyjmij(d, 'przyjeta')} className="rounded-lg bg-primary-600 p-1.5 text-white" aria-label="Przyjmij"><Check className="h-4 w-4" /></button>
                    <button onClick={() => przyjmij(d, 'rezerwa')} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600">Rezerwa</button>
                    <button onClick={() => przyjmij(d, 'odrzucona')} className="rounded-lg p-1.5 text-slate-400" aria-label="Odrzuć"><XIcon className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-500">W turnieju ({wTurnieju.length})</h2>
              {wTurnieju.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                  <span className="min-w-0 flex-1 truncate text-ink">{d.nazwa}</span>
                  <span className="text-xs text-slate-400">{odmienZawodnikow(d.liczbaZawodnikow ?? 0)}</span>
                  <button onClick={() => kopiuj(`${window.location.origin}/t/${d.kodDolaczenia}`, 'Link drużyny')} className="text-slate-400 hover:text-ink" aria-label="Kopiuj link"><Copy className="h-4 w-4" /></button>
                  <button onClick={() => usunDruzyneZTurnieju(d)} className="text-slate-400 hover:text-red-500" aria-label="Usuń drużynę"><XIcon className="h-4 w-4" /></button>
                </div>
              ))}
              {wTurnieju.length === 0 && <p className="text-sm text-slate-400">Jeszcze nikogo.</p>}
            </div>

            {rezerwa.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-500">Rezerwa</h2>
                {rezerwa.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                    <span className="min-w-0 flex-1 truncate text-ink">{d.nazwa}</span>
                    <button onClick={() => przyjmij(d, 'przyjeta')} className="text-xs font-medium text-primary-600">Przyjmij</button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
              <div className="flex gap-2">
                <input value={nowaNazwa} onChange={(e) => setNowaNazwa(e.target.value)} placeholder="Nazwa drużyny" className={inputCls} />
                <Button size="sm" onClick={dodajRecznie} disabled={nowaNazwa.trim().length < 2} className="shrink-0 inline-flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Dodaj
                </Button>
              </div>
              <button onClick={pobierzKontaktyCsv} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Download className="h-4 w-4" /> Pobierz kontakty (CSV)
              </button>
            </div>
          </div>
        )}

        {zakladka === 'ludzie' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-500">Uprawnieni</h2>
              {osoby.length === 0 && <p className="text-sm text-slate-400">Tylko Ty zarządzasz tym turniejem.</p>}
              {osoby.map((o) => (
                <div key={o.userId} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{o.imie ?? 'Osoba'}</span>
                    <button onClick={() => usunOsobeZTurnieju(id, o.userId).then(wczytaj)} className="text-slate-400 hover:text-red-500" aria-label="Usuń uprawnienia"><XIcon className="h-4 w-4" /></button>
                  </div>
                  <ToggleRow label="Może prowadzić mecze" desc="Rozpoczyna i kończy mecze, wpisuje gole" checked={o.mozeProwadzic} onChange={(v) => zmienUprawnienie(o.userId, 'mozeProwadzic', v)} />
                  <ToggleRow label="Może zarządzać drużynami" desc="Przyjmuje zgłoszenia, dodaje i wycofuje drużyny" checked={o.mozeZarzadzacDruzynami} onChange={(v) => zmienUprawnienie(o.userId, 'mozeZarzadzacDruzynami', v)} />
                  {uprawnienia?.jestOrganizatorem && (
                    <ToggleRow label="Może edytować turniej" desc="Wszystko powyżej plus ustawienia i terminarz" checked={o.mozeEdytowac} onChange={(v) => zmienUprawnienie(o.userId, 'mozeEdytowac', v)} />
                  )}
                </div>
              ))}
            </div>

            {uprawnienia?.jestOrganizatorem && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-500">Dodaj osobę</h2>
                <input value={szukajOsoby} onChange={(e) => setSzukajOsoby(e.target.value)} placeholder="Szukaj wśród kapitanów i zawodników…" className={inputCls} />
                <div className="space-y-1.5">
                  {kandydaci.slice(0, 8).map((k) => (
                    <button key={k.userId} onClick={() => dodajOsobe(k.userId)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-800">
                      <span className="truncate">{k.imie}</span>
                      <Plus className="h-4 w-4 text-primary-600" />
                    </button>
                  ))}
                  {szukajOsoby && kandydaci.length === 0 && <p className="text-sm text-slate-400">Nikogo nie znaleziono.</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {zakladka === 'ustawienia' && uprawnienia?.jestOrganizatorem && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nazwa turnieju</label>
              <input
                defaultValue={turniej.nazwa}
                onBlur={(e) => e.target.value.trim() !== turniej.nazwa && updateTurniej(id, { nazwa: e.target.value }).then(wczytaj)}
                className={inputCls}
              />
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Opis</label>
              <textarea
                defaultValue={turniej.opis ?? ''}
                onBlur={(e) => updateTurniej(id, { opis: e.target.value }).then(wczytaj)}
                rows={3}
                className={inputCls}
              />
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Regulamin</label>
              <textarea
                defaultValue={turniej.regulamin ?? ''}
                onBlur={(e) => updateTurniej(id, { regulamin: e.target.value }).then(wczytaj)}
                rows={3}
                className={inputCls}
              />
            </div>

            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
              <Button variant="outline" onClick={zamknijLubOtworzZapisy} className="w-full">
                {turniej.status === 'zamkniete_zapisy' ? 'Otwórz zapisy' : 'Zamknij zapisy'}
              </Button>
              <div className="flex items-center justify-between gap-3 pt-1">
                {turniej.status !== 'odwolany' && (
                  <button onClick={odwolaj} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600">
                    <Ban className="h-3.5 w-3.5" /> Odwołaj turniej
                  </button>
                )}
                <button onClick={usunTurniej} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" /> Usuń turniej
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      {oknoPotwierdzenia}
    </div>
  );
}
