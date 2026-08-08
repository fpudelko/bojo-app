'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { track } from './analytics';
import { setHintCookie, clearHintCookie } from './sessionHint';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: (next?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string, next?: string) => Promise<{ needsConfirmation: boolean }>;
  sendMagicLink: (email: string, next?: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
}

const noop = async () => {};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signInWithGoogle: noop,
  signInWithEmail: noop,
  signUpWithEmail: async () => ({ needsConfirmation: false }),
  sendMagicLink: noop,
  sendPasswordReset: noop,
  updatePassword: noop,
  signOut: noop,
  updateDisplayName: noop,
  uploadAvatar: noop,
});

/** Returns the avatar URL stored in user metadata, or null. */
export function avatarUrl(user: User | null): string | null {
  return user?.user_metadata?.avatar_url ?? null;
}

/** Preferred display name: custom → Google full name → email → fallback. */
export function displayName(user: User | null): string {
  if (!user) return '';
  return (
    (user.user_metadata?.display_name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    'Gracz'
  );
}

/** First name only, for compact greetings ("Cześć, Janek 👋"). Cuts a bare
 *  e-mail down at the "@" first, so a user with no display name never greets
 *  themselves by their full address. */
export function firstName(user: User | null): string {
  const name = displayName(user);
  if (!name) return '';
  const first = name.split('@')[0].trim().split(/\s+/)[0] ?? '';
  if (!first) return '';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Writes (or clears) the presentational session-hint cookie so the server
 *  can pick landing vs. dashboard skeleton on the very first response — see
 *  lib/sessionHint.ts for what this cookie is (and, importantly, isn't). */
function syncSessionHint(hasSession: boolean) {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = hasSession ? setHintCookie(secure) : clearHintCookie(secure);
}

/** Translate common Supabase auth errors into friendly Polish copy. */
function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Nieprawidłowy e-mail lub hasło.';
  if (m.includes('email not confirmed')) return 'Potwierdź e-mail, zanim się zalogujesz — sprawdź skrzynkę (także spam).';
  if (m.includes('user already registered') || m.includes('already been registered')) return 'Konto z tym adresem już istnieje. Zaloguj się hasłem lub przez Google.';
  if (m.includes('password should be at least')) return 'Hasło musi mieć co najmniej 6 znaków.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Podaj poprawny adres e-mail.';
  if (m.includes('rate limit')) return 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.';
  if (m.includes('signups not allowed')) return 'Rejestracja jest chwilowo wyłączona.';
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
      // Self-heals a stale hint too: if the cookie says "signed in" but there
      // is in fact no session, this clears it on the very next load.
      syncSessionHint(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Covers SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED (session present)
      // and SIGNED_OUT (session null) alike — keyed off session presence
      // rather than a fixed event list, so it stays correct if Supabase adds
      // new event types later.
      syncSessionHint(!!session);
      // When the user clicks a password-reset email, Supabase fires PASSWORD_RECOVERY
      // on whatever page the redirect_to URL lands on. Redirect to the reset form
      // regardless of which page is currently shown (handles cases where Supabase
      // ignores our redirectTo because the URL isn't whitelisted yet).
      if (event === 'PASSWORD_RECOVERY') {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/reset')) {
          window.location.href = '/auth/reset';
        }
        return;
      }
      // Track a login once per browser session (SIGNED_IN also fires on tab
      // refocus / token refresh, so dedupe with a sessionStorage flag).
      if (event === 'SIGNED_IN' && session?.user) {
        const key = `bojo:login-tracked:${session.user.id}`;
        if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          track('login').catch(() => {});
        }
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  /** Build the post-auth redirect URL, preserving an optional `next` target. */
  const callbackUrl = (next?: string) => {
    const base = `${window.location.origin}/auth/callback`;
    return next ? `${base}?next=${encodeURIComponent(next)}` : base;
  };

  const signInWithGoogle = async (next?: string) => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(next) },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(mapAuthError(error.message));
  };

  // `next` musi dojechać aż do linku potwierdzającego w mailu. Bez tego
  // organizator, który zakładał konto w trakcie tworzenia meczu, po kliknięciu
  // w mail lądował na stronie głównej zamiast wracać do kreatora — w odróżnieniu
  // od Google i magic linku, które `next` przekazywały od zawsze.
  const signUpWithEmail = async (email: string, password: string, name?: string, next?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: name?.trim() ? { display_name: name.trim() } : undefined,
        emailRedirectTo: callbackUrl(next),
      },
    });
    if (error) throw new Error(mapAuthError(error.message));
    // When e-mail confirmation is enabled, no session is returned yet.
    return { needsConfirmation: !data.session };
  };

  const sendMagicLink = async (email: string, next?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(next) },
    });
    if (error) throw new Error(mapAuthError(error.message));
  };

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: callbackUrl('/auth/reset'),
    });
    if (error) throw new Error(mapAuthError(error.message));
  };

  const updatePassword = async (password: string) => {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(mapAuthError(error.message));
    setUser(data.user);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateDisplayName = async (name: string) => {
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: name.trim() },
    });
    if (error) throw new Error(error.message);
    setUser(data.user);
  };

  const uploadAvatar = async (file: File) => {
    if (!user) throw new Error('Musisz być zalogowany.');

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(`${user.id}/avatar`, file, { upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(`${user.id}/avatar`);
    const publicUrl = urlData.publicUrl;

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, avatar_url: publicUrl });
    if (upsertError) throw new Error(upsertError.message);

    const { data, error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    });
    if (updateError) throw new Error(updateError.message);
    setUser(data.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendMagicLink,
        sendPasswordReset,
        updatePassword,
        signOut,
        updateDisplayName,
        uploadAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
