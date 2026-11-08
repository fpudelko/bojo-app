// Zasady gry turnieju — wspólne pola kreatora i panelu organizatora.
//
// Do 2026-11-08 kreator wpisywał czas meczu (15) i przerwę (5) na sztywno,
// a punktacja, mecz o 3. miejsce i liczba awansujących z grupy szły
// z domyślnych wartości bazy. Ani kreator, ani panel nie miał na nie pola,
// a strona turnieju i tak pokazywała je w „Zasadach" jak decyzję organizatora.
// Komponent jest „głupi": trzyma wyłącznie pola, zapis robi wywołujący
// (kreator przy „Utwórz turniej", panel z potwierdzeniem „Zapisano").
import type { TurniejFormat } from '@/types';

export interface WartosciZasad {
  czasMeczuMin: number;
  przerwaMin: number;
  punktyZaWygrana: number;
  punktyZaRemis: number;
  awansujeZGrupy: number;
  meczO3Miejsce: boolean;
}

export const DOMYSLNE_ZASADY: WartosciZasad = {
  czasMeczuMin: 15,
  przerwaMin: 5,
  punktyZaWygrana: 3,
  punktyZaRemis: 1,
  awansujeZGrupy: 2,
  meczO3Miejsce: false,
};

/** Granice z CHECK-ów w migracji `145` — pole nie ma prawa wysłać czegoś, co baza odrzuci. */
export const GRANICE_ZASAD: Record<Exclude<keyof WartosciZasad, 'meczO3Miejsce'>, [number, number]> = {
  czasMeczuMin: [5, 120],
  przerwaMin: [0, 60],
  punktyZaWygrana: [1, 5],
  punktyZaRemis: [0, 3],
  awansujeZGrupy: [1, 8],
};

export function przytnijZasade(pole: keyof typeof GRANICE_ZASAD, wartosc: number): number {
  const [min, max] = GRANICE_ZASAD[pole];
  if (!Number.isFinite(wartosc)) return min;
  return Math.min(max, Math.max(min, Math.round(wartosc)));
}

const inputCls =
  'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';

export interface ZasadyGryProps {
  format: TurniejFormat;
  wartosci: WartosciZasad;
  onChange: (zmiana: Partial<WartosciZasad>) => void;
  /** Wołane po zakończeniu edycji pola (blur, przełącznik) — panel zapisuje tu. */
  onZatwierdz?: (zmiana: Partial<WartosciZasad>) => void;
  disabled?: boolean;
}

export default function ZasadyGry({ format, wartosci, onChange, onZatwierdz, disabled }: ZasadyGryProps) {
  const maTabele = format === 'liga' || format === 'grupy_puchar';
  const maDrabinke = format === 'puchar' || format === 'grupy_puchar';

  const pole = (klucz: keyof typeof GRANICE_ZASAD, etykieta: string, jednostka?: string) => (
    <div>
      <label className={labelCls} htmlFor={`zasada-${klucz}`}>{etykieta}</label>
      <div className="relative">
        <input
          id={`zasada-${klucz}`}
          type="number"
          inputMode="numeric"
          min={GRANICE_ZASAD[klucz][0]}
          max={GRANICE_ZASAD[klucz][1]}
          value={Number.isFinite(wartosci[klucz]) ? wartosci[klucz] : ''}
          disabled={disabled}
          onChange={(e) => onChange({ [klucz]: e.target.value === '' ? NaN : Number(e.target.value) })}
          onBlur={() => {
            const przyciete = przytnijZasade(klucz, wartosci[klucz]);
            onChange({ [klucz]: przyciete });
            onZatwierdz?.({ [klucz]: przyciete });
          }}
          className={`${inputCls} ${jednostka ? 'pr-12' : ''}`}
        />
        {jednostka && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">{jednostka}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {pole('czasMeczuMin', 'Czas meczu', 'min')}
        {pole('przerwaMin', 'Przerwa między meczami', 'min')}
      </div>
      {maTabele && (
        <div className="grid grid-cols-2 gap-3">
          {pole('punktyZaWygrana', 'Punkty za wygraną')}
          {pole('punktyZaRemis', 'Punkty za remis')}
        </div>
      )}
      {format === 'grupy_puchar' && pole('awansujeZGrupy', 'Ile drużyn wychodzi z grupy')}
      {maDrabinke && (
        <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={wartosci.meczO3Miejsce}
            disabled={disabled}
            onChange={(e) => {
              onChange({ meczO3Miejsce: e.target.checked });
              onZatwierdz?.({ meczO3Miejsce: e.target.checked });
            }}
            className="h-4 w-4 rounded border-slate-300"
          />
          Mecz o 3. miejsce
        </label>
      )}
    </div>
  );
}
