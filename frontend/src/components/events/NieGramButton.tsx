'use client';

import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { odmow, cofnijOdmowe, getDeclines } from '@/lib/eventDeclines';

/**
 * Jawne "nie zagram" dla członka ekipy, który jeszcze nie dołączył — cisza
 * w Bojo znaczyła dotąd naraz "nie widziałem" i "odpadam"; ta odmowa jest
 * osobną, widoczną odpowiedzią (`lib/eventDeclines.ts`, tabela
 * `event_declines`, migracja `097`). Widoczne tylko przy meczu przypiętym
 * do grupy — bez grupy pojęcie "kto jeszcze nie odpowiedział" nie ma
 * odbiorcy.
 *
 * PYTANIE JEST CZĘŚCIĄ KOMPONENTU, nie strony (2026-09-09). Sam przycisk
 * „Nie gram" stał bez kontekstu tuż nad przyklejonym paskiem „Dołącz →",
 * więc czytał się jak PLAKIETKA ZE STANEM („nie gram" = nie jestem w
 * składzie) albo druga połowa przełącznika, a jest jednorazową odpowiedzią.
 * Zgłoszone wprost z sesji QA na telefonie. Pytanie musi mieszkać tutaj, bo
 * po odpowiedzi ma zniknąć — na stronie zostałoby nieaktualne, pytając
 * o coś, na co przed chwilą padła odpowiedź.
 */
export default function NieGramButton({ eventId, userId }: { eventId: string; userId: string }) {
  const { toast } = useToast();
  const [odmowilem, setOdmowilem] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDeclines(eventId).then((rows) => setOdmowilem(rows.some((r) => r.userId === userId))).catch(() => setOdmowilem(false));
  }, [eventId, userId]);

  if (odmowilem === null) return null;

  const handleClick = async () => {
    setBusy(true);
    try {
      if (odmowilem) { await cofnijOdmowe(eventId, userId); setOdmowilem(false); }
      else { await odmow(eventId, userId); setOdmowilem(true); toast('Zapisano — dzięki za odpowiedź.'); }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700">
      <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
        {odmowilem
          ? 'Ekipa wie, że tym razem nie zagrasz.'
          : 'Twoja ekipa tu gra. Nie dasz rady?'}
      </p>
      <button
        onClick={handleClick}
        disabled={busy}
        className={[
          'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition disabled:opacity-50',
          odmowilem
            ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
            : 'border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700',
        ].join(' ')}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        {odmowilem ? 'Cofnij odpowiedź' : 'Nie zagram'}
      </button>
    </div>
  );
}
