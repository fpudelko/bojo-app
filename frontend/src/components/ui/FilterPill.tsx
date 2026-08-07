'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// Pigułki filtrów — wspólne dla mapy boisk (/mapa) i listy meczów
// (/wydarzenia). Wcześniej żyły jako prywatne komponenty w VenueExplorer.tsx;
// przeniesione bez zmiany zachowania, żeby oba widoki filtrowało się tak samo.

/**
 * Rozwijana pigułka filtru.
 *
 * Panel renderowany przez portal do <body>, a nie w miejscu przycisku: pasek
 * filtrów bywa `overflow-x-auto`, co przycięłoby rozwinięte menu. Pozycja
 * liczona z getBoundingClientRect w momencie otwarcia.
 */
// Stała szerokość zamiast min-w: pozwala policzyć bezpieczną pozycję (patrz
// toggle() niżej) zanim panel się w ogóle wyrenderuje — z samym min-w nie da
// się z góry przewidzieć, ile miejsca panel faktycznie zajmie.
const PANEL_WIDTH = 240;

export function PillDropdown({ label, active, children }: {
  label: string;
  active: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Panel ma stałą szerokość (patrz PANEL_WIDTH niżej) — jeśli przycisk
      // stoi blisko prawej krawędzi, wyrównanie do jego lewej krawędzi
      // wypychało panel poza ekran i obcinało kolumnę z ptaszkami wyboru.
      // Zamiast tego panel dosuwa się do prawej krawędzi ekranu z marginesem.
      const margin = 8;
      const left = Math.min(r.left, window.innerWidth - PANEL_WIDTH - margin);
      setPos({ top: r.bottom + 6, left: Math.max(margin, left) });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={[
          'inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-[13px] font-medium shadow-md transition-colors whitespace-nowrap',
          active ? 'border-primary-700 bg-primary-50 text-primary-700' : 'border-slate-200 text-ink',
        ].join(' ')}
      >
        {label}<ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && mounted && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: PANEL_WIDTH, zIndex: 9999 }}
          className="max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl"
        >
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Pigułka włącz/wyłącz — filtr, który jest po prostu wciśnięty albo nie. */
export function TogglePill({ label, icon, active, loading, onClick }: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium shadow-md transition-colors whitespace-nowrap',
        active ? 'border-primary-700 bg-primary-700 text-white' : 'border-slate-200 bg-white text-ink',
      ].join(' ')}
    >
      <span className={loading ? 'animate-pulse' : ''}>{icon}</span>{label}
    </button>
  );
}
