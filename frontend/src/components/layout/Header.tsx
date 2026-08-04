'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Menu, X, Plus, LogOut, User, ChevronRight, Search, RefreshCw, Map, Trophy, Settings, Building2, CalendarDays, Users as UsersIcon, BarChart3, Sun, Moon } from 'lucide-react';
import { clsx } from 'clsx';
import { useTheme } from 'next-themes';
import { useAuth, displayName, avatarUrl } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { LogoPill } from '@/components/Logo';
import NotificationBell from './NotificationBell';
import { SHOW_CUP, SHOW_RECURRING } from '@/lib/features';

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

interface HeaderProps {
  /** Przezroczysty pasek nad hero landingu, dopóki nie zescrollujesz i nikt nie jest zalogowany.
   *  Domyślnie false — bez tego propa zachowanie identyczne jak dziś na wszystkich stronach. */
  transparentOverHero?: boolean;
}

export default function Header({ transparentOverHero = false }: HeaderProps = {}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { user, loading, signOut } = useAuth();
  const isAdmin = useAdmin();
  const userAvatar = avatarUrl(user);
  const [hasVenue, setHasVenue] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Send users back to where they were after logging in.
  const loginHref = pathname && pathname !== '/'
    ? `/logowanie?next=${encodeURIComponent(pathname)}`
    : '/logowanie';

  // Transparent-over-hero look: no background/border/shadow, white logo and
  // icons, until the visitor scrolls or turns out to be logged in. Position
  // stays `fixed` for the whole time transparentOverHero is on (not just
  // during the overlay phase) — switching to `sticky` on scroll would make
  // the header start occupying flow height again and shove hero content down
  // by another 64px on top of the pt-16 it already reserves, causing a jump
  // right at the scroll threshold. Staying fixed keeps that offset constant.
  // `!mobileOpen` too: the mobile menu overlay is a solid white sheet behind
  // this header, so white-on-transparent logo/icons would vanish onto it.
  const overlay = transparentOverHero && !scrolled && !user && !mobileOpen;

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
      {/* ── Header bar — fixed+transparent over hero on the landing page, sticky+solid everywhere else ── */}
      <header className={clsx(
        'top-0 z-[1010] transition-[background-color,box-shadow,border-color] duration-200',
        transparentOverHero ? 'fixed w-full' : 'sticky',
        overlay
          ? 'bg-transparent border-b border-transparent'
          : 'bg-white/90 dark:bg-[#0D1117]/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-[#0D1117]/88 border-b border-slate-200/70 dark:border-white/[0.07]',
        scrolled && !overlay && 'shadow-[0_2px_16px_0_rgba(0,0,0,0.08)]',
      )}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <LogoPill variant={overlay ? 'onDark' : 'solid'} />
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Nawigacja główna">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    overlay
                      ? 'text-white/85 hover:text-white hover:bg-white/10'
                      : (pathname === link.href || pathname.startsWith(link.href + '/')
                        ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.06]'),
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {SHOW_CUP && (
                <Link
                  href="/turniej"
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors',
                    pathname === '/turniej' || pathname.startsWith('/turniej/')
                      ? 'bg-accent-100 text-accent-700'
                      : 'text-accent-700 hover:bg-accent-50',
                  )}
                >
                  <Trophy className="w-4 h-4" /> Cup
                </Link>
              )}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {!loading && user && (
                <>
                  <Link
                    href="/moje-gry"
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                      pathname === '/moje-gry'
                        ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.06]',
                    )}
                  >
                    Moje mecze
                  </Link>
                  <Link
                    href="/grupy"
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                      pathname === '/grupy' || pathname.startsWith('/grupy/')
                        ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.06]',
                    )}
                  >
                    Grupy
                  </Link>
                  {SHOW_RECURRING && (
                    <Link
                      href="/cykliczne"
                      className={clsx(
                        'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                        pathname === '/cykliczne' || pathname.startsWith('/cykliczne/')
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                      )}
                    >
                      <RefreshCw className="w-4 h-4" /> Stałe gierki
                    </Link>
                  )}
                  {hasVenue && (
                    <Link
                      href="/obiekt"
                      className={clsx(
                        'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                        pathname === '/obiekt' || pathname.startsWith('/obiekt/')
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                      )}
                    >
                      Moje obiekty
                    </Link>
                  )}
                  {isAdmin && <AdminMenu pathname={pathname} />}
                  {mounted && (
                    <button
                      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                      aria-label={resolvedTheme === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
                      title={resolvedTheme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
                    >
                      {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
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
                    className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 max-w-[140px] truncate flex items-center gap-1.5 transition-colors"
                    title="Edytuj profil"
                  >
                    {userAvatar
                      ? <img src={userAvatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                      : <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                    {displayName(user)}
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                    aria-label="Wyloguj"
                    title="Wyloguj"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
              {!loading && !user && (
                <>
                  {mounted && (
                    <button
                      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                      className={clsx(
                        'p-2 rounded-lg transition-colors',
                        overlay
                          ? 'text-white/80 hover:bg-white/10'
                          : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                      )}
                      aria-label={resolvedTheme === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
                      title={resolvedTheme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
                    >
                      {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                  )}
                  <Link
                    href={loginHref}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-700 text-white hover:bg-primary-800 transition-colors"
                  >
                    Zaloguj się
                  </Link>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 md:hidden">
              {!loading && !user && (
                <Link
                  href={loginHref}
                  className={clsx(
                    'inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors',
                    overlay
                      ? 'bg-white/15 text-white border border-white/25 hover:bg-white/25'
                      : 'bg-primary-700 text-white hover:bg-primary-800',
                  )}
                >
                  Zaloguj się
                </Link>
              )}
              <button
                className={clsx(
                  'p-2 rounded-lg transition-colors',
                  overlay
                    ? 'text-white hover:bg-white/10'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
                onClick={() => setMobileOpen((o) => !o)}
                aria-label={mobileOpen ? 'Zamknij menu' : 'Otwórz menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile menu overlay — OUTSIDE header to avoid backdrop-filter stacking context ── */}
      {mobileOpen && (
        <div id="mobile-nav" ref={mobileMenuRef} role="dialog" aria-modal="true" aria-label="Menu nawigacji" className="md:hidden fixed inset-0 z-[1009] bg-white dark:bg-[#0D1117] flex flex-col pt-16">
          <nav className="flex-1 overflow-y-auto px-4 pt-4 pb-4" aria-label="Nawigacja mobilna">

            {/* Main navigation — uniform rows ("Stwórz mecz" highlighted) */}
            <div className="space-y-1">
              {(() => {
                const items: { href: string; label: string; Icon: typeof Search; primary?: boolean }[] = [
                  { href: '/wydarzenia/nowe', label: 'Stwórz mecz', Icon: Plus, primary: true },
                  { href: '/wydarzenia', label: 'Znajdź mecz', Icon: Search },
                  ...(!loading && user ? [{ href: '/moje-gry', label: 'Moje mecze', Icon: CalendarDays }] : []),
                  ...(!loading && user ? [{ href: '/grupy', label: 'Grupy', Icon: UsersIcon }] : []),
                  { href: '/mapa', label: 'Mapa boisk', Icon: Map },
                  ...(!loading && user && hasVenue ? [{ href: '/obiekt', label: 'Moje obiekty', Icon: Building2 }] : []),
                ];
                return items.map(({ href, label, Icon, primary }) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={clsx(
                        'flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors active:scale-[0.99]',
                        active ? 'bg-primary-50 dark:bg-primary-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                      )}
                    >
                      <span className={clsx(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        primary ? 'bg-primary-700 text-white' : active ? 'bg-primary-100 dark:bg-primary-900 text-primary-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
                      )}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className={clsx('flex-1 text-[15px] font-semibold', primary || active ? 'text-primary-700' : 'text-ink')}>
                        {label}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </Link>
                  );
                });
              })()}
            </div>

            {/* BOJO Cup highlight */}
            {SHOW_CUP && (
              <Link
                href="/turniej"
                onClick={() => setMobileOpen(false)}
                className="mt-5 flex items-center justify-between rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 px-4 py-4 text-white shadow-md active:scale-[0.98] transition-transform"
              >
                <span className="flex items-center gap-3">
                  <Trophy className="h-6 w-6 text-accent-400" />
                  <span>
                    <span className="block text-sm font-bold">BOJO Community Cup</span>
                    <span className="block text-xs text-white/70">Zgłoś drużynę do turnieju</span>
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 text-white/60" />
              </Link>
            )}

            {/* Admin section */}
            {!loading && user && isAdmin && (
              <div className="mt-6">
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Admin</p>
                <div className="space-y-1">
                  {ADMIN_LINKS.map(({ href, label, Icon }) => {
                    const active = pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={clsx(
                          'flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors active:scale-[0.99]',
                          active ? 'bg-primary-50 dark:bg-primary-950/50' : 'hover:bg-slate-50 dark:hover:bg-white/[0.05]',
                        )}
                      >
                        <span className={clsx(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          active ? 'bg-primary-100 dark:bg-primary-900 text-primary-700' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400',
                        )}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className={clsx('flex-1 text-[15px] font-semibold', active ? 'text-primary-700' : 'text-ink')}>
                          {label}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          <div className="border-t border-slate-200/70 dark:border-white/[0.07] px-5 py-5">
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
                {mounted && (
                  <button
                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    className="ml-1 shrink-0 rounded-xl p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label={resolvedTheme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
                  >
                    {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                )}
                <button
                  onClick={() => { setMobileOpen(false); signOut(); }}
                  className="ml-1 shrink-0 rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Wyloguj"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
            {!loading && !user && (
              <div className="flex items-center gap-2">
                {mounted && (
                  <button
                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    className="shrink-0 rounded-xl p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label={resolvedTheme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
                  >
                    {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                )}
                <Link
                  href={loginHref}
                  onClick={() => setMobileOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-700 py-4 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
                >
                  Zaloguj się
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const ADMIN_LINKS = [
  { href: '/admin/analityka', label: 'Analityka',            Icon: BarChart3 },
  { href: '/admin/przeglad',  label: 'Przegląd boisk',      Icon: Building2 },
  { href: '/admin/moderacja', label: 'Moderacja boisk',      Icon: Building2 },
  { href: '/admin/outreach',  label: 'Kontakt z obiektami',  Icon: Building2 },
  { href: '/admin/uzytkownicy', label: 'Użytkownicy',        Icon: UsersIcon },
];

/** Admin tools tucked behind a small gear menu so they don't clutter the
 *  main nav (and admins see the same bar a normal user does). */
function AdminMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = pathname.startsWith('/admin');

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
          active ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.06]',
        )}
        aria-label="Narzędzia administratora"
        aria-expanded={open}
        title="Admin"
      >
        <Settings className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#161C27] py-1.5 shadow-card-hover dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)] z-[1020]">
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Admin</p>
          {ADMIN_LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                pathname.startsWith(href) ? 'text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]',
              )}
            >
              <Icon className="w-4 h-4 text-slate-400" /> {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
