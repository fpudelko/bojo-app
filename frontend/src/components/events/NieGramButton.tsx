'use client';

import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { odmow, cofnijOdmowe, getDeclines } from '@/lib/eventDeclines';

/**
 * Jawne "Nie gram" dla członka ekipy, który jeszcze nie dołączył — cisza
 * w Bojo znaczyła dotąd naraz "nie widziałem" i "odpadam"; ta odmowa jest
 * osobną, widoczną odpowiedzią (`lib/eventDeclines.ts`, tabela
 * `event_declines`, migracja `097`). Widoczne tylko przy meczu przypiętym
 * do grupy — bez grupy pojęcie "kto jeszcze nie odpowiedział" nie ma
 * odbiorcy.
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
      {odmowilem ? 'Nie gram — cofnij' : 'Nie gram'}
    </button>
  );
}
