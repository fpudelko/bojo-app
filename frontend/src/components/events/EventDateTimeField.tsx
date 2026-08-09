'use client';

import TimeSelect from '@/components/ui/TimeSelect';

const CZASY_GRY = [30, 45, 60, 75, 90, 105, 120, 150, 180];

/** HH:MM plus N minutes; null when it would roll past midnight (no end time then). */
export function addMinutes(time: string, minutes: number): string | null {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Data + Rozpoczęcie + Czas gry (czas trwania, nie surowa godzina końca —
 * koniec jest zawsze pochodną `time + durationMin`, więc nigdy nie da się tu
 * ustawić końca przed początkiem). Wspólne dla kreatora (`wydarzenia/nowe`)
 * i edycji wydarzenia — edycja miała dotąd osobne pole „Zakończenie”,
 * niezależne od godziny startu.
 */
export default function EventDateTimeField({
  date, setDate,
  time, setTime,
  durationMin, setDurationMin,
  czasWlasny, setCzasWlasny,
  dateError,
  inputCls,
}: {
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  durationMin: number;
  setDurationMin: (v: number) => void;
  czasWlasny: boolean;
  setCzasWlasny: (v: boolean) => void;
  dateError?: string;
  inputCls: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
        <input
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className={[inputCls, dateError ? 'border-red-400 ring-1 ring-red-400' : ''].join(' ')}
        />
        {dateError && (
          <p data-field-error className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1">
            <span aria-hidden>⚠</span> {dateError}
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Rozpoczęcie</label>
        <TimeSelect value={time} onChange={setTime} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Czas gry</label>
        {/* Lista zaczyna się od 30 minut, bo nie każdy sport gra 90. Ostatnia
            pozycja przełącza na wpisywanie wprost — treningi i turnieje mają
            czasy, których żadna lista nie odgadnie. */}
        {czasWlasny ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={600}
              step={5}
              value={durationMin}
              onChange={(e) => setDurationMin(Math.max(5, Number(e.target.value) || 0))}
              className={inputCls}
              autoFocus
            />
            <span className="shrink-0 text-sm text-slate-500">min</span>
            <button
              type="button"
              onClick={() => { setCzasWlasny(false); setDurationMin(90); }}
              className="shrink-0 text-xs font-medium text-slate-500 underline hover:text-slate-700"
            >
              z listy
            </button>
          </div>
        ) : (
          <select
            value={CZASY_GRY.includes(durationMin) ? durationMin : 'wlasny'}
            onChange={(e) => {
              if (e.target.value === 'wlasny') { setCzasWlasny(true); return; }
              setDurationMin(Number(e.target.value));
            }}
            className={inputCls}
          >
            {CZASY_GRY.map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
            <option value="wlasny">Inny — wpisz…</option>
          </select>
        )}
        {addMinutes(time, durationMin) && (
          <p className="mt-1 text-xs text-slate-500">Koniec o {addMinutes(time, durationMin)}</p>
        )}
      </div>
    </div>
  );
}
