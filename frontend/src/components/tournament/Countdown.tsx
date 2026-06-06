'use client';

import { useState, useEffect } from 'react';

interface CountdownProps {
  /** ISO date/time the countdown runs to. */
  target: string;
  /** Shown when the target is in the past. */
  endedLabel?: string;
}

function diffParts(target: number) {
  const now = Date.now();
  const ms = Math.max(0, target - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { days, hours, minutes, seconds, done: ms === 0 };
}

const PADS: { key: 'days' | 'hours' | 'minutes' | 'seconds'; label: string }[] = [
  { key: 'days', label: 'dni' },
  { key: 'hours', label: 'godz' },
  { key: 'minutes', label: 'min' },
  { key: 'seconds', label: 'sek' },
];

export default function Countdown({ target, endedLabel = 'Rejestracja zamknięta' }: CountdownProps) {
  const targetMs = new Date(target).getTime();
  const [parts, setParts] = useState(() => diffParts(targetMs));

  useEffect(() => {
    const id = setInterval(() => setParts(diffParts(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (parts.done) {
    return (
      <div className="inline-flex items-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur">
        {endedLabel}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3" role="timer" aria-label="Czas do końca rejestracji">
      {PADS.map(({ key, label }) => (
        <div
          key={key}
          className="flex min-w-[58px] flex-col items-center rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur sm:min-w-[72px] sm:px-4 sm:py-3"
        >
          <span className="font-display text-2xl font-extrabold tabular-nums text-white sm:text-4xl">
            {String(parts[key]).padStart(2, '0')}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60 sm:text-xs">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
