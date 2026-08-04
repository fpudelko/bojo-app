'use client';

import { useAuth } from '@/lib/auth';
import AppHome from './AppHome';

/**
 * There is still no server-side session (Supabase keeps it in localStorage,
 * no middleware.ts), so the server can't know FOR CERTAIN who's looking at
 * "/". What it does get is `hint` — a presentational cookie set by
 * AuthProvider (lib/auth.tsx via lib/sessionHint.ts) — so it can render the
 * right SHAPE on the first response instead of always guessing "logged out".
 *
 * While auth is resolving, both the server and this first client render see
 * `loading=true` and the same `hint` prop, so they produce identical markup
 * — no hydration mismatch. Once `loading` flips, we switch to the real
 * dashboard or the landing based on the actual session.
 *
 * A full fix (real server-side session via @supabase/ssr + middleware) is a
 * separate, later step — tracked in BACKLOG.md §5.
 */
export default function HomeSwitch({ hint, landing, skeleton }: {
  hint: boolean;
  landing: React.ReactNode;
  skeleton: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <>{hint ? skeleton : landing}</>;
  return user ? <AppHome userId={user.id} /> : <>{landing}</>;
}
