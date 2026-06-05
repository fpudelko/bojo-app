import Link from 'next/link';
import Header from '@/components/layout/Header';

export const metadata = { title: '404 — Nie znaleziono' };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <div>
          <p className="font-display text-7xl font-extrabold text-primary-700 mb-3 select-none">404</p>
          <h1 className="text-xl font-semibold text-ink mb-2">Nie znaleziono strony</h1>
          <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto">
            Ta strona nie istnieje lub została przeniesiona.
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
