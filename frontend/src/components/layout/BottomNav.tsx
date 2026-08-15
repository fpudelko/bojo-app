'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Plus, CalendarDays, Users as UsersIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/lib/auth';
import { hasPendingApprovalRequests } from '@/lib/events';
import { WARSTWA } from '@/lib/warstwy';

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
  { href: '/wydarzenia', label: 'Znajdź grę', Icon: BallIcon },
  { href: '/mapa',       label: 'Mapa',       Icon: Map },
] as const;

const RIGHT_ITEMS = [
  { href: '/moje-gry', label: 'Moje',   Icon: CalendarDays },
  { href: '/grupy',    label: 'Grupy',  Icon: UsersIcon },
] as const;

/** `/grupy/<uuid>` (nie `/grupy/nowe`, nie `/grupy/<uuid>/edytuj`) — wyłącznie
 *  strona konkretnej ekipy niesie kontekst grupy do kreatora meczu. */
function groupIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/grupy\/([^/]+)$/);
  if (!m || m[1] === 'nowe') return null;
  return m[1];
}

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const groupId = groupIdFromPathname(pathname);
  const nowyHref = groupId ? `/wydarzenia/nowe?group=${groupId}` : '/wydarzenia/nowe';

  // Leniwie przy każdej zmianie trasy — ten sam wzorzec "leniwego" odpalania
  // co reszta powiadomień w repo, bez kanału realtime dla zwykłej kropki.
  const [pendingApproval, setPendingApproval] = useState(false);
  useEffect(() => {
    if (!user) { setPendingApproval(false); return; }
    hasPendingApprovalRequests(user.id).then(setPendingApproval).catch(() => {});
  }, [user, pathname]);

  function NavLink({
    href, label, Icon, dot,
  }: {
    href: string; label: string; Icon: React.ComponentType<{ className?: string }>;
    /** Kropka — dziś tylko "Moje" przy oczekujących prośbach o dołączenie.
        Niebieski, bo to jedyny kolor, który w apce znaczy wyłącznie
        "wymaga akceptacji" (patrz sekcja 5 planu). */
    dot?: { color: string; label: string };
  }) {
    const active = pathname === href || (href !== '/wydarzenia' && pathname.startsWith(href + '/'));
    const ariaSuffix = dot ? ` — ${dot.label}` : '';
    return (
      <Link
        href={href}
        aria-label={ariaSuffix ? `${label}${ariaSuffix}` : undefined}
        className={clsx(
          'flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide transition-colors',
          active ? 'text-primary-700' : 'text-slate-400 hover:text-slate-600',
        )}
      >
        <span className="relative">
          <Icon className={clsx('w-5 h-5 transition-transform', active && 'scale-110')} />
          {/* Kropka zamiast pełnej plakietki — kolumna w gridzie dolnej
              nawigacji jest zbyt wąska na pełny badge. `aria-label` wyżej
              niesie tę samą informację dla czytników ekranu. */}
          {dot && (
            <span className={clsx('absolute -top-0.5 right-0 h-1.5 w-1.5 rounded-full', dot.color)} aria-hidden="true" />
          )}
        </span>
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    );
  }

  return (
    // Bez elementu-dystansu. Wcześniej stał tu <div className="h-16 md:hidden" />,
    // ale BottomNavGate montuje się w app/layout.tsx PO {children}, czyli poza
    // kontenerem `min-h-screen` strony — dystans nie odsuwał treści, tylko
    // wydłużał dokument o 64 px na każdej stronie. Miejsce dla paska robi teraz
    // zmienna --bottom-nav-h w globals.css; jej wartość musi się zgadzać
    // z `h-14` niżej.
    <nav
      className={`md:hidden fixed bottom-0 inset-x-0 ${WARSTWA.nawigacjaDolna} bg-white/95 backdrop-blur-sm border-t border-slate-200/70`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Nawigacja dolna"
    >
      <div className="grid h-14 grid-cols-5 items-end">
        {LEFT_ITEMS.map((item) => <NavLink key={item.href} {...item} />)}

        {/* Centre FAB — always accessible, can't be deselected. Na stronie
            konkretnej ekipy prowadzi do kreatora z już wybraną grupą — to jest
            "przycisk nowy tworzy mecz od razu przypisany do tej grupy". */}
        <Link
          href={nowyHref}
          aria-label="Stwórz nowy mecz"
          className="flex h-full flex-col items-center justify-center gap-0.5 pb-2 group"
        >
          <span className="flex h-12 w-12 -mt-4 items-center justify-center rounded-full bg-primary-700 text-white shadow-lg ring-4 ring-white group-active:scale-95 transition-transform">
            <Plus className="w-6 h-6" />
          </span>
          <span className="text-[10px] font-semibold text-slate-400 tracking-wide">Nowy</span>
        </Link>

        {RIGHT_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            dot={item.href === '/moje-gry' && pendingApproval
              ? { color: 'bg-blue-500', label: 'nowe prośby o dołączenie' }
              : undefined}
          />
        ))}
      </div>
    </nav>
  );
}
