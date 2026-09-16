// Drabinka pucharowa — pionowa lista rund na telefonie (jedna kolumna, jak
// wszędzie w tej apce, patrz AGENTS.md „Mobile-first bezwzględnie"), kolumny
// obok siebie od `md:`. ŚWIADOMIE bez rysowanych linii łączących mecze —
// przybliżenie przez wyrównanie w pionie (`justify-around` w każdej kolumnie)
// wystarcza do odczytania drzewka i nie wymaga liczenia współrzędnych SVG
// z pozycji DOM (kruche przy zmianie szerokości ekranu). Możliwe do dołożenia
// później, jeśli okaże się, że czytelność bez linii nie wystarcza.
import { FAZA_LABEL } from '@/lib/turniejEtykiety';
import KartaMeczu from './KartaMeczu';
import type { TurniejMecz } from '@/types';

export interface DrabinkaProps {
  mecze: readonly TurniejMecz[];
  druzynyPoId: Map<string, string>;
  meczePoId: Map<string, TurniejMecz>;
  arenyPoId: Map<string, string>;
  onKlikMeczu?: (meczId: string) => void;
}

export default function Drabinka({ mecze, druzynyPoId, meczePoId, arenyPoId, onKlikMeczu }: DrabinkaProps) {
  const rundy = new Map<number, TurniejMecz[]>();
  for (const m of mecze) {
    const k = m.kolejka ?? 1;
    if (!rundy.has(k)) rundy.set(k, []);
    rundy.get(k)!.push(m);
  }
  const numeryRund = Array.from(rundy.keys()).sort((a, b) => a - b);

  if (numeryRund.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Drabinka jeszcze nie jest wygenerowana.</p>;
  }

  return (
    <div className="space-y-6 md:flex md:gap-4 md:space-y-0 md:overflow-x-auto md:pb-2">
      {numeryRund.map((numer) => {
        const meczeRundy = [...rundy.get(numer)!].sort((a, b) => a.numer - b.numer);
        const faza = meczeRundy[0]?.faza;
        return (
          <div key={numer} className="space-y-2 md:flex md:w-64 md:shrink-0 md:flex-col md:justify-around md:space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {faza ? FAZA_LABEL[faza] : `Runda ${numer}`}
            </h3>
            {meczeRundy.map((m) => (
              <KartaMeczu
                key={m.id}
                mecz={m}
                druzynyPoId={druzynyPoId}
                meczePoId={meczePoId}
                arenyPoId={arenyPoId}
                przygaszona={m.status === 'walkower' && !m.zaplanowanyAt}
                onClick={onKlikMeczu ? () => onKlikMeczu(m.id) : undefined}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
