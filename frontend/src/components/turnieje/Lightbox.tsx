// Pełnoekranowy podgląd zdjęcia z galerii turnieju. Bez zewnętrznej
// biblioteki — to samo zachowanie co reszta okien w aplikacji: warstwa
// `WARSTWA.modal` (nad dolną nawigacją), blokada przewijania pod spodem,
// Escape i dotknięcie tła zamykają.
'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { WARSTWA } from '@/lib/warstwy';
import { useBlokadaPrzewijania } from '@/lib/blokadaPrzewijania';
import type { TurniejZdjecie } from '@/types';

export interface LightboxProps {
  zdjecia: readonly TurniejZdjecie[];
  /** `null` = zamknięty. */
  indeks: number | null;
  onZmien: (indeks: number) => void;
  onZamknij: () => void;
}

export default function Lightbox({ zdjecia, indeks, onZmien, onZamknij }: LightboxProps) {
  const otwarty = indeks !== null && zdjecia[indeks] !== undefined;
  useBlokadaPrzewijania(otwarty);

  useEffect(() => {
    if (!otwarty || indeks === null) return;
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onZamknij();
      if (e.key === 'ArrowLeft' && indeks > 0) onZmien(indeks - 1);
      if (e.key === 'ArrowRight' && indeks < zdjecia.length - 1) onZmien(indeks + 1);
    };
    window.addEventListener('keydown', klawisz);
    return () => window.removeEventListener('keydown', klawisz);
  }, [otwarty, indeks, zdjecia.length, onZmien, onZamknij]);

  if (!otwarty || indeks === null) return null;

  const zdjecie = zdjecia[indeks];
  const przycisk = 'absolute rounded bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60';

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/90 ${WARSTWA.modal}`}
      onClick={onZamknij}
      role="dialog"
      aria-modal="true"
      aria-label={`Zdjęcie ${indeks + 1} z ${zdjecia.length}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={zdjecie.url}
        alt=""
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onZamknij(); }}
        aria-label="Zamknij"
        className={`${przycisk} right-3`}
        style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <X className="h-5 w-5" />
      </button>

      {indeks > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onZmien(indeks - 1); }}
          aria-label="Poprzednie zdjęcie"
          className={`${przycisk} left-2 top-1/2 -translate-y-1/2`}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {indeks < zdjecia.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onZmien(indeks + 1); }}
          aria-label="Następne zdjęcie"
          className={`${przycisk} right-2 top-1/2 -translate-y-1/2`}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <p
        className="absolute inset-x-0 text-center text-xs text-white/70"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {indeks + 1} / {zdjecia.length}
      </p>
    </div>
  );
}
