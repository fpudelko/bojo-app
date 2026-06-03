'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, Plus, LogOut, User, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth, displayName, avatarUrl } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { LogoPill } from '@/components/Logo';

// Ordered by user-journey priority: discover → organize → recurring → map
const NAV_LINKS = [
  { href: '/wydarzenia', label: 'Znajdź grę' },
  { href: '/cykliczne', label: 'Stałe gierki' },
  { href: '/mapa', label: 'Mapa boisk' },
];

/** Team-sports icon: 3 player dots in triangle formation connected by pass lines. */
function TeamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 30" fill="none" className={className} aria-hidden="true">
      {/* Players */}
      <circle cx="16" cy="3.5" r="3.5" fill="currentColor" />
      <circle cx="4"  cy="25"  r="3.5" fill="currentColor" />
      <circle cx="28" cy="25"  r="3.5" fill="currentColor" />
      {/* Pass lines */}
      <line x1="13.5" y1="6.5"  x2="6.5"  y2="22"   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2.5 2.5" />
      <line x1="18.5" y1="6.5"  x2="25.5" y2="22"   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2.5 2.5" />
      <line x1="7.5"  y1="25"   x2="24.5" y2="25"   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2.5 2.5" />
      {/* Ball */}
      <circle cx="16" cy="15" r="2.5" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const userAvatar = avatarUrl(user);
  const [hasVenue, setHasVenue] = useState(false);

  useEffect(() => {
    if (!user) { setHasVenue(false); return; }
    supabase
      .from('fields')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', user.id)
      .then(({ count }) => setHasVenue((count ?? 0) > 0));
  }, [user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={clsx(
      'bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 border-b border-slate-200/70 sticky top-0 z-[1010] transition-shadow duration-200',
      scrolled && 'shadow-[0_2px_16px_0_rgba(0,0,0,0.08)]',
    )}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          <Link href="/" className="hover:opacity-90 transition-opacity">
            <LogoPill />
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Nawigacja główna">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === link.href || pathname.startsWith(link.href + '/')
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {!loading && user && (
              <>
                <Link
                  href="/moje-gry"
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    pathname === '/moje-gry'
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                  )}
                >
                  Moje gry
                </Link>
                {hasVenue && (
                  <Link
                    href="/obiekt"
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      pathname === '/obiekt' || pathname.startsWith('/obiekt/')
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                    )}
                  >
                    Moje obiekty
                  </Link>
                )}
                <Link
                  href="/wydarzenia/nowe"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-primary-700 text-white shadow-sm hover:bg-primary-800 active:scale-[0.97] transition-all"
                >
                  <Plus className="w-4 h-4" /> Wydarzenie
                </Link>
                <Link
                  href="/profil"
                  className="text-sm text-gray-600 hover:text-gray-900 max-w-[140px] truncate flex items-center gap-1.5"
                  title="Edytuj profil"
                >
                  {userAvatar
                    ? <img src={userAvatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                    : <User className="w-3.5 h-3.5 shrink-0 text-gray-400" />}
                  {displayName(user)}
                </Link>
                <button
                  onClick={() => signOut()}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                  aria-label="Wyloguj"
                  title="Wyloguj"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
            {!loading && !user && (
              <button
                onClick={() => signInWithGoogle()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <GoogleIcon /> Zaloguj się
              </button>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Zamknij menu' : 'Otwórz menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[1009] bg-white flex flex-col pt-16">
          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-5 pt-4" aria-label="Nawigacja mobilna">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'flex items-center justify-between py-4 border-b border-slate-100 text-base font-medium transition-colors',
                  pathname === link.href || pathname.startsWith(link.href + '/')
                    ? 'text-primary-700'
                    : 'text-ink',
                )}
              >
                {link.label}
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>
            ))}

            {!loading && user && (
              <>
                <Link
                  href="/moje-gry"
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'flex items-center justify-between py-4 border-b border-slate-100 text-base font-medium',
                    pathname === '/moje-gry' ? 'text-primary-700' : 'text-ink',
                  )}
                >
                  Moje gry
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </Link>
                {hasVenue && (
                  <Link
                    href="/obiekt"
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'flex items-center justify-between py-4 border-b border-slate-100 text-base font-medium',
                      pathname.startsWith('/obiekt') ? 'text-primary-700' : 'text-ink',
                    )}
                  >
                    Moje obiekty
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </Link>
                )}
                <div className="pt-5 pb-2">
                  <Link
                    href="/wydarzenia/nowe"
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 px-4 py-4 text-base font-semibold text-white shadow-sm active:scale-[0.98] transition-transform"
                  >
                    <Plus className="w-5 h-5" /> Stwórz wydarzenie
                  </Link>
                </div>
              </>
            )}
          </nav>

          {/* User / login at bottom */}
          <div className="border-t border-slate-200/70 px-5 py-5">
            {!loading && user && (
              <div className="flex items-center justify-between">
                <Link
                  href="/profil"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 min-w-0"
                >
                  {userAvatar
                    ? <img src={userAvatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <User className="w-4.5 h-4.5 text-primary-700" />
                      </div>
                  }
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{displayName(user)}</p>
                    <p className="text-xs text-slate-500">Edytuj profil</p>
                  </div>
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); signOut(); }}
                  className="ml-3 shrink-0 rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 transition-colors"
                  aria-label="Wyloguj"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
            {!loading && !user && (
              <button
                onClick={() => { setMobileOpen(false); signInWithGoogle(); }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white py-4 text-sm font-semibold text-ink transition-colors hover:bg-slate-50"
              >
                <GoogleIcon /> Zaloguj się przez Google
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
