'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Plus, LogOut, User, Trophy, Settings, Building2, Users as UsersIcon } from 'lucide-react';
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
  const [scrolled, setScrolled] = useState(false);
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
          <div className="flex items-center justify-between md:h-16">
            {/* Mobile header: BOJO centered + user icon */}
            <div className="md:hidden flex items-center h-14 w-full">
              <div className="w-10" />
              <Link href="/" className="flex-1 text-center font-display text-xl font-extrabold text-primary-700 tracking-tight">
                BOJO
              </Link>
              <div className="w-10 flex justify-end">
                {!loading && user && (
                  <Link href="/profil" className="block">
                    {userAvatar
                      ? <img src={userAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                      : <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary-700" />
                        </div>
                    }
                  </Link>
                )}
                {!loading && !user && (
                  <Link href={loginHref} className="text-xs font-semibold text-primary-700 whitespace-nowrap">
                    Zaloguj
                  </Link>
                )}
              </div>
            </div>

            {/* Desktop logo */}
            <Link href="/" className="hidden md:block hover:opacity-90 transition-opacity">
              <LogoPill />
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Nawigacja główna">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    pathname === link.href || pathname.startsWith(link.href + '/')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                  )}
                >
                  {link.label}
                </Link>
              ))}
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
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {!loading && user && (
                <>
                  <Link
                    href="/moje-gry"
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
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
                        'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                        pathname === '/obiekt' || pathname.startsWith('/obiekt/')
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                      )}
                    >
                      Moje obiekty
                    </Link>
                  )}
                  {isAdmin && <AdminMenu pathname={pathname} />}
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

          </div>
        </div>
      </header>
  );
}

const ADMIN_LINKS = [
  { href: '/admin/outreach', label: 'Kontakt z obiektami', Icon: Building2 },
  { href: '/admin/uzytkownicy', label: 'Użytkownicy', Icon: UsersIcon },
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
          active ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
        )}
        aria-label="Narzędzia administratora"
        aria-expanded={open}
        title="Admin"
      >
        <Settings className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-card-hover z-[1020]">
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Admin</p>
          {ADMIN_LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                pathname.startsWith(href) ? 'text-primary-700 bg-primary-50' : 'text-gray-700 hover:bg-gray-50',
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
