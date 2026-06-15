'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, User as UserIcon, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type Mode = 'signin' | 'signup' | 'magic' | 'reset';

const TITLES: Record<Mode, string> = {
  signin: 'Zaloguj się',
  signup: 'Załóż konto',
  magic: 'Logowanie linkiem',
  reset: 'Reset hasła',
};

interface Props {
  next?: string;
  onSuccess?: () => void;
}

export default function AuthForm({ next, onSuccess }: Props) {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, sendMagicLink, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const dest = next || '/wydarzenia';

  const switchMode = (m: Mode) => { setMode(m); setError(null); setInfo(null); setPassword(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim()) { setError('Podaj adres e-mail.'); return; }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        onSuccess?.();
        router.push(dest);
        router.refresh();
      } else if (mode === 'signup') {
        if (password.length < 6) { setError('Hasło musi mieć co najmniej 6 znaków.'); return; }
        const { needsConfirmation } = await signUpWithEmail(email, password, name);
        if (needsConfirmation) {
          setInfo('Konto utworzone! Wysłaliśmy link potwierdzający na Twój e-mail — kliknij go, aby się zalogować.');
        } else { onSuccess?.(); router.push(dest); router.refresh(); }
      } else if (mode === 'magic') {
        await sendMagicLink(email, next);
        setInfo('Sprawdź skrzynkę — wysłaliśmy link do logowania. Kliknij go na tym urządzeniu.');
      } else if (mode === 'reset') {
        await sendPasswordReset(email);
        setInfo('Jeśli konto istnieje, wysłaliśmy link do ustawienia nowego hasła.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coś poszło nie tak. Spróbuj ponownie.');
    } finally { setBusy(false); }
  };

  const inputCls = 'w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';
  const showPassword = mode === 'signin' || mode === 'signup';
  const submitLabel = mode === 'signin' ? 'Zaloguj się' : mode === 'signup' ? 'Załóż konto' : mode === 'magic' ? 'Wyślij link logowania' : 'Wyślij link resetu';

  if (info && (mode === 'magic' || mode === 'reset' || mode === 'signup')) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="font-display text-xl font-bold text-ink">Sprawdź pocztę</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{info}</p>
        <button onClick={() => switchMode('signin')} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800">
          <ArrowLeft className="h-4 w-4" /> Wróć do logowania
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">{TITLES[mode]}</h2>
      <p className="mt-1 text-sm text-slate-500">
        {mode === 'signin' && 'Wejdź na swoje konto, żeby grać i organizować mecze.'}
        {mode === 'signup' && 'Załóż konto w kilka sekund — wystarczy e-mail.'}
        {mode === 'magic' && 'Wyślemy Ci jednorazowy link — bez hasła.'}
        {mode === 'reset' && 'Podaj e-mail, a wyślemy link do zmiany hasła.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        {mode === 'signup' && (
          <div className="relative">
            <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Imię lub pseudonim (opcjonalnie)" autoComplete="name" maxLength={40} className={inputCls} />
          </div>
        )}
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="twoj@email.pl" autoComplete="email" required className={inputCls} />
        </div>
        {showPassword && (
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Hasło (min. 6 znaków)' : 'Hasło'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} className={inputCls} />
          </div>
        )}
        {mode === 'signin' && (
          <div className="text-right">
            <button type="button" onClick={() => switchMode('reset')} className="text-xs font-medium text-slate-500 hover:text-primary-700">Nie pamiętasz hasła?</button>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
        {info && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">{info}</p>}
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-800 active:scale-[0.98] disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </form>

      <div className="mt-5 space-y-2 text-center text-sm">
        {mode === 'signin' && (
          <>
            <p className="text-slate-500">Nie masz konta?{' '}<button onClick={() => switchMode('signup')} className="font-semibold text-primary-700 hover:text-primary-800">Załóż je</button></p>
            <button onClick={() => switchMode('magic')} className="text-xs font-medium text-slate-500 hover:text-primary-700">Zaloguj się linkiem (bez hasła)</button>
          </>
        )}
        {mode === 'signup' && (
          <p className="text-slate-500">Masz już konto?{' '}<button onClick={() => switchMode('signin')} className="font-semibold text-primary-700 hover:text-primary-800">Zaloguj się</button></p>
        )}
        {(mode === 'magic' || mode === 'reset') && (
          <button onClick={() => switchMode('signin')} className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-primary-700">
            <ArrowLeft className="h-4 w-4" /> Wróć do logowania
          </button>
        )}
      </div>
    </div>
  );
}
