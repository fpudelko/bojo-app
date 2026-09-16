// Karta pojedynczego meczu terminarza — używana na publicznej stronie turnieju
// (zakładka Terminarz) i w panelu organizatora. Reużywana dalej przy drabince
// i stronie drużyny (Etap 2/3), stąd osobny plik zamiast JSX wprost w kliencie.
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MapPin } from 'lucide-react';
import { FAZA_LABEL, STATUS_MECZU } from '@/lib/turniejEtykiety';
import { stronaZwyciezcy } from '@/lib/turniejWynik';
import type { TurniejMecz } from '@/types';

function nazwaSlotu(
  mecz: TurniejMecz,
  strona: 'a' | 'b',
  druzynyPoId: Map<string, string>,
  meczePoId: Map<string, TurniejMecz>,
): string {
  const druzynaId = strona === 'a' ? mecz.druzynaAId : mecz.druzynaBId;
  if (druzynaId) return druzynyPoId.get(druzynaId) ?? '—';

  const zrodloId = strona === 'a' ? mecz.zrodloAMeczId : mecz.zrodloBMeczId;
  const zrodloTyp = strona === 'a' ? mecz.zrodloATyp : mecz.zrodloBTyp;
  const etykietaTyp = zrodloTyp === 'przegrany' ? 'Przegrany' : 'Zwycięzca';
  if (!zrodloId) return 'TBD';
  const zrodlo = meczePoId.get(zrodloId);
  return zrodlo ? `${etykietaTyp} meczu M${zrodlo.numer}` : etykietaTyp;
}

export interface KartaMeczuProps {
  mecz: TurniejMecz;
  druzynyPoId: Map<string, string>;
  meczePoId: Map<string, TurniejMecz>;
  arenyPoId: Map<string, string>;
  /** Wyszarza kartę — używane dla wolnych losów bez czasu w terminarzu. */
  przygaszona?: boolean;
  onClick?: () => void;
}

export default function KartaMeczu({ mecz, druzynyPoId, meczePoId, arenyPoId, przygaszona, onClick }: KartaMeczuProps) {
  const nazwaA = nazwaSlotu(mecz, 'a', druzynyPoId, meczePoId);
  const nazwaB = nazwaSlotu(mecz, 'b', druzynyPoId, meczePoId);
  const status = STATUS_MECZU[mecz.status];
  const rozegrany = mecz.status === 'zakonczony' || mecz.status === 'walkower' || mecz.status === 'trwa';
  let godzina: string | null = null;
  if (mecz.zaplanowanyAt) {
    try { godzina = format(parseISO(mecz.zaplanowanyAt), 'EEEE d.MM, HH:mm', { locale: pl }); } catch { godzina = null; }
  }
  const arena = mecz.arenaId ? arenyPoId.get(mecz.arenaId) : undefined;

  // Kto wygrał, widać po WADZE PISMA, nie po samym wyniku. Bez tego drabinka
  // każe czytającemu porównywać dwie liczby przy każdym meczu z osobna —
  // a przy walkowerze (0:0) i karnych (1:1) porównanie daje złą odpowiedź.
  const zwyciezca = rozegrany && mecz.status !== 'trwa' ? stronaZwyciezcy(mecz) : null;
  const tonDruzyny = (strona: 'a' | 'b') =>
    zwyciezca === strona ? 'font-semibold text-ink'
      : zwyciezca ? 'font-medium text-slate-400'
      : 'font-medium text-ink';
  const karne = mecz.karneA !== undefined && mecz.karneB !== undefined
    ? `k. ${mecz.karneA}:${mecz.karneB}`
    : null;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={[
        'w-full rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-left shadow-sm',
        przygaszona ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>M{mecz.numer} · {FAZA_LABEL[mecz.faza]}</span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${status.ton}`}>{status.label}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className={`min-w-0 flex-1 truncate text-sm ${tonDruzyny('a')}`}>{nazwaA}</span>
        {rozegrany ? (
          <span className="shrink-0 text-center">
            <span className="block font-mono text-sm font-semibold text-ink">{mecz.wynikA}:{mecz.wynikB}</span>
            {karne && <span className="block font-mono text-[10px] leading-tight text-slate-400">{karne}</span>}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-slate-400">vs</span>
        )}
        <span className={`min-w-0 flex-1 truncate text-right text-sm ${tonDruzyny('b')}`}>{nazwaB}</span>
      </div>
      {(godzina || arena) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          {godzina && <span className="capitalize">{godzina}</span>}
          {arena && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {arena}
            </span>
          )}
        </div>
      )}
    </Wrapper>
  );
}
