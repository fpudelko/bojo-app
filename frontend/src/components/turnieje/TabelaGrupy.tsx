// Tabela ligowa/grupowa — czysta prezentacja `WierszTabeli[]` już posortowanych
// przez `posortujTabele()` (lib/turniejTabela.ts). Kolumny skrócone (M/Z/R/P/B/Pkt)
// z pełnym opisem w `title`, żeby zmieściła się na najmniejszym telefonie bez
// przewijania w bok.
import type { WierszTabeli } from '@/types';

export interface TabelaGrupyProps {
  wiersze: readonly WierszTabeli[];
  /**
   * Ile pierwszych miejsc awansuje — podświetla wiersz i dokłada pionowy pasek
   * przy pozycji.
   *
   * SAM ZNACZNIK NIE WYSTARCZA: tło mówi „te wiersze są inne" i zostawia
   * czytającego z pytaniem, czym inne. Podpis dokłada WYWOŁUJĄCY, raz pod
   * kompletem tabel (`opisAwansu()` w `lib/turniejTabela.ts`) — powtórzony przy
   * każdej grupie czytałby się jak informacja o tej jednej grupie.
   */
  awansujeZGrupy?: number;
}

export default function TabelaGrupy({ wiersze, awansujeZGrupy }: TabelaGrupyProps) {
  if (wiersze.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Jeszcze żaden mecz nie został rozegrany.</p>;
  }

  // Znacznik ma sens tylko wtedy, gdy KTOŚ ODPADA. Przy grupie trzyosobowej,
  // z której awansuje trójka, podświetlenie całej tabeli nie niesie informacji.
  const miejscaAwansu = awansujeZGrupy && awansujeZGrupy < wiersze.length ? awansujeZGrupy : 0;
  const awansuje = (i: number) => i < miejscaAwansu;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-400">
            <th className="px-2 py-2 text-left font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">Drużyna</th>
            <th className="px-1.5 py-2 text-center font-medium" title="Mecze">M</th>
            <th className="px-1.5 py-2 text-center font-medium" title="Zwycięstwa">Z</th>
            <th className="px-1.5 py-2 text-center font-medium" title="Remisy">R</th>
            <th className="px-1.5 py-2 text-center font-medium" title="Porażki">P</th>
            <th className="px-1.5 py-2 text-center font-medium" title="Bilans bramek">B</th>
            <th className="px-2 py-2 text-center font-medium" title="Punkty">Pkt</th>
          </tr>
        </thead>
        <tbody>
          {wiersze.map((w, i) => (
            <tr
              key={w.druzynaId}
              className={[
                'border-b border-slate-50 dark:border-slate-700/60 last:border-0',
                awansuje(i) ? 'bg-primary-50/50 dark:bg-primary-950/20' : '',
              ].join(' ')}
            >
              <td
                className={[
                  'px-2 py-2 text-slate-400',
                  // Pasek przy numerze pozycji, nie obwódka wiersza: `border` na
                  // `<tr>` nie rysuje się przy `border-collapse`, a pasek działa
                  // też dla kogoś, kto nie odróżnia bladego tła od białego.
                  awansuje(i) ? 'border-l-[3px] border-primary-600 font-semibold text-primary-700 dark:text-primary-400' : '',
                ].join(' ')}
              >
                {i + 1}
              </td>
              <td className="min-w-0 max-w-[9rem] truncate px-2 py-2 font-medium text-ink">
                {w.nazwa}
                {w.rozstrzygnietyRecznie && <span className="ml-1 text-xs text-slate-400" title="Pozycja ustawiona ręcznie">*</span>}
              </td>
              <td className="px-1.5 py-2 text-center text-slate-600 dark:text-slate-300">{w.mecze}</td>
              <td className="px-1.5 py-2 text-center text-slate-600 dark:text-slate-300">{w.wygrane}</td>
              <td className="px-1.5 py-2 text-center text-slate-600 dark:text-slate-300">{w.remisy}</td>
              <td className="px-1.5 py-2 text-center text-slate-600 dark:text-slate-300">{w.przegrane}</td>
              <td className="px-1.5 py-2 text-center text-slate-600 dark:text-slate-300">
                {w.bramkiZdobyte}:{w.bramkiStracone}
              </td>
              <td className="px-2 py-2 text-center font-semibold text-ink">{w.punkty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
