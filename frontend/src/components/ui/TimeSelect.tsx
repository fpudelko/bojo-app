'use client';

/**
 * Compact HH:MM picker built from two <select> dropdowns.
 *
 * Native <input type="time"> opens the OS clock dialog, which on some Android
 * browsers overflows the viewport (the "Ustaw" button ends up off-screen).
 * Two selects render as a short native list/wheel that always fits.
 */
interface TimeSelectProps {
  value: string;                 // "HH:MM" or "" when empty
  onChange: (value: string) => void;
  className?: string;
  /** Allow an empty selection (e.g. optional end time). */
  allowEmpty?: boolean;
  minuteStep?: number;           // default 5
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function TimeSelect({
  value,
  onChange,
  className,
  allowEmpty = false,
  minuteStep = 5,
}: TimeSelectProps) {
  const valid = /^\d{2}:\d{2}$/.test(value);
  const [h, m] = valid ? value.split(':') : ['', ''];

  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const minutes: string[] = [];
  for (let i = 0; i < 60; i += minuteStep) minutes.push(pad(i));
  // Keep a loaded off-step minute (e.g. "43") selectable.
  if (m && !minutes.includes(m)) minutes.push(m);
  minutes.sort();

  const setHour = (nh: string) => {
    if (!nh) { onChange(''); return; }
    onChange(`${nh}:${m || '00'}`);
  };
  const setMinute = (nm: string) => {
    onChange(`${h || '18'}:${nm}`);
  };

  const selectCls =
    'border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 tabular-nums';

  return (
    <div className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <select value={h} onChange={(e) => setHour(e.target.value)} className={selectCls} aria-label="Godzina">
        {allowEmpty && <option value="">--</option>}
        {hours.map((hh) => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="font-semibold text-slate-400">:</span>
      <select value={m} onChange={(e) => setMinute(e.target.value)} className={selectCls} aria-label="Minuta" disabled={allowEmpty && !h}>
        {(allowEmpty && !h) && <option value="">--</option>}
        {minutes.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  );
}
