'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, Plus, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth, displayName } from '@/lib/auth';

const NAV_LINKS = [
  { href: '/mapa', label: 'Mapa' },
  { href: '/wydarzenia', label: 'Wydarzenia' },
];

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
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-[60]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-gray-900 text-lg hover:text-primary-700 transition-colors"
          >
            <span className="text-2xl" role="img" aria-label="piłka nożna">⚽</span>
            <span>Boiska Poznań</span>
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

          {/* Auth area (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            {!loading && user && (
              <>
                <Link
                  href="/wydarzenia/nowe"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Wydarzenie
                </Link>
                <span className="text-sm text-gray-600 max-w-[140px] truncate">
                  {displayName(user)}
                </span>
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
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4">
          <nav className="flex flex-col gap-1 pt-2" aria-label="Nawigacja mobilna">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                {link.label}
              </Link>
            ))}

            <div className="border-t border-gray-100 mt-2 pt-2">
              {!loading && user && (
                <>
                  <Link
                    href="/wydarzenia/nowe"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-primary-700 bg-primary-50"
                  >
                    <Plus className="w-4 h-4" /> Stwórz wydarzenie
                  </Link>
                  <div className="px-4 py-2 text-xs text-gray-500">{displayName(user)}</div>
                  <button
                    onClick={() => { setMobileOpen(false); signOut(); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="w-4 h-4" /> Wyloguj
                  </button>
                </>
              )}
              {!loading && !user && (
                <button
                  onClick={() => { setMobileOpen(false); signInWithGoogle(); }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <GoogleIcon /> Zaloguj się przez Google
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
