'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { WARSTWA } from '@/lib/warstwy';

/**
 * Powłoka modala filtrów w stylu Booking: przycisk „Filtry" otwiera to, treść
 * (sekcje) buduje wywołujący jako `children` i sam trzyma stan szkicu — ten
 * komponent nic nie wie o TYM, co filtruje, tylko o TYM, jak to pokazać.
 *
 * Portal do <body>, bo /mapa ma kontener strony z `overflow-hidden`
 * (MapaClient) — modal renderowany w miejscu wywołania zostałby przycięty.
 *
 * Mobile-first: baza to bottom sheet, od `md:` wyśrodkowana karta. Zamykanie
 * (tło / X / Escape) odrzuca szkic — commit robi wyłącznie `onApply` na
 * wywołującym. Bez pełnego focus-trapu, tak jak PillDropdown dziś.
 */
export default function FilterSheet({
  open, onClose, title, children, onApply, onClear, applyLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onApply: () => void | Promise<void>;
  onClear: () => void;
  applyLabel: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className={`fixed inset-0 ${WARSTWA.modal}`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed inset-x-0 bottom-0 ${WARSTWA.modalPanel} flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-xl dark:bg-slate-800
                   md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[80vh] md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 id={titleId} className="text-base font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-semibold text-slate-500 underline hover:text-slate-700 dark:text-slate-400"
          >
            Wyczyść
          </button>
          <button
            type="button"
            onClick={async () => { await onApply(); onClose(); }}
            className="flex-1 rounded-xl bg-primary-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-800"
          >
            {applyLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
