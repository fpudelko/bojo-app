'use client';

/** Jeden punkt na osi (nie zakres z dwoma uchwytami) — etykieta z wartością nad
 *  suwakiem, opisy skrajów pod spodem. Wzorzec przeniesiony z suwaka promienia
 *  alertu (AlertSetupDialog), tylko sparametryzowany do reużycia w kilku filtrach. */
export default function RangeSlider({
  label, min, max, step = 1, value, onChange, formatValue, minLabel, maxLabel,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  formatValue: (v: number) => string;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span className="font-semibold text-ink">{formatValue(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary-700"
        aria-label={label}
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
