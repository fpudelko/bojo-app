// Przerwa w terminarzu (migracja 176): z nazwą od organizatora („Konkurs
// obijania poprzeczki”) albo wyliczona z odstępu między meczami („Przerwa”).
// Szary, bo to zaplanowana, zamknięta droga, nie błąd ani nowość
// (AGENTS.md, „Kolorystyka niesie stałe znaczenie”).
import { Coffee } from 'lucide-react';

export interface WierszPrzerwyProps {
  od: string;
  do: string;
  nazwa?: string;
  opis?: string;
  /** Panel organizatora: „Nazwij” przy wyliczonej, „Edytuj” przy nazwanej. */
  akcja?: { etykieta: string; onClick: () => void };
}

export default function WierszPrzerwy({ od, do: doGodz, nazwa, opis, akcja }: WierszPrzerwyProps) {
  if (!nazwa) {
    return (
      <div className="flex items-center justify-center gap-2 py-1 text-xs font-medium text-slate-400">
        <span>Przerwa {od}–{doGodz}</span>
        {akcja && (
          <button type="button" onClick={akcja.onClick} className="font-medium text-primary-600">
            {akcja.etykieta}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5">
      <Coffee className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{od}–{doGodz}</p>
        <p className="break-words text-sm font-semibold text-ink">{nazwa}</p>
        {opis && <p className="mt-0.5 whitespace-pre-line break-words text-xs text-slate-600 dark:text-slate-300">{opis}</p>}
      </div>
      {akcja && (
        <button type="button" onClick={akcja.onClick} className="shrink-0 text-xs font-medium text-primary-600">
          {akcja.etykieta}
        </button>
      )}
    </div>
  );
}
