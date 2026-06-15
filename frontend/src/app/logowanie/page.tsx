'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import Header from '@/components/layout/Header';
import AuthForm from '@/components/auth/AuthForm';
import { useAuth } from '@/lib/auth';
import { LogoPill } from '@/components/Logo';

/* ── In-app browser detection ─────────────────────────────────────────────── */
type Platform = 'ios' | 'android' | 'other';
interface InAppInfo { isInApp: boolean; platform: Platform; appName: string }

function detectInApp(): InAppInfo {
  if (typeof navigator === 'undefined') return { isInApp: false, platform: 'other', appName: '' };
  const ua = navigator.userAgent || '';
  const isMessenger  = /FBAN|FBAV|FB_IAB|MessengerLite/i.test(ua);
  const isInstagram  = /Instagram/i.test(ua);
  const isTikTok     = /musical_ly|BytedanceWebview/i.test(ua);
  const isSnapchat   = /Snapchat/i.test(ua);
  const isTwitter    = /TwitterAndroid|Twitter for iPhone/i.test(ua);
  const isLinkedIn   = /LinkedInApp/i.test(ua);
  const isInApp = isMessenger || isInstagram || isTikTok || isSnapchat || isTwitter || isLinkedIn;
  const platform: Platform = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';
  const appName = isMessenger ? 'Messengera' : isInstagram ? 'Instagrama'
    : isTikTok ? 'TikToka' : isSnapchat ? 'Snapchata'
    : isTwitter ? 'X / Twittera' : isLinkedIn ? 'LinkedIn' : 'tej aplikacji';
  return { isInApp, platform, appName };
}

/* ── In-app browser wall ──────────────────────────────────────────────────── */
function InAppBrowserWall({ appName, platform }: { appName: string; platform: Platform }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : 'https://bojo.pl/logowanie';

  const openInBrowser = () => {
    if (platform === 'ios') {
      window.location.href = url.replace(/^https?:\/\//, 'x-safari-https://');
    } else if (platform === 'android') {
      window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback — przeglądarka może blokować clipboard w WebView */
    }
  };

  const browserName = platform === 'ios' ? 'Safari' : 'Chrome';
  const steps = platform === 'ios'
    ? ['Kliknij ···  (trzy kropki) na dole ekranu', `Wybierz „Otwórz w ${browserName}"`]
    : ['Kliknij ···  (trzy kropki) w prawym górnym rogu', `Wybierz „Otwórz w ${browserName}" lub „Otwórz w przeglądarce"`];

  return (
    <div className="w-full max-w-md">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-card-hover sm:p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-3xl">
          🔒
        </div>
        <h2 className="text-lg font-bold text-ink mb-1">Logowanie niedostępne</h2>
        <p className="text-sm text-slate-500 mb-5 leading-relaxed">
          Przeglądarka <strong className="text-slate-700">{appName}</strong> blokuje logowanie przez Google.
          Otwórz bojo.pl w {browserName}, żeby się zalogować.
        </p>

        {/* Numbered steps */}
        <ol className="mb-5 space-y-2 text-left">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        {/* Open button (attempts deep link) */}
        <button
          onClick={openInBrowser}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-primary-800 active:scale-[0.99]"
        >
          <ExternalLink className="h-4 w-4" />
          Otwórz w {browserName}
        </button>

        {/* Copy fallback */}
        <button
          onClick={copyLink}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[0.99]"
        >
          {copied ? <><Check className="h-4 w-4 text-green-600" /> Skopiowano!</> : <><Copy className="h-4 w-4" /> Skopiuj link</>}
        </button>
      </div>
    </div>
  );
}

/* ── Main login inner ─────────────────────────────────────────────────────── */
function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || undefined;
  const { user, loading } = useAuth();
  const [inApp, setInApp] = useState<InAppInfo | null>(null);

  useEffect(() => { setInApp(detectInApp()); }, []);
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

        {inApp?.isInApp ? (
          <InAppBrowserWall appName={inApp.appName} platform={inApp.platform} />
        ) : (
          <>
            <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-card-hover sm:p-8">
              <AuthForm next={next} />
            </div>
            <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
              Logując się akceptujesz{' '}
              <Link href="/regulamin" className="underline hover:text-slate-600">Regulamin</Link> i{' '}
              <Link href="/prywatnosc" className="underline hover:text-slate-600">Politykę prywatności</Link>.
            </p>
          </>
        )}
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
