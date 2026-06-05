'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <div>
          <p className="font-display text-7xl font-extrabold text-red-500 mb-3 select-none">500</p>
          <h1 className="text-xl font-semibold text-ink mb-2">Coś poszło nie tak</h1>
          <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto">
            Wystąpił nieoczekiwany błąd. Możesz spróbować ponownie lub wrócić na stronę główną.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center rounded-xl bg-primary-700 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-800 transition-colors"
            >
              Spróbuj ponownie
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Strona główna
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
