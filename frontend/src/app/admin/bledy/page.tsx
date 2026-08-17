'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bug, Loader2, MessageSquareWarning, RefreshCw } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAdmin } from '@/lib/admin';
import { useToast } from '@/lib/toast';
import {
  pobierzZgloszenia,
  zmienStatusZgloszenia,
  type StatusZgloszenia,
  type ZgloszenieBledu,
} from '@/lib/zgloszeniaBledow';

const FILTRY: [StatusZgloszenia | 'wszystkie', string][] = [
  ['nowe', 'Nowe'],
  ['w_toku', 'W toku'],
  ['zamkniete', 'Zamknięte'],
  ['wszystkie', 'Wszystkie'],
];

const NASTEPNY: Record<StatusZgloszenia, StatusZgloszenia> = {
  nowe: 'w_toku',
  w_toku: 'zamkniete',
  zamkniete: 'nowe',
};

const ETYKIETA: Record<StatusZgloszenia, string> = {
  nowe: 'Nowe',
  w_toku: 'W toku',
  zamkniete: 'Zamknięte',
};

function kiedy(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Panel zgłoszeń błędów.
 *
 * Dwa rodzaje na jednej liście, bo administrator ma jedno miejsce, w które
 * patrzy — ale odróżnione ikoną i kolorem, bo czyta się je inaczej: awaria
 * niesie stos i licznik wystąpień, zgłoszenie od człowieka niesie zdanie
 * napisane ręką.
 *
 * Kolejność po `ostatni_raz`: błąd sprzed tygodnia, który wciąż się dzieje,
 * jest pilniejszy od wczorajszego, który ucichł.
 */
export default function AdminBledyPage() {
  const jestAdmin = useAdmin();
  const { toast } = useToast();
  const [filtr, setFiltr] = useState<StatusZgloszenia | 'wszystkie'>('nowe');
  const [zgloszenia, setZgloszenia] = useState<ZgloszenieBledu[]>([]);
  const [ladowanie, setLadowanie] = useState(true);
  const [rozwiniete, setRozwiniete] = useState<string | null>(null);

  const wczytaj = useCallback(async () => {
    setLadowanie(true);
    try {
      setZgloszenia(await pobierzZgloszenia(filtr === 'wszystkie' ? undefined : filtr));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wczytać zgłoszeń', 'error');
    } finally {
      setLadowanie(false);
    }
  }, [filtr, toast]);

  useEffect(() => { if (jestAdmin) wczytaj(); }, [jestAdmin, wczytaj]);

  const przelacz = async (z: ZgloszenieBledu) => {
    const nowy = NASTEPNY[z.status];
    try {
      await zmienStatusZgloszenia(z.id, nowy);
      setZgloszenia((cur) => cur.map((x) => (x.id === z.id ? { ...x, status: nowy } : x)));
      toast(`Status: ${ETYKIETA[nowy]}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zmienić statusu', 'error');
    }
  };

  if (!jestAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
          <p className="text-sm text-slate-500">Ta strona jest tylko dla administratorów.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-ink">Zgłoszenia błędów</h1>
          <button
            onClick={wczytaj}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Odśwież
          </button>
        </div>

        <div className="scrollbar-hide mb-4 flex gap-2 overflow-x-auto">
          {FILTRY.map(([wartosc, etykieta]) => (
            <button
              key={wartosc}
              onClick={() => setFiltr(wartosc)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                filtr === wartosc
                  ? 'border-primary-700 bg-primary-50 text-primary-700'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {etykieta}
            </button>
          ))}
        </div>

        {ladowanie ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : zgloszenia.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">
            Nic tu nie ma. {filtr === 'nowe' && 'To dobra wiadomość.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {zgloszenia.map((z) => (
              <li
                key={z.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-start gap-3">
                  {z.rodzaj === 'awaria'
                    ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    : <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />}

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-ink">{z.opis}</p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{kiedy(z.ostatniRaz)}</span>
                      {/* Licznik wystąpień to najważniejsza liczba przy awarii:
                          mówi, czy dotyczy jednej osoby, czy wszystkich. */}
                      {z.liczba > 1 && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 font-bold text-red-700">
                          ×{z.liczba}
                        </span>
                      )}
                      {z.wersja && <span className="font-mono">{z.wersja.slice(0, 7)}</span>}
                    </div>

                    {z.adres && (
                      <p className="mt-1 truncate text-xs text-slate-400" title={z.adres}>{z.adres}</p>
                    )}

                    {rozwiniete === z.id && (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-700">
                        {z.przegladarka && (
                          <p className="break-words text-slate-500">{z.przegladarka}</p>
                        )}
                        {z.slad && (
                          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2.5 font-mono text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            {z.slad}
                          </pre>
                        )}
                        <p className="text-slate-400">
                          Pierwszy raz: {kiedy(z.pierwszyRaz)}
                          {z.userId && ` · użytkownik ${z.userId.slice(0, 8)}`}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => przelacz(z)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {ETYKIETA[z.status]} →
                      </button>
                      {(z.slad || z.przegladarka) && (
                        <button
                          onClick={() => setRozwiniete(rozwiniete === z.id ? null : z.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
                        >
                          <Bug className="h-3 w-3" />
                          {rozwiniete === z.id ? 'Zwiń' : 'Szczegóły'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
