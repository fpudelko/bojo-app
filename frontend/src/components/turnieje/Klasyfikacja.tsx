// Lista klasyfikacji indywidualnej (strzelcy/asystenci/MVP) — czysta prezentacja
// `WpisKlasyfikacji[]` już posortowanych przez `posortujKlasyfikacje()`
// (lib/turniejStatystyki.ts).
import type { WpisKlasyfikacji } from '@/types';

export interface KlasyfikacjaProps {
  wpisy: readonly WpisKlasyfikacji[];
  /** Które pole pokazać jako główną liczbę — musi być to samo, po czym `wpisy` są posortowane. */
  klucz: 'gole' | 'asysty' | 'mvp';
  etykietaKolumny: string;
  pusteMiejsce: string;
  limit?: number;
}

export default function Klasyfikacja({ wpisy, klucz, etykietaKolumny, pusteMiejsce, limit = 10 }: KlasyfikacjaProps) {
  const widoczne = wpisy.filter((w) => w[klucz] > 0).slice(0, limit);

  if (widoczne.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">{pusteMiejsce}</p>;
  }

  return (
    <div className="space-y-1">
      {widoczne.map((w, i) => (
        <div key={w.zawodnikId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm">
          <span className="w-4 shrink-0 text-right text-xs text-slate-400">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-ink">{w.imie}</span>
            <span className="text-slate-400"> · {w.druzynaNazwa}</span>
          </span>
          <span className="shrink-0 font-mono text-sm font-semibold text-ink" title={etykietaKolumny}>{w[klucz]}</span>
        </div>
      ))}
    </div>
  );
}
