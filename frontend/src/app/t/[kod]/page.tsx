'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Lock } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { validateName } from '@/lib/validation';
import { getDruzynaPoKodzie, dolaczDoDruzyny } from '@/lib/turniejDruzyny';
import type { TurniejDruzyna } from '@/types';

const inputCls =
  'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';

export default function DolaczDoDruzynyPage() {
  const { kod } = useParams<{ kod: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [druzyna, setDruzyna] = useState<TurniejDruzyna | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [imie, setImie] = useState('');
  const [wTrakcie, setWTrakcie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    let aktualne = true;
    getDruzynaPoKodzie(kod)
      .then((d) => { if (aktualne) setDruzyna(d); })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [kod]);

  const wykonaj = async (opcje: Parameters<typeof dolaczDoDruzyny>[1]) => {
    setWTrakcie(true);
    setBlad(null);
    try {
      const wynik = await dolaczDoDruzyny(kod, opcje);
      router.push(`/turnieje/${wynik.turniejId}?tab=druzyny`);
      toast(wynik.zostalKapitanem ? 'Jesteś kapitanem tej drużyny!' : 'Dołączyłeś do drużyny!');
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się dołączyć');
      setWTrakcie(false);
    }
  };

  if (loading || ladowanie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (!druzyna) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-center">
          <p className="font-medium text-ink">Nie znaleziono drużyny o tym kodzie.</p>
          <Link href="/turnieje" className="mt-2 inline-block text-sm text-primary-600">Wróć do turniejów</Link>
        </main>
      </div>
    );
  }

  const wolneWpisy = (druzyna.zawodnicy ?? []).filter((z) => !z.userId);

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-center">
          <Lock className="mx-auto mb-3 h-6 w-6 text-slate-400" />
          <h1 className="font-display text-xl font-bold text-ink mb-1">{druzyna.nazwa}</h1>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Zaloguj się, żeby dołączyć do drużyny.</p>
          <div className="flex flex-col items-center gap-2">
            <Link href={`/logowanie?next=${encodeURIComponent(`/t/${kod}`)}`}>
              <Button>Zaloguj się</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-ink text-center mb-1">{druzyna.nazwa}</h1>
        <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">Turniej Bojo</p>

        <div className="space-y-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          {blad && <p className="text-sm text-red-600">{blad}</p>}

          {!druzyna.kapitanId ? (
            <div className="space-y-2">
              <Button onClick={() => wykonaj({ jakoKapitan: true })} disabled={wTrakcie} className="w-full inline-flex items-center justify-center gap-2">
                {wTrakcie ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Zostań kapitanem tej drużyny'}
              </Button>
              <Button variant="outline" onClick={() => wykonaj({})} disabled={wTrakcie} className="w-full">
                Dołącz jako zawodnik
              </Button>
            </div>
          ) : wolneWpisy.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Jesteś na tej liście?</p>
              {wolneWpisy.map((z) => (
                <button
                  key={z.id}
                  onClick={() => wykonaj({ zawodnikId: z.id })}
                  disabled={wTrakcie}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {z.imie}
                </button>
              ))}
              <details className="pt-2">
                <summary className="cursor-pointer text-sm text-primary-600">Nie ma mnie na liście</summary>
                <div className="mt-2 flex gap-2">
                  <input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="Imię i nazwisko" className={inputCls} />
                  <Button
                    size="sm"
                    onClick={() => { try { wykonaj({ imie: validateName(imie, 'Imię', 60) }); } catch (e) { setBlad(e instanceof Error ? e.message : 'Podaj imię'); } }}
                    disabled={wTrakcie || imie.trim().length < 1}
                    className="shrink-0"
                  >
                    Dołącz
                  </Button>
                </div>
              </details>
            </div>
          ) : (
            <div className="space-y-2">
              <input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="Imię i nazwisko" className={inputCls} />
              <Button
                onClick={() => { try { wykonaj({ imie: validateName(imie, 'Imię', 60) }); } catch (e) { setBlad(e instanceof Error ? e.message : 'Podaj imię'); } }}
                disabled={wTrakcie || imie.trim().length < 1}
                className="w-full inline-flex items-center justify-center gap-2"
              >
                {wTrakcie ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dołącz do drużyny'}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
