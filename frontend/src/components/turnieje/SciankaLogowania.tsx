// Ściana logowania modułu turniejowego — skład drużyny i statystyki graczy
// widzi wyłącznie zalogowany (migracja `145`, egzekwowane w RLS, nie w UI).
// Wspólna dla karty drużyny i sekcji statystyk: dwa miejsca, jedno zdanie
// wyjaśnienia i jeden przycisk, więc dwie kopie rozjechałyby się przy
// pierwszej zmianie treści.
import Link from 'next/link';
import { Lock } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function SciankaLogowania({ tytul }: { tytul: string }) {
  // `window.location` po montażu, nie `useSearchParams()` — ten hook wywraca
  // build produkcyjny na trasach prerenderowanych (patrz AGENTS.md).
  const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 text-center">
      <Lock className="mx-auto mb-2 h-5 w-5 text-slate-400" />
      <p className="text-sm font-semibold text-ink">{tytul}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Składy i statystyki widzą zalogowani gracze.</p>
      <div className="mt-3 flex flex-col gap-2">
        <Link href={`/logowanie?next=${encodeURIComponent(next)}`}>
          <Button size="sm" className="w-full">Zaloguj się</Button>
        </Link>
      </div>
    </div>
  );
}
