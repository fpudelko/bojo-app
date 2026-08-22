'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { track } from './analytics';
import { zapamietajPowrot, odbierzPowrot } from './powrotPoLogowaniu';
import { setHintCookie, clearHintCookie } from './sessionHint';
import { displayName, isPelneImie } from './profileName';
import { dopnijSubskrypcjePush } from './push';

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

// Selektory nazwy i awatara mieszkają w `lib/profileName.ts` — czystym module
// `.ts`, który Vitest potrafi zaimportować (tego pliku, z JSX i `jsx: preserve`
// w tsconfig, nie potrafi). Re-eksport jest tu po to, żeby ~40 istniejących
// importów `from '@/lib/auth'` działało bez zmian.
export { avatarUrl, displayName, firstName } from './profileName';

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
      // Zalogowanie się zakończyło powodzeniem — odpalij globalne eventy tracking
      // i RPC, zanim cokolwiek innego (patrz uwaga poniżej).
      if (event === 'SIGNED_IN' && session?.user) {
        const key = `bojo:login-tracked:${session.user.id}`;
        if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          track('login').catch(() => {});
        }

        // Dopnij ewentualną istniejącą subskrypcję push do TEGO konta — bez
        // tego, na współdzielonym urządzeniu, zostaje przypięta do konta,
        // które jako pierwsze kliknęło „Włącz" (patrz lib/push.ts). Celowo
        // BEZ dedupowania jak wyżej: idempotentny UPSERT, tani nawet przy
        // ponownym odpaleniu na odświeżeniu tokenu.
        dopnijSubskrypcjePush().catch(() => {});

        // Fresh account (utworzone w ciągu ostatnich 10 minut) bez pełnego
        // imienia — zgłoś do dzwonka powiadomień. Nie dotyczy starych kont:
        // trigger 070/071 miał to obsłużyć przy rejestracji, ale w praktyce
        // nigdy nie zadziałał (patrz migracja 086) — to jest niezawodny
        // odpowiednik po stronie klienta, celowo ograniczony do świeżych
        // kont, żeby nie zalać powiadomieniami wszystkich dotychczasowych
        // użytkowników z niepełną nazwą.
        const wiekKontaMs = Date.now() - new Date(session.user.created_at).getTime();
        if (wiekKontaMs < 10 * 60 * 1000 && !isPelneImie(displayName(session.user))) {
          supabase.rpc('zglos_brak_pelnej_nazwy').then(({ error }) => {
            if (error) { console.error('[zglos_brak_pelnej_nazwy] RPC failed:', error.message); return; }
            // Realtime dzwonka może przegrać wyścig z tym insertem — kanał
            // jeszcze się nie zdążył zasubskrybować, zanim wiersz powstał
            // w bazie, a Supabase Realtime nie ma bufora/replaya. Bez tego
            // zdarzenia powiadomienie fizycznie istnieje, ale nie pokazuje
            // się w dzwonku, dopóki ktoś nie odświeży strony.
            window.dispatchEvent(new Event('bojo:powiadomienia-odswiez'));
          });
        }
      }

      // Supabase odsyła na Site URL, gdy nasz `redirectTo` nie jest na liście
      // dozwolonych adresów — wtedy `/auth/callback` w ogóle się nie wykonuje
      // i cały `?next=` przepada. Rozpoznajemy to po tym, że po zalogowaniu
      // stoimy na stronie głównej, i dokańczamy podróż z zapamiętanego celu.
      // UWAGA: to musi być JEŻELI, NIE JEŚLI-ZARAZ-PO — tracking i RPC
      // powyżej muszą się zawsze wykonać, niezależnie od tego, czy tu zrobimy
      // redirect, bo PostSignupRoleModal efekt polega na nich.
      if (event === 'SIGNED_IN' && session && typeof window !== 'undefined'
          && window.location.pathname === '/') {
        const cel = odbierzPowrot();
        if (cel) { window.location.replace(cel); return; }
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
    zapamietajPowrot(next);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl(next),
        // `prompt=select_account` — ZAWSZE pytaj, na które konto.
        //
        // Bez tego Google przy jednej aktywnej sesji loguje od razu, bez
        // pokazywania listy: kto ma konto prywatne i firmowe (a przy testowaniu
        // Bojo — konto właściciela i testowe), trafiał na to, które akurat było
        // pierwsze, i nie miał jak tego zmienić inaczej niż wylogowując się
        // z Google w całej przeglądarce (zgłoszone wprost).
        //
        // Koszt: jedno dodatkowe kliknięcie dla kogoś z JEDNYM kontem. Cena
        // pomyłki jest wyższa — konto w Bojo zakłada się wtedy na złym adresie
        // i wychodzi to dopiero, gdy zniknie historia meczów.
        queryParams: { prompt: 'select_account' },
      },
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
    zapamietajPowrot(next);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: name?.trim() ? { display_name: name.trim() } : undefined,
        emailRedirectTo: callbackUrl(next),
      },
    });
    if (error) throw new Error(mapAuthError(error.message));
    // Ochrona przed enumeracją e-maili (ustawienie w Supabase Dashboard) sprawia,
    // że signUp() dla JUŻ ISTNIEJĄCEGO e-maila nie rzuca błędu — zwraca fałszywy
    // sukces z pustą tablicą `identities` (i bez sesji). Bez tego sprawdzenia
    // kod szedł ścieżką „sprawdź e-mail, żeby potwierdzić konto" zamiast
    // rozpoznać, że to konto już istnieje.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error('Konto z tym adresem już istnieje. Zaloguj się hasłem lub przez Google.');
    }
    // When e-mail confirmation is enabled, no session is returned yet.
    return { needsConfirmation: !data.session };
  };

  const sendMagicLink = async (email: string, next?: string) => {
    zapamietajPowrot(next);
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

    // `profiles.display_name` (migracja 022) to osobna kopia, zakładana przy
    // rejestracji wyzwalaczem `handle_new_user`. Czytają ją panel admina oraz
    // wyzwalacz powiadomienia „X zaprasza Cię na mecz" (migracja 067) — bez
    // tego zapisu zostawała przy nazwie sprzed zmiany albo pusta.
    // Metadane `auth.users` pozostają źródłem prawdy dla interfejsu, więc błąd
    // tej aktualizacji nie może wywrócić zapisu, który już się udał.
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ display_name: name.trim() })
        .eq('id', data.user.id);
    }
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
