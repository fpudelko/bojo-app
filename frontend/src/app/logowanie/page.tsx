'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import AuthForm from '@/components/auth/AuthForm';
import { useAuth } from '@/lib/auth';
import { LogoPill } from '@/components/Logo';

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
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center sm:hidden">
          <Link href="/"><LogoPill /></Link>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-card-hover sm:p-8">
          <AuthForm next={next} initialMode={initialMode} />
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          Logując się akceptujesz{' '}
          <Link href="/regulamin" className="underline hover:text-slate-600">Regulamin</Link> i{' '}
          <Link href="/prywatnosc" className="underline hover:text-slate-600">Politykę prywatności</Link>.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <Suspense fallback={<div className="flex-1" />}>
        <LoginInner />
      </Suspense>
    </div>
  );
}
