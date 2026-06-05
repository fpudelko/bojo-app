'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/wydarzenia';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let done = false;

    // The Supabase client auto-detects the session from the URL on load.
    // We just wait for it to materialise, then redirect.
    const finish = () => {
      if (done) return;
      done = true;
      router.replace(next);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish();
    });

    // If nothing arrives in a few seconds, the link was invalid/expired.
    const timer = setTimeout(() => {
      if (!done) setFailed(true);
    }, 6000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [router, next]);

  if (failed) {
    return (
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <AlertCircle className="h-6 w-6 text-amber-600" />
        </div>
        <h1 className="font-display text-xl font-bold text-ink">Link wygasł lub jest nieprawidłowy</h1>
        <p className="mt-2 text-sm text-slate-500">Spróbuj zalogować się ponownie.</p>
        <Link
          href="/logowanie"
          className="mt-6 inline-flex items-center rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"
        >
          Wróć do logowania
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Logujemy Cię…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-slate-300" />}>
        <CallbackInner />
      </Suspense>
    </div>
  );
}
