'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Plus, CalendarDays, Users as UsersIcon } from 'lucide-react';
import { clsx } from 'clsx';

function BallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6.5 L10 10 L14 10 Z" />
      <path d="M10 10 L7 11.5 M14 10 L17 11.5 M10 10 L9 13.5 M14 10 L15 13.5 M9 13.5 L12 15 L15 13.5" />
    </svg>
  );
}

const LEFT_ITEMS = [
  { href: '/wydarzenia', label: 'Gry',   Icon: BallIcon },
  { href: '/mapa',       label: 'Mapa',  Icon: Map },
] as const;

const RIGHT_ITEMS = [
  { href: '/moje-gry', label: 'Moje',   Icon: CalendarDays },
  { href: '/grupy',    label: 'Grupy',  Icon: UsersIcon },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  function NavLink({ href, label, Icon }: { href: string; label: string; Icon: React.ComponentType<{ className?: string }> }) {
    const active = pathname === href || (href !== '/wydarzenia' && pathname.startsWith(href + '/'));
    return (
      <Link
        href={href}
        className={clsx(
          'flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-semibold tracking-wide transition-colors',
          active ? 'text-primary-700' : 'text-slate-400 hover:text-slate-600',
        )}
      >
        <Icon className={clsx('w-5 h-5 transition-transform', active && 'scale-110')} />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <>
      {/* Spacer so content is never hidden behind the nav */}
      <div className="h-16 md:hidden" aria-hidden="true" />

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-[1000] bg-white/95 backdrop-blur-sm border-t border-slate-200/70"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Nawigacja dolna"
      >
        <div className="grid grid-cols-5 items-end">
          {LEFT_ITEMS.map((item) => <NavLink key={item.href} {...item} />)}

          {/* Centre FAB — always accessible, can't be deselected */}
          <Link
            href="/wydarzenia/nowe"
            aria-label="Stwórz nowy mecz"
            className="flex flex-col items-center justify-center gap-0.5 pb-2 group"
          >
            <span className="flex h-12 w-12 -mt-4 items-center justify-center rounded-full bg-primary-700 text-white shadow-lg ring-4 ring-white group-active:scale-95 transition-transform">
              <Plus className="w-6 h-6" />
            </span>
            <span className="text-[10px] font-semibold text-slate-400 tracking-wide">Nowy</span>
          </Link>

          {RIGHT_ITEMS.map((item) => <NavLink key={item.href} {...item} />)}
        </div>
      </nav>
    </>
  );
}
