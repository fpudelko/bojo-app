'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, Lock, UserPlus } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useWstecz } from '@/lib/historia';
import { anulujProsbeDoGrupy, poprosODolaczenieDoGrupy } from '@/lib/groups';
import { useToast } from '@/lib/toast';
import type { GroupJoinRequest } from '@/types';

/**
 * Ekipa widziana przez kogoś, kto do niej nie należy — NAZWA i jedna akcja.
 *
 * Skład, terminarz, rozmowa i statystyki nie są tu ukryte przez `if` w JSX:
 * baza ich tej osobie nie odda (migracja `150`). Ten komponent jest tym, co
 * zostaje, gdy zapytania wracają puste — i ma to powiedzieć wprost, zamiast
 * pokazywać pustą listę meczów, którą łatwo wziąć za „ekipa nic nie gra".
 *
 * Dwie drogi wejścia stoją obok siebie, bo prowadzą do różnych sytuacji:
 * kto ma kod albo link, wchodzi od ręki (`dolacz_do_grupy_kodem`, `094`);
 * kto trafił tu sam, może poprosić i czekać na decyzję.
 */
export default function EkipaZamknieta({
  groupId, nazwa, prosba, zalogowany, onZmiana,
}: {
  groupId: string;
  nazwa: string;
  /** Moja prośba do tej ekipy — `null`, gdy jeszcze nie prosiłem. */
  prosba: GroupJoinRequest | null;
  zalogowany: boolean;
  onZmiana: () => void;
}) {
  const wstecz = useWstecz('/grupy');
  const { toast } = useToast();
  const [wiadomosc, setWiadomosc] = useState('');
  const [busy, setBusy] = useState(false);

  const wyslij = async () => {
    setBusy(true);
    try {
      await poprosODolaczenieDoGrupy(groupId, wiadomosc);
      toast('Prośba wysłana');
      onZmiana();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wysłać prośby', 'error');
    } finally {
      setBusy(false);
    }
  };

  const anuluj = async () => {
    if (!prosba) return;
    setBusy(true);
    try {
      await anulujProsbeDoGrupy(prosba.id);
      toast('Prośba wycofana');
      onZmiana();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wycofać prośby', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header showMobileWordmark />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        <button
          onClick={wstecz}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> Wróć
        </button>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900">
            <Lock className="h-5 w-5 text-white" />
          </span>
          <h1 className="font-display text-xl font-bold text-ink">{nazwa}</h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            To prywatna ekipa. Skład, mecze i rozmowa są widoczne dopiero po dołączeniu.
          </p>

          {!zalogowany && (
            <Link
              href={`/logowanie?next=${encodeURIComponent(`/grupy/${groupId}`)}`}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"
            >
              Zaloguj się, żeby poprosić o dołączenie
            </Link>
          )}

          {zalogowany && !prosba && (
            <div className="mt-4 space-y-2 text-left">
              <label htmlFor="nota-prosby" className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Dodaj notkę (nieobowiązkowo) — ekipa widzi tylko Twoje imię
              </label>
              <textarea
                id="nota-prosby"
                value={wiadomosc}
                onChange={(e) => setWiadomosc(e.target.value.slice(0, 300))}
                rows={2}
                placeholder="np. Gram z Kubą w czwartki"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-primary-700 focus:outline-none dark:border-slate-600 dark:bg-slate-900"
              />
              <button
                onClick={wyslij}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Poproś o dołączenie
              </button>
            </div>
          )}

          {zalogowany && prosba?.status === 'oczekuje' && (
            <div className="mt-4">
              {/* Niebieski = „wymaga akceptacji uczestnictwa" (AGENTS.md) — ta
                  sama rodzina co prośba o dołączenie do meczu, tylko czeka tu
                  druga strona. */}
              <p className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
                <Check className="h-4 w-4" /> Prośba wysłana — czeka na decyzję ekipy
              </p>
              <button
                onClick={anuluj}
                disabled={busy}
                className="mt-2 block w-full text-xs font-medium text-slate-500 hover:text-ink disabled:opacity-60 dark:text-slate-400"
              >
                Wycofaj prośbę
              </button>
            </div>
          )}

          {zalogowany && prosba?.status === 'odrzucona' && (
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Ekipa nie przyjęła Twojej prośby.
            </p>
          )}

          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Masz kod albo link zaproszenia? Wejdziesz od razu, bez czekania.
          </p>
        </div>
      </main>
    </div>
  );
}
