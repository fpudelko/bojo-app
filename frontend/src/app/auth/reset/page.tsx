'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [ready, setReady] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The recovery link signs the user into a temporary session.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasRecovery(!!data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setHasRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Hasło musi mieć co najmniej 6 znaków.'); return; }
    if (password !== confirm) { setError('Hasła nie są takie same.'); return; }
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => router.push('/wydarzenia'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić hasła.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card-hover">
          {!ready ? (
            <div className="flex justify-center py-6 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : done ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h1 className="font-display text-xl font-bold text-ink">Hasło zmienione</h1>
              <p className="mt-2 text-sm text-slate-500">Przekierowujemy Cię do aplikacji…</p>
            </div>
          ) : !hasRecovery ? (
            <div className="text-center">
              <h1 className="font-display text-xl font-bold text-ink">Nieprawidłowy link</h1>
              <p className="mt-2 text-sm text-slate-500">
                Link do resetu hasła wygasł lub jest nieprawidłowy. Poproś o nowy na stronie logowania.
              </p>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Ustaw nowe hasło</h1>
              <p className="mt-1 text-sm text-slate-500">Wpisz nowe hasło do swojego konta.</p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nowe hasło (min. 6 znaków)" autoComplete="new-password" required minLength={6}
                    className={inputCls}
                  />
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Powtórz hasło" autoComplete="new-password" required minLength={6}
                    className={inputCls}
                  />
                </div>
                {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
                <button
                  type="submit" disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-800 active:scale-[0.98] disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Zapisz nowe hasło
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
