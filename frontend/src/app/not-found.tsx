import Link from 'next/link';
import Header from '@/components/layout/Header';

export const metadata = { title: '404 — Nie znaleziono' };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <div>
          {/* DEMO: zmiana wyłącznie po to, żeby raport ze zrzutami miał co
              pokazać. Ten PR nie idzie do mastera. */}
          <p className="font-display text-8xl font-extrabold text-accent-500 mb-3 select-none">404</p>
          <h1 className="text-2xl font-semibold text-ink mb-2">Nie ma takiej strony</h1>
          <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto">
            Ten adres nigdy nie istniał albo zmienił się po drodze.
          </p>
          <Link
            href="/"
            className="inline-flex items-center rounded-xl bg-primary-700 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-800 transition-colors"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </main>
    </div>
  );
}
