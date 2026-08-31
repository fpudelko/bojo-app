'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, User as UserIcon, ArrowLeft, CheckCircle2, Copy, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isPelneImie } from '@/lib/profileName';

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
function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|MessengerLite|Instagram|musical_ly|BytedanceWebview|Snapchat|TwitterAndroid|Twitter for iPhone|LinkedInApp/i.test(ua);
}

/* ── Locked Google button with inline hint ────────────────────────────────── */
/**
 * Wcześniej próbował wymusić skok do Safari/Chrome przez `window.location.href
 * = 'x-safari-https://…'` (iOS) albo intent URI (Android). Zgłoszone wprost
 * z sesji QA: w przeglądarce Instagrama/Facebooka przycisk nic nie robił —
 * te aplikacje celowo blokują nawigację do niestandardowych schematów URL
 * z własnej wbudowanej przeglądarki (nie chcą tracić użytkownika), więc próba
 * ciszy się kończy sukcesem tylko pozornie: kod się wykonuje, nawigacja ginie.
 * Nie ma niezawodnego sposobu w JS, żeby to wymusić z tych konkretnych
 * przeglądarek. Jedyna droga, która faktycznie działa: własne menu „⋯"
 * hosta (Instagram/Facebook/TikTok/Twitter mają wbudowaną opcję „Otwórz
 * w przeglądarce"), więc mówimy o niej wprost zamiast obiecywać przycisk,
 * który nie zadziała. „Skopiuj link" zostaje — to jedyna akcja z tej karty,
 * która realnie działa wszędzie.
 */
function GoogleBlockedSection() {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : 'https://bojo.pl/logowanie';

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
          Ta aplikacja nie pozwala dokończyć logowania Google. Dotknij „⋯" (więcej opcji)
          u góry ekranu i wybierz „Otwórz w przeglądarce" — albo skopiuj link i wklej go
          w Safari/Chrome. Możesz też zalogować się e-mailem poniżej.
        </p>
        <button
          onClick={copyLink}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800 active:scale-95"
        >
          {copied ? <><Check className="h-3 w-3" /> Skopiowano</> : <><Copy className="h-3 w-3" /> Skopiuj link</>}
        </button>
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
  /** Ekran otwierany na starcie. Przycisk „Dołącz" w nagłówku obiecuje
   *  rejestrację, więc musi pokazać formularz zakładania konta, a nie
   *  logowania. Bez tego obietnica z paska rozjeżdża się z tym, co widać. */
  initialMode?: Mode;
}

export default function AuthForm({ next, onSuccess, initialMode }: Props) {
  const router = useRouter();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendMagicLink, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<Mode>(initialMode ?? 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [inApp, setInApp] = useState<boolean | null>(null);

  useEffect(() => { setInApp(isInAppBrowser()); }, []);

  const dest = next || '/';

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
    // Imię i nazwisko sprawdzamy PRZED `setBusy`, żeby nie trzeba było go
    // odkręcać przy wyjściu. Wymóg jest tu, a nie tylko w atrybucie `required`,
    // bo przeglądarka przepuściłaby jednoczłonowe „Jan" — a nazwa idzie na
    // publiczną stronę meczu i ma mówić, kto go organizuje.
    if (mode === 'signup' && !isPelneImie(name)) {
      setError('Podaj imię i nazwisko — nazwisko może być samym inicjałem, np. „Krzysiek W”.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        onSuccess?.();
        router.push(dest);
        router.refresh();
      } else if (mode === 'signup') {
        if (password.length < 6) { setError('Hasło musi mieć co najmniej 6 znaków.'); return; }
        const { needsConfirmation } = await signUpWithEmail(email, password, name, next);
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
          {inApp ? (
            <GoogleBlockedSection />
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
          <div>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Imię i nazwisko" autoComplete="name" required maxLength={40} className={inputCls} />
            </div>
            {/* Podpowiedź mówi WPROST, że inicjał wystarczy. Bez tego pole
                wyglądało na wymagające pełnego nazwiska i człowiek wpisujący
                „Krzysiek W" dostawał odmowę bez wskazówki, co poprawić. */}
            <p className="mt-1 pl-1 text-xs text-slate-500">
              Widoczne dla graczy na Twoich meczach. Nazwisko może być samym inicjałem — „Krzysiek W”.
            </p>
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
            {/* Nad "Nie masz konta?" — najniższa realna bariera logowania
                (nie trzeba pamiętać hasła), wcześniej ukryta jako mały, szary
                link pod spodem. Świadomie tylko w trybie logowania: magic link
                tworzy konto bez zbierania imienia i nazwiska
                (`sendMagicLink()` nie ustawia `shouldCreateUser: false`),
                a rejestracja hasłem wymaga pełnego imienia — patrz walidacja
                wyżej.

                Etykieta NIE zaczyna się od „Zaloguj się" — od 2026-08-30.
                Zaczynała się tak samo jak przycisk submit tuż nad nią (też
                „Zaloguj się…"), więc ktoś skanujący ekran wzrokiem w
                poszukiwaniu „Zaloguj się" trafiał losowo w jeden z dwóch.
                Zgłoszone wprost z sesji QA. „Wyślij link logowania" to ta sama
                fraza, której używa `submitLabel` po przełączeniu na tryb
                `magic` — nazwa nie zaskakuje, gdy przycisk już to zrobi. */}
            <button onClick={() => switchMode('magic')} className="font-semibold text-primary-700 hover:text-primary-800">
              Wyślij link logowania — bez hasła
            </button>
            <p className="text-slate-500">Nie masz konta?{' '}<button onClick={() => switchMode('signup')} className="font-semibold text-primary-700 hover:text-primary-800">Załóż je</button></p>
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
