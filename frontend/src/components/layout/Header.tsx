'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Menu, X, Plus, LogOut, User, ChevronRight, Search, RefreshCw, Map } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth, displayName, avatarUrl } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { LogoPill } from '@/components/Logo';
import NotificationBell from './NotificationBell';

// Ordered by user-journey priority: discover → map
const NAV_LINKS = [
  { href: '/wydarzenia', label: 'Znajdź grę' },
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

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { user, loading, signOut } = useAuth();
  const isAdmin = useAdmin();
  const userAvatar = avatarUrl(user);
  const [hasVenue, setHasVenue] = useState(false);

  // Send users back to where they were after logging in.
  const loginHref = pathname && pathname !== '/'
    ? `/logowanie?next=${encodeURIComponent(pathname)}`
    : '/logowanie';

  useEffect(() => {
    if (!user) { setHasVenue(false); return; }
    supabase
      .from('fields')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', user.id)
      .then(({ count }) => setHasVenue((count ?? 0) > 0));
  }, [user]);

  // Focus trap + scroll lock for mobile menu
  useEffect(() => {
    if (!mobileOpen) return;

    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMobileOpen(false); return; }
      if (e.key !== 'Tab') return;

      const el = mobileMenuRef.current;
      if (!el) return;
      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => !n.closest('[hidden]'));

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* ── Sticky header bar ── */}
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
                  {isAdmin && (
                    <Link
                      href="/admin/outreach"
                      className={clsx(
                        'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        pathname.startsWith('/admin/outreach')
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                      )}
                    >
                      Kontakt z obiektami
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      href="/admin/uzytkownicy"
                      className={clsx(
                        'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        pathname.startsWith('/admin/uzytkownicy')
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                      )}
                    >
                      Użytkownicy
                    </Link>
                  )}
                  <NotificationBell />
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
                <Link
                  href={loginHref}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-700 text-white hover:bg-primary-800 transition-colors"
                >
                  Zaloguj się
                </Link>
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
      </header>

      {/* ── Mobile menu overlay — OUTSIDE header to avoid backdrop-filter stacking context ── */}
      {mobileOpen && (
        <div ref={mobileMenuRef} role="dialog" aria-modal="true" aria-label="Menu nawigacji" className="md:hidden fixed inset-0 z-[1009] bg-white flex flex-col pt-16">
          <nav className="flex-1 overflow-y-auto px-5 pt-5 pb-4" aria-label="Nawigacja mobilna">

            {/* Primary actions — player vs organizer */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Link
                href="/wydarzenia"
                onClick={() => setMobileOpen(false)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 px-3 py-5 text-sm font-semibold text-amber-800 active:scale-[0.97] transition-transform"
              >
                <Search className="w-6 h-6 text-amber-600" />
                Znajdź grę
              </Link>
              <Link
                href="/wydarzenia/nowe"
                onClick={() => setMobileOpen(false)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-primary-700 px-3 py-5 text-sm font-semibold text-white shadow-md active:scale-[0.97] transition-transform"
              >
                <Plus className="w-6 h-6" />
                Stwórz mecz
              </Link>
            </div>

            {/* Secondary nav */}
            <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Odkryj</p>
            {[
              { href: '/mapa', label: 'Mapa boisk', Icon: Map },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'flex items-center justify-between py-3.5 border-b border-slate-100 text-sm font-medium transition-colors',
                  pathname === href || pathname.startsWith(href + '/') ? 'text-primary-700' : 'text-ink',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-slate-400" />
                  {label}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>
            ))}

            {/* User-specific section */}
            {!loading && user && (
              <>
                <p className="mt-5 mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Twoje</p>
                <Link
                  href="/moje-gry"
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'flex items-center justify-between py-3.5 border-b border-slate-100 text-sm font-medium',
                    pathname === '/moje-gry' ? 'text-primary-700' : 'text-ink',
                  )}
                >
                  Moje gry
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </Link>
                <Link
                  href="/cykliczne"
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'flex items-center justify-between py-3.5 border-b border-slate-100 text-sm font-medium',
                    pathname === '/cykliczne' || pathname.startsWith('/cykliczne/') ? 'text-primary-700' : 'text-ink',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                    Stałe gierki
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </Link>
                {hasVenue && (
                  <Link
                    href="/obiekt"
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'flex items-center justify-between py-3.5 border-b border-slate-100 text-sm font-medium',
                      pathname.startsWith('/obiekt') ? 'text-primary-700' : 'text-ink',
                    )}
                  >
                    Moje obiekty
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </Link>
                )}
                {isAdmin && (
                  <>
                    <p className="mt-5 mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Admin</p>
                    <Link
                      href="/admin/outreach"
                      onClick={() => setMobileOpen(false)}
                      className={clsx(
                        'flex items-center justify-between py-3.5 border-b border-slate-100 text-sm font-medium',
                        pathname.startsWith('/admin/outreach') ? 'text-primary-700' : 'text-ink',
                      )}
                    >
                      Kontakt z obiektami
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </Link>
                    <Link
                      href="/admin/uzytkownicy"
                      onClick={() => setMobileOpen(false)}
                      className={clsx(
                        'flex items-center justify-between py-3.5 border-b border-slate-100 text-sm font-medium',
                        pathname.startsWith('/admin/uzytkownicy') ? 'text-primary-700' : 'text-ink',
                      )}
                    >
                      Użytkownicy
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </Link>
                  </>
                )}
              </>
            )}
          </nav>

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
                        <User className="w-4 h-4 text-primary-700" />
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
              <Link
                href={loginHref}
                onClick={() => setMobileOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 py-4 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
              >
                Zaloguj się
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
