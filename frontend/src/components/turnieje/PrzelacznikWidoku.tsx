'use client';
// Przełącznik widoku organizator / uczestnik (`useWidokUczestnika`). Pokazuje
// się WYŁĄCZNIE komuś, kto naprawdę zarządza turniejem albo prowadzi mecz.
import { Eye, Settings } from 'lucide-react';

export default function PrzelacznikWidoku({ jakoUczestnik, onZmiana }: {
  jakoUczestnik: boolean;
  onZmiana: (jakoUczestnik: boolean) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800" role="group" aria-label="Widok strony">
      {([[false, 'Organizator', Settings], [true, 'Uczestnik', Eye]] as const).map(([w, etykieta, Ikona]) => (
        <button
          key={etykieta}
          type="button"
          onClick={() => onZmiana(w)}
          aria-pressed={jakoUczestnik === w}
          className={`inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 ${
            jakoUczestnik === w ? 'bg-white text-ink shadow-sm dark:bg-slate-700' : 'text-slate-500'
          }`}
        >
          <Ikona className="h-3.5 w-3.5" aria-hidden /> {etykieta}
        </button>
      ))}
    </div>
  );
}
