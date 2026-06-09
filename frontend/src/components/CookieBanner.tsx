'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

const KEY = 'bojo_cookie_consent_v1';

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(!localStorage.getItem(KEY)); } catch {}
  }, []);
  if (!open) return null;
  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch {}
    setOpen(false);
  };
  return (
    <div
      role="dialog"
      aria-label="Informacja o cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2 text-sm">
        <span className="flex-1 text-foreground/90">
          Używamy tylko niezbędnych cookies (logowanie). Bez śledzenia, bez reklam.{' '}
          <Link href="/prywatnosc" className="underline underline-offset-2">Szczegóły</Link>
        </span>
        <button
          onClick={dismiss}
          className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800"
        >
          OK
        </button>
        <button
          onClick={dismiss}
          aria-label="Zamknij"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
