'use client';

import Link from 'next/link';
import { useAuth, avatarUrl, firstName } from '@/lib/auth';
import NotificationBell from '@/components/layout/NotificationBell';

/** Compact greeting that replaces the old marketing hero on the dashboard —
 *  a signed-in visitor already knows what Bojo is, so the top of the page
 *  should orient them ("who am I") rather than sell the product again. */
export default function GreetingBar() {
  const { user } = useAuth();
  const name = firstName(user);
  const avatar = avatarUrl(user);
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="flex items-center justify-between px-4 pt-6 pb-2">
      <p className="font-display text-xl font-bold text-ink sm:text-2xl">
        {name ? `Cześć, ${name} 👋` : 'Cześć! 👋'}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <NotificationBell />
        <Link href="/profil" aria-label="Twój profil" className="shrink-0">
          {avatar ? (
            <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
              {initial}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
