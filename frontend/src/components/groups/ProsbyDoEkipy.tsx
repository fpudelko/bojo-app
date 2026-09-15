'use client';

import { useState } from 'react';
import { Check, Loader2, UserPlus, X } from 'lucide-react';
import { rozpatrzProsbeDoGrupy } from '@/lib/groups';
import { useToast } from '@/lib/toast';
import { plural } from '@/lib/plural';
import type { GroupJoinRequest } from '@/types';

/**
 * Prośby o dołączenie do ekipy — nad składem, wyłącznie dla założyciela
 * i `can_manage_members` (migracja `150`).
 *
 * NIEBIESKI, bo to jest dokładnie „wymaga akceptacji uczestnictwa" z AGENTS.md
 * — ta sama rodzina co prośba o dołączenie do meczu, tylko o poziom wyżej.
 *
 * Notka proszącego jest tu ważniejsza niż na liście meczowej: ekipa jest
 * odtąd niewidoczna, więc rozpatrujący nie ma jak sprawdzić, skąd ten ktoś
 * się wziął — poza tym, co sam napisał.
 */
export default function ProsbyDoEkipy({
  prosby, onRozpatrzone,
}: {
  prosby: GroupJoinRequest[];
  onRozpatrzone: () => void;
}) {
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (prosby.length === 0) return null;

  const rozpatrz = async (prosba: GroupJoinRequest, przyjmij: boolean) => {
    setBusyId(prosba.id);
    try {
      await rozpatrzProsbeDoGrupy(prosba.id, przyjmij);
      toast(przyjmij ? `${prosba.name ?? 'Gracz'} jest w ekipie` : 'Prośba odrzucona');
      onRozpatrzone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się rozpatrzyć prośby', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/40">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
        <UserPlus className="h-3.5 w-3.5" />
        {prosby.length} {plural(prosby.length, 'prośba o dołączenie', 'prośby o dołączenie', 'próśb o dołączenie')}
      </h3>
      <ul className="space-y-2">
        {prosby.map((p) => (
          <li key={p.id} className="flex items-start gap-2.5 rounded-xl bg-white p-2.5 dark:bg-slate-800">
            {p.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
                {(p.name ?? 'G').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{p.name ?? 'Gracz'}</p>
              {p.wiadomosc && (
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{p.wiadomosc}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => rozpatrz(p, false)}
                disabled={busyId === p.id}
                aria-label={`Odrzuć prośbę: ${p.name ?? 'Gracz'}`}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={() => rozpatrz(p, true)}
                disabled={busyId === p.id}
                aria-label={`Przyjmij do ekipy: ${p.name ?? 'Gracz'}`}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Przyjmij
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
