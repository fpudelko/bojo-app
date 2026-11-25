'use client';

// „Prośby do rozpatrzenia” (migracja 186, 2026-11-25): karta dla kapitana
// i organizatora z prośbami graczy do drużyn, z „Przyjmij” i „Odrzuć” na
// jedno dotknięcie. Stoi na górze strony turnieju (tam prowadzi powiadomienie)
// i na ekranie drużyny. Niebieska, bo czeka na decyzję (AGENTS.md: kolory).
import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { getProsbyDoRozpatrzenia, rozpatrzProsbe, opisProsby, type ProsbaDoDruzyny } from '@/lib/turniejProsby';
import { useToast } from '@/lib/toast';

export default function ProsbyDoRozpatrzenia({
  turniejId, userId, druzynaId, onZmiana,
}: {
  turniejId: string;
  userId: string;
  /** Tylko prośby do tej drużyny (ekran drużyny). */
  druzynaId?: string;
  /** Po decyzji skład się zmienia: rodzic odświeża dane. */
  onZmiana?: () => void;
}) {
  const { toast } = useToast();
  const [prosby, setProsby] = useState<ProsbaDoDruzyny[]>([]);
  const [wTrakcie, setWTrakcie] = useState<string | null>(null);

  const wczytaj = useCallback(async () => {
    const lista = await getProsbyDoRozpatrzenia(turniejId, userId);
    setProsby(druzynaId ? lista.filter((p) => p.druzynaId === druzynaId) : lista);
  }, [turniejId, userId, druzynaId]);

  useEffect(() => { void wczytaj(); }, [wczytaj]);

  if (prosby.length === 0) return null;

  const decyzja = async (p: ProsbaDoDruzyny, przyjmij: boolean) => {
    setWTrakcie(p.id);
    try {
      await rozpatrzProsbe(p.id, przyjmij);
      toast(przyjmij ? 'Przyjęte' : 'Odrzucone');
      await wczytaj();
      onZmiana?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać decyzji', 'error');
    } finally {
      setWTrakcie(null);
    }
  };

  return (
    <section className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40" aria-label="Prośby do rozpatrzenia">
      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Prośby do rozpatrzenia ({prosby.length})</h2>
      {prosby.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 dark:bg-slate-800">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{opisProsby(p)}</p>
            {!druzynaId && p.druzynaNazwa && <p className="text-xs text-slate-500 dark:text-slate-400">{p.druzynaNazwa}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => decyzja(p, false)}
              disabled={wTrakcie === p.id}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              <X className="h-4 w-4" aria-hidden /> Odrzuć
            </button>
            <button
              type="button"
              onClick={() => decyzja(p, true)}
              disabled={wTrakcie === p.id}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Check className="h-4 w-4" aria-hidden /> Przyjmij
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
