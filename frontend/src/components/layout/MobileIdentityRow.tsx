'use client';

import Link from 'next/link';
import { useAuth, displayName, avatarUrl } from '@/lib/auth';
import NotificationBell from './NotificationBell';

/**
 * Dzwonek + awatar w jednym wierszu — zastępuje mobilny pasek Header tam,
 * gdzie strona sama pokazuje ten sam zestaw w swoim własnym górnym wierszu
 * (patrz Header.tsx#hideMobileBarForUser). Markup identyczny z mobilnym
 * klastrem Header, żeby nie było wizualnej różnicy między stronami.
 *
 * Zwraca null, gdy nikt nie jest zalogowany — wywołujący może wstawiać
 * bezwarunkowo.
 */
export default function MobileIdentityRow() {
  const { user } = useAuth();
  if (!user) return null;
  const userAvatar = avatarUrl(user);
  return (
    <div className="flex shrink-0 items-center gap-1">
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
    </div>
  );
}
