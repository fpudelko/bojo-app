'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  updateDisplayName: async () => {},
  uploadAvatar: async () => {},
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/wydarzenia` },
    });
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
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, updateDisplayName, uploadAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
