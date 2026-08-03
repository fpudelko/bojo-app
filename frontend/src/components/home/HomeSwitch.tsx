'use client';

import { useAuth } from '@/lib/auth';
import AppHome from './AppHome';

/**
 * There is no server-side session (Supabase keeps it in localStorage, no
 * middleware.ts), so the server can't know who's looking at "/" — the
 * landing/dashboard split has to happen on the client. While auth is
 * resolving we render the landing, same as before this redesign: a signed-in
 * visitor sees it flash briefly, which keeps the server HTML stable for
 * crawlers instead of guessing. A durable fix is a cookie-based session
 * (@supabase/ssr + middleware) — tracked in BACKLOG.md.
 */
export default function HomeSwitch({ landing }: { landing: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (!loading && user) return <AppHome userId={user.id} />;
  return <>{landing}</>;
}
