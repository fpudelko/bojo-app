import React from 'react';

// Robocze logo Bojo — zielony zaokrąglony kwadrat, litera "B" geometryczna
// (obie komory to koła) rysowana na linii środkowej boiska z kołem środkowym.
// TODO: podmienić na finalną wersję od grafika.
// SVG jest wbudowane (nie external file) żeby działało jako favicon i inline w headerze bez dodatkowych requestów.

export const LOGO_SVG_STRING = `<svg viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg"><rect width="110" height="110" rx="26" fill="#15663E"/><g stroke="#1E7A4B" stroke-width="3" fill="none"><line x1="0" y1="55" x2="110" y2="55"/><circle cx="57" cy="55" r="31"/></g><path d="M40 33 L40 77 L62 77 Q74 77 74 65.5 Q74 56 64 54.5 Q72 52.5 72 43.5 Q72 33 60 33 Z" fill="#ffffff"/><circle cx="57" cy="46.5" r="4.5" fill="#15663E"/><circle cx="58" cy="63.5" r="4.5" fill="#15663E"/></svg>`;

interface LogoIconProps {
  size?: number;
  className?: string;
}

/** Square icon — used as favicon placeholder and standalone badge */
export function LogoIcon({ size = 32, className }: LogoIconProps) {
  return (
    <svg
      viewBox="0 0 110 110"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="110" height="110" rx="26" fill="#15663E" />
      <g stroke="#1E7A4B" strokeWidth={3} fill="none">
        <line x1="0" y1="55" x2="110" y2="55" />
        <circle cx="57" cy="55" r="31" />
      </g>
      <path
        d="M40 33 L40 77 L62 77 Q74 77 74 65.5 Q74 56 64 54.5 Q72 52.5 72 43.5 Q72 33 60 33 Z"
        fill="#ffffff"
      />
      <circle cx="57" cy="46.5" r="4.5" fill="#15663E" />
      <circle cx="58" cy="63.5" r="4.5" fill="#15663E" />
    </svg>
  );
}

interface LogoWordmarkProps {
  /** 'light' = dark text on light bg (header), 'dark' = white text on dark bg (hero) */
  theme?: 'light' | 'dark';
  className?: string;
  iconSize?: number;
}

/** Icon + "bojo" text — used in footers / dark surfaces */
export function LogoWordmark({ theme = 'light', className, iconSize = 28 }: LogoWordmarkProps) {
  const textColor = theme === 'dark' ? '#ffffff' : '#1A1D21';
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <LogoIcon size={iconSize} />
      <span
        style={{ color: textColor, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}
        className="font-display"
      >
        bojo
      </span>
    </span>
  );
}

interface LogoPillProps {
  className?: string;
  /** 'solid' = zielone tło (domyślne, header na białym); 'onDark' = szklana pigułka do użycia na hero */
  variant?: 'solid' | 'onDark';
}

/** Green pill wordmark — used in header (no separate B icon, avoiding visual double-B) */
export function LogoPill({ className, variant = 'solid' }: LogoPillProps) {
  if (variant === 'onDark') {
    return (
      <span
        className={`inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 font-display text-xl font-bold tracking-tight text-white backdrop-blur-sm ${className ?? ''}`}
        style={{ letterSpacing: '-0.03em', lineHeight: 1 }}
      >
        bojo
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-xl px-3.5 py-2 font-display text-xl font-bold tracking-tight text-white ${className ?? ''}`}
      style={{ background: '#15663E', letterSpacing: '-0.03em', lineHeight: 1 }}
    >
      bojo
    </span>
  );
}
