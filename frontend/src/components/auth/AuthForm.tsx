'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, User as UserIcon, ArrowLeft, CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

/* ── In-app browser detection ─────────────────────────────────────────────── */
type Platform = 'ios' | 'android' | 'other';
interface InAppInfo { isInApp: boolean; platform: Platform }

function detectInApp(): InAppInfo {
  const ua = navigator.userAgent || '';
  const isInApp = /FBAN|FBAV|FB_IAB|MessengerLite|Instagram|musical_ly|BytedanceWebview|Snapchat|TwitterAndroid|Twitter for iPhone|LinkedInApp/i.test(ua);
  const platform: Platform = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';
  return { isInApp, platform };
}

/* ── Locked Google button with inline hint ────────────────────────────────── */
function GoogleBlockedSection({ platform }: { platform: Platform }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : 'https://bojo.pl/logowanie';
  const browserName = platform === 'ios' ? 'Safari' : 'Chrome';

  const openInBrowser = () => {
    if (platform === 'ios') {
      window.location.href = url.replace(/^https?:\/\//, 'x-safari-https://');
    } else if (platform === 'android') {
      window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { /* clipboard blocked in WebView */ }
  };

  return (
    <div className="mt-5">
      <div className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed select-none">
        <GoogleIcon />
        <span>Kontynuuj z Google</span>
        <span className="text-base leading-none">🔒</span>
      </div>
      <div className="mt-2.5 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3">
        <p className="text-xs font-semibold text-amber-800 mb-1">Google jest zablokowane w tej przeglądarce</p>
        <p className="text-xs text-amber-700 mb-2.5 leading-relaxed">
          Otwórz stronę w {browserName}, żeby zalogować się przez Google — lub użyj e-maila poniżej.
        </p>
        <div className="flex gap-2">
          <button
            onClick={openInBrowser}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800 active:scale-95"
          >
            <ExternalLink className="h-3 w-3" /> Otwórz w {browserName}
          </button>
          <button
            onClick={copyLink}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 active:scale-95"
          >
            {copied ? <><Check className="h-3 w-3 text-green-600" /> Skopiowano</> : <><Copy className="h-3 w-3" /> Skopiuj link</>}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendMagicLink, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [inApp, setInApp] = useState<InAppInfo | null>(null);

  useEffect(() => { setInApp(detectInApp()); }, []);

  const dest = next || '/wydarzenia';

  const switchMode = (m: Mode) => { setMode(m); setError(null); setInfo(null); setPassword(''); };

  const handleGoogle = async () => {
    setError(null);
    try { await signInWithGoogle(next); }
    catch (e) { setError(e instanceof Error ? e.message : 'Nie udało się rozpocząć logowania Google.'); }
  };

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

      {mode !== 'reset' && (
        <div className="mt-5 mb-5">
          {inApp?.isInApp ? (
            <GoogleBlockedSection platform={inApp.platform} />
          ) : (
            <button
              type="button"
              onClick={handleGoogle}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-ink transition-colors hover:bg-slate-50"
            >
              <GoogleIcon /> Kontynuuj z Google
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
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
