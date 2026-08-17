'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, MessageSquareWarning } from 'lucide-react';
import Header from '@/components/layout/Header';
import { zglosUwage } from '@/lib/bledy';

/**
 * Zgłoszenie błędu przez użytkownika.
 *
 * Świadomie JEDNO pole. Każde kolejne (kategoria, powtarzalność, priorytet)
 * odsiewa zgłaszających, a i tak wypełnia się je byle jak — a to, czego
 * naprawdę potrzeba do odtworzenia błędu, dokleja się samo: adres strony,
 * przeglądarka, wersja aplikacji i identyfikator użytkownika (`lib/bledy.ts`).
 *
 * Bez logowania też działa: awaria na stronie meczu otwartej z linku jest
 * dokładnie tym przypadkiem, o którym chcemy wiedzieć.
 */
export default function ZglosBladPage() {
  const [opis, setOpis] = useState('');
  const [wysylanie, setWysylanie] = useState(false);
  const [wyslane, setWyslane] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const wyslij = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlad(null);
    setWysylanie(true);
    try {
      await zglosUwage(opis);
      setWyslane(true);
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Nie udało się wysłać zgłoszenia');
    } finally {
      setWysylanie(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        {wyslane ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <h1 className="font-display text-xl font-bold text-ink">Dzięki — mamy to</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Zgłoszenie trafiło do nas razem z adresem strony i wersją aplikacji,
              więc nie musisz nic dopowiadać.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-800"
            >
              Wróć do Bojo
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-start gap-3">
              <MessageSquareWarning className="mt-0.5 h-6 w-6 shrink-0 text-primary-700" />
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
                  Coś nie działa?
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Napisz, co się stało. Adres strony, przeglądarkę i wersję aplikacji
                  dołączymy automatycznie — nie musisz ich szukać.
                </p>
              </div>
            </div>

            <form onSubmit={wyslij} className="space-y-3">
              <textarea
                value={opis}
                onChange={(e) => setOpis(e.target.value)}
                rows={6}
                maxLength={2000}
                required
                placeholder="Np. „Klikam Dołącz na meczu w czwartek i nic się nie dzieje”."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              {blad && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {blad}
                </p>
              )}
              <button
                type="submit"
                disabled={wysylanie || !opis.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white transition hover:bg-primary-800 active:scale-[0.98] disabled:opacity-60"
              >
                {wysylanie && <Loader2 className="h-4 w-4 animate-spin" />}
                Wyślij zgłoszenie
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
