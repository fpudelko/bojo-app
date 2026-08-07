'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Plus, LogOut, User, UserCircle, RefreshCw, Map, Trophy, Settings, Sun, Moon } from 'lucide-react';
import { clsx } from 'clsx';
import { useTheme } from 'next-themes';
import { useAuth, displayName, avatarUrl } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { hasManagedVenue } from '@/lib/api';
import { ADMIN_LINKS } from '@/lib/adminLinks';
import { LogoPill } from '@/components/Logo';
import NotificationBell from './NotificationBell';
import { SHOW_CUP, SHOW_RECURRING } from '@/lib/features';

// Ordered by user-journey priority: discover → map
const NAV_LINKS = [
  { href: '/wydarzenia', label: 'Znajdź grę' },
  { href: '/mapa', label: 'Mapa boisk' },
];

interface HeaderProps {
  /** Przezroczysty pasek nad hero landingu, dopóki nie zescrollujesz i nikt nie jest zalogowany.
   *  Domyślnie false — bez tego propa zachowanie identyczne jak dziś na wszystkich stronach. */
  transparentOverHero?: boolean;
}

export default function Header({ transparentOverHero = false }: HeaderProps = {}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
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

  // „Dołącz" prowadzi na ten sam ekran co logowanie, ale otwiera go od razu
  // w trybie zakładania konta — inaczej przycisk obiecuje rejestrację,
  // a pokazuje formularz logowania.
  const registerHref = `${loginHref}${loginHref.includes('?') ? '&' : '?'}mode=rejestracja`;

  // Transparent-over-hero look: no background/border/shadow, white logo and
  // icons, until the visitor scrolls or turns out to be logged in. Position
  // stays `fixed` for the whole time transparentOverHero is on (not just
  // during the overlay phase) — switching to `sticky` on scroll would make
  // the header start occupying flow height again and shove hero content down
  // by another 64px on top of the pt-16 it already reserves, causing a jump
  // right at the scroll threshold. Staying fixed keeps that offset constant.
  const overlay = transparentOverHero && !scrolled && !user;

  useEffect(() => {
    if (!user) { setHasVenue(false); return; }
    hasManagedVenue(user.id).then(setHasVenue).catch(() => {});
  }, [user]);

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
          {/* Zalogowany na mobile dostaje niższy pasek (h-12) bez logo — dolna
              nawigacja pokrywa te same skróty, a logo + hamburger tylko
              dublowały to, co już jest w BottomNav. Desktop bez zmian. */}
          <div className={clsx('flex items-center justify-between', !loading && user ? 'h-12 md:h-16' : 'h-16')}>
            <Link
              href="/"
              className={clsx('hover:opacity-90 transition-opacity', !loading && user && 'hidden md:block')}
            >
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
                  {/* Na desktopie jest miejsce na oba wejścia z nazwami, więc
                      nie chowamy logowania pod ikonę tak jak na telefonie. */}
                  <Link
                    href={loginHref}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                      overlay
                        ? 'text-white/85 hover:text-white hover:bg-white/10'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.06]',
                    )}
                  >
                    Zaloguj się
                  </Link>
                  <Link
                    href={registerHref}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary-700 text-white hover:bg-primary-800 transition-colors"
                  >
                    Dołącz
                  </Link>
                </>
              )}
            </div>

            {/* Klaster mobilny — bez hamburgera w obu stanach.
                Zalogowany: dzwonek + awatar; wszystko, co było w arkuszu
                (Moje mecze, Grupy, profil, motyw, admin, Wyloguj), jest już
                w dolnej nawigacji albo na /profil. Skutek uboczny: dzwonek
                powiadomień, wcześniej wyłącznie w bloku `hidden md:flex`,
                stał się dostępny na telefonie.
                Wylogowany: mapa + Dołącz + awatar (logowanie). Pasek jest tu
                marketingowy, nie nawigacyjny — do /wydarzenia i /wydarzenia/nowe
                prowadzą CTA w treści landingu, klikalny krok „Stwórz mecz”,
                pływający przycisk + oraz linki w stopce. */}
            <div className="ml-auto flex items-center gap-1 md:hidden">
              {!loading && !user && (
                <>
                  <Link
                    href="/mapa"
                    aria-label="Mapa boisk"
                    className={clsx(
                      'p-2 rounded-lg transition-colors',
                      overlay ? 'text-white hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <Map className="w-5 h-5" />
                  </Link>
                  <Link
                    href={registerHref}
                    className={clsx(
                      'inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors',
                      overlay
                        ? 'bg-white/15 text-white border border-white/25 hover:bg-white/25'
                        : 'bg-primary-700 text-white hover:bg-primary-800',
                    )}
                  >
                    Dołącz
                  </Link>
                  <Link
                    href={loginHref}
                    aria-label="Zaloguj się"
                    className={clsx(
                      'p-2 rounded-lg transition-colors',
                      overlay ? 'text-white hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <UserCircle className="w-6 h-6" />
                  </Link>
                </>
              )}
              {!loading && user && (
                <>
                  <NotificationBell />
                  <Link href="/profil" aria-label="Twój profil" className="shrink-0">
                    {userAvatar ? (
                      <img src={userAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
                        {displayName(user).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

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
