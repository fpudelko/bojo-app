'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import AuthForm from '@/components/auth/AuthForm';
import LoginBackdrop from '@/components/auth/LoginBackdrop';
import { useAuth } from '@/lib/auth';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || undefined;
  // ?mode=rejestracja przychodzi z przycisku „Dołącz" w nagłówku — otwiera
  // od razu zakładanie konta zamiast logowania.
  const initialMode = params.get('mode') === 'rejestracja' ? 'signup' : 'signin';
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace(next || '/');
  }, [user, loading, next, router]);

  if (loading || user) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    // `relative z-10` — karta musi stanąć nad mgiełką i tłem z listą meczów.
    <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Bez drugiego logo nad kartą — pasek pokazuje je teraz na każdej
            szerokości, a dwa logotypy jeden nad drugim czytały się jak usterka. */}
        {/* Karta ma własne, prawie pełne tło: stoi teraz nad widoczną treścią,
            a półprzezroczysta byłaby nieczytelna. */}
        <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-7 shadow-card-hover backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-800/95 sm:p-8">
          <AuthForm next={next} initialMode={initialMode} />
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Logując się akceptujesz{' '}
          <Link href="/regulamin" className="underline hover:text-slate-700">Regulamin</Link> i{' '}
          <Link href="/prywatnosc" className="underline hover:text-slate-700">Politykę prywatności</Link>.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">
      <Header />
      {/* Pod formularzem realna lista meczów — zamiast pustego tła pokazuje,
          co użytkownik dostanie po zalogowaniu. Całkowicie bierna: patrz
          LoginBackdrop. Mgiełka jest lekka (20% przyciemnienia), żeby listę
          było widać, a nie tylko domyślać się jej pod spodem. */}
      <LoginBackdrop />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black/20 backdrop-blur-[2px]"
      />
      <Suspense fallback={<div className="relative z-10 flex-1" />}>
        <LoginInner />
      </Suspense>
    </div>
  );
}
