'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Plus, CalendarDays, Users as UsersIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/lib/auth';
import { hasPendingApprovalRequests, getNearbyEvents, maNoweWydarzeniaWPobolizu, KLUCZ_WYDARZENIA_WIDZIANO } from '@/lib/events';
import { getMyGroupIds } from '@/lib/groups';
import { hasUnreadGroupMessages } from '@/lib/groupPosts';
import { hasUnreadEventMessages } from '@/lib/comments';
import { hasGeolocationPermission, getCurrentLocation } from '@/lib/geo';
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

  // Różowe kropki „nowe wiadomości" — osobne zapytanie od niebieskiej wyżej,
  // bo to inne znaczenie (patrz komentarz przy `dot` w `NavLink`), nie inny
  // poziom pilności.
  const [unreadEvents, setUnreadEvents] = useState(false);
  useEffect(() => {
    if (!user) { setUnreadEvents(false); return; }
    hasUnreadEventMessages(user.id).then(setUnreadEvents).catch(() => {});
  }, [user, pathname]);

  const [unreadGroups, setUnreadGroups] = useState(false);
  useEffect(() => {
    if (!user) { setUnreadGroups(false); return; }
    getMyGroupIds(user.id)
      .then((ids) => hasUnreadGroupMessages(user.id, ids))
      .then(setUnreadGroups)
      .catch(() => {});
  }, [user, pathname]);

  // Pomarańczowa kropka „nowe wydarzenia w pobliżu" przy „Znajdź grę" —
  // wyłącznie gdy zgoda na lokalizację jest JUŻ udzielona (`getCurrentLocation()`
  // wprost wywołałaby systemowe okno o zgodę bez kontekstu, przy każdej zmianie
  // trasy). Brak zgody = brak kropki, nie prośba o nią w tle.
  const [nearbyNew, setNearbyNew] = useState(false);
  useEffect(() => {
    let aktualne = true;
    (async () => {
      const granted = await hasGeolocationPermission();
      if (!granted) { if (aktualne) setNearbyNew(false); return; }
      const loc = await getCurrentLocation();
      if (!loc.ok) { if (aktualne) setNearbyNew(false); return; }
      const events = await getNearbyEvents(loc.lat, loc.lng, 5, 20).catch(() => []);
      const widziano = typeof window !== 'undefined' ? window.localStorage.getItem(KLUCZ_WYDARZENIA_WIDZIANO) : null;
      if (aktualne) setNearbyNew(maNoweWydarzeniaWPobolizu(events, widziano));
    })();
    return () => { aktualne = false; };
  }, [pathname]);

  function NavLink({
    href, label, Icon, dots = [],
  }: {
    href: string; label: string; Icon: React.ComponentType<{ className?: string }>;
    /** Kropki — dziś "Moje" (oczekujące prośby o dołączenie + nieprzeczytane
        wiadomości), "Grupy" (nieprzeczytane wiadomości) i "Znajdź grę" (nowe
        wydarzenia w pobliżu). Kolor niesie znaczenie w całej apce (patrz
        AGENTS.md, sekcja Konwencje): niebieski wyłącznie "wymaga akceptacji",
        różowy wyłącznie "wiadomości", pomarańczowy wyłącznie "nowość, o której
        jeszcze nie wiesz". Każda kropka ma swój róg, żeby dwie naraz na "Moje"
        się nie nakładały. */
    dots?: { color: string; label: string; position: 'top-right' | 'top-left' }[];
  }) {
    const active = pathname === href || (href !== '/wydarzenia' && pathname.startsWith(href + '/'));
    const widoczne = dots.filter(Boolean);
    const ariaSuffix = widoczne.length > 0 ? ` — ${widoczne.map((d) => d.label).join(', ')}` : '';
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
          {widoczne.map((d) => (
            <span
              key={d.position}
              className={clsx(
                'absolute h-1.5 w-1.5 rounded-full',
                d.position === 'top-right' ? '-top-0.5 right-0' : '-top-0.5 left-0',
                d.color,
              )}
              aria-hidden="true"
            />
          ))}
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
        {LEFT_ITEMS.map((item) => {
          const dots: { color: string; label: string; position: 'top-right' | 'top-left' }[] = [];
          if (item.href === '/wydarzenia' && nearbyNew) {
            dots.push({ color: 'bg-orange-500', label: 'nowe wydarzenia w pobliżu', position: 'top-right' });
          }
          return <NavLink key={item.href} {...item} dots={dots} />;
        })}

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

        {RIGHT_ITEMS.map((item) => {
          const dots: { color: string; label: string; position: 'top-right' | 'top-left' }[] = [];
          if (item.href === '/moje-gry') {
            if (pendingApproval) dots.push({ color: 'bg-blue-500', label: 'nowe prośby o dołączenie', position: 'top-right' });
            if (unreadEvents) dots.push({ color: 'bg-pink-500', label: 'nowe wiadomości', position: 'top-left' });
          }
          if (item.href === '/grupy' && unreadGroups) {
            dots.push({ color: 'bg-pink-500', label: 'nowe wiadomości', position: 'top-right' });
          }
          return <NavLink key={item.href} {...item} dots={dots} />;
        })}
      </div>
    </nav>
  );
}
