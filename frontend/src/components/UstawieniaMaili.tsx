'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  rodzajeMailowe, pobierzMailWylaczone, zapiszMailWylaczone, przelacz,
} from '@/lib/ustawieniaPowiadomien';

/**
 * Czego NIE wysyłać mailem (migracja `140`).
 *
 * DLACZEGO OSOBNY KOMPONENT, A NIE DRUGA KOLUMNA W `PowiadomieniaPush`.
 * Tamten panel renderuje listę rodzajów wyłącznie wtedy, gdy push jest
 * WŁĄCZONY (`stan === 'wlaczone'`) — i słusznie, bo bez zgody przeglądarki nie
 * ma czego ustawiać. Poczta działa niezależnie od tej zgody, więc dołożenie
 * jej tam schowałoby ustawienia przed dokładnie tymi ludźmi, którzy będą je
 * mieli włączone: tymi, którzy pusha nigdy nie włączyli. Kanał, którego nie da
 * się wyłączyć, to kanał, który kończy się przyciskiem „Zgłoś spam" — a to psuje
 * doręczalność WSZYSTKICH maili z domeny, łącznie z tymi o odwołanym meczu.
 *
 * MOBILE-FIRST: jedna kolumna, przełącznik po prawej, opis pod nazwą. Ten sam
 * układ co lista rodzajów pusha, więc oba panele czytają się tak samo.
 */
export default function UstawieniaMaili() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rozwiniete, setRozwiniete] = useState(false);
  const [wylaczone, setWylaczone] = useState<string[] | null>(null);
  // Czy próba pobrania już poszła. BEZ TEGO NIEUDANE POBRANIE ROBI PĘTLĘ:
  // `wylaczone` zostaje `null`, `toast` wywołuje re-render, efekt startuje
  // znowu — i tak w kółko, seria żądań do bazy przy zerowej reakcji ekranu.
  // Ref, nie stan, bo jego zmiana nie ma nic renderować.
  const proba = useRef(false);

  const rodzaje = rodzajeMailowe();

  useEffect(() => {
    if (!user || !rozwiniete || proba.current) return;
    proba.current = true;
    pobierzMailWylaczone(user.id)
      .then(setWylaczone)
      // Porażka zostawia kręciołek i komunikat. Ponowienie następuje przy
      // kolejnym rozwinięciu panelu, nie samo z siebie.
      .catch(() => {
        proba.current = false;
        toast('Nie udało się wczytać ustawień poczty', 'error');
      });
  }, [user, rozwiniete, toast]);

  const przelaczRodzaj = useCallback(async (typ: string, wlaczyc: boolean) => {
    if (!user || wylaczone === null) return;
    const nowa = przelacz(wylaczone, typ, wlaczyc);
    setWylaczone(nowa);   // optymistycznie — przełącznik ma reagować od razu
    try {
      await zapiszMailWylaczone(user.id, nowa);
    } catch {
      setWylaczone(wylaczone);
      toast('Nie udało się zapisać ustawienia', 'error');
    }
  }, [user, wylaczone, toast]);

  if (!user) return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <button
        type="button"
        onClick={() => setRozwiniete((v) => !v)}
        aria-expanded={rozwiniete}
        className="flex w-full items-center gap-3 text-left"
      >
        <Mail className="h-5 w-5 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">Maile o meczu</span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            Wysyłamy je tylko wtedy, gdy niedojście wiadomości kosztowałoby Cię wyjazd na boisko
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${rozwiniete ? 'rotate-180' : ''}`}
        />
      </button>

      {rozwiniete && (
        wylaczone === null ? (
          <div className="flex justify-center py-4 text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <ul className="mt-3 space-y-0.5 border-t border-slate-100 pt-2 dark:border-slate-700">
            {rodzaje.map((r) => {
              const wlaczony = !wylaczone.includes(r.typ);
              return (
                <li key={r.typ}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{r.nazwa}</span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                        {r.opis}
                      </span>
                    </span>
                    <span className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={wlaczony}
                        onChange={(e) => przelaczRodzaj(r.typ, e.target.checked)}
                      />
                      <span className="block h-6 w-10 rounded-full bg-slate-200 transition peer-checked:bg-primary-600 dark:bg-slate-600" />
                      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}
