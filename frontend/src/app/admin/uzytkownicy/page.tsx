'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Lock, Search, Shield, ShieldCheck, User } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { zaktualizujJedenWiersz } from '@/lib/zapytania';

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
  avatar_url: string | null;
}

const inputCls =
  'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

interface Toast { id: number; message: string; type: 'success' | 'error' }
let toastCounter = 0;

export default function UsersAdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const [adminState, setAdminState] = useState<'checking' | 'yes' | 'no'>('checking');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastCounter;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  // --- Admin check ---
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAdminState('no'); return; }
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => setAdminState(data?.is_admin ? 'yes' : 'no'), () => setAdminState('no'));
  }, [authLoading, user]);

  // --- Load profiles ---
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, is_admin, avatar_url');
    if (error) addToast(error.message, 'error');
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  }, [addToast]);

  useEffect(() => { if (adminState === 'yes') load(); }, [adminState, load]);

  const toggleAdmin = async (p: Profile) => {
    const label = p.display_name || p.email || 'tego użytkownika';
    const confirmMsg = p.is_admin
      ? `Na pewno odebrać uprawnienia administratora użytkownikowi ${label}?`
      : `Na pewno nadać uprawnienia administratora użytkownikowi ${label}? Będzie mieć pełny dostęp do panelu admina.`;
    if (!confirm(confirmMsg)) return;

    setBusy((s) => new Set(s).add(p.id));
    // optimistic
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_admin: !x.is_admin } : x)));
    try {
      // `zaktualizujJedenWiersz`, nie gołe `.update()`. Wcześniej brak
      // uprawnienia dawał ZERO zmienionych wierszy i sukces — optymistyczna
      // zmiana zostawała na ekranie, a po odświeżeniu przełącznik wracał na
      // swoje miejsce. Wyglądało to na kaprys interfejsu, a było odmową bazy.
      // Sama odmowa to osobny błąd, naprawiony migracją `098`: polityka
      // sprawdzała uprawnienie zapytaniem o tę samą tabelę, na której siedzi.
      await zaktualizujJedenWiersz(
        'profiles',
        p.id,
        { is_admin: !p.is_admin },
        'Nie udało się zmienić uprawnień',
      );
      addToast(!p.is_admin ? 'Nadano admina' : 'Odebrano admina');
    } catch (e) {
      setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_admin: p.is_admin } : x)));
      addToast(e instanceof Error ? e.message : 'Nie udało się zmienić uprawnień', 'error');
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(p.id); return n; });
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? profiles.filter((p) =>
          (p.email ?? '').toLowerCase().includes(q) ||
          (p.display_name ?? '').toLowerCase().includes(q))
      : profiles;
    // admins first, then by name/email
    return [...list].sort((a, b) => {
      if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1;
      const an = (a.display_name || a.email || '').toLowerCase();
      const bn = (b.display_name || b.email || '').toLowerCase();
      return an.localeCompare(bn, 'pl');
    });
  }, [profiles, search]);

  const adminCount = profiles.filter((p) => p.is_admin).length;

  // ---- Guards ----
  if (authLoading || adminState === 'checking') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        </main>
      </div>
    );
  }

  if (adminState === 'no') {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">Brak dostępu</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Zarządzanie użytkownikami jest dostępne tylko dla administratorów.
              Jeśli to Ty masz być adminem, uruchom migrację 022 w Supabase SQL Editor.
            </p>
            <Link href="/" className="text-primary-600 text-sm underline mt-4 inline-block">Wróć na stronę główną</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-ink">Użytkownicy</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? 'Ładowanie…' : `${profiles.length} kont · ${adminCount} adminów`}
          </p>
        </div>

        <div className="relative mb-5">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj po nazwie lub e-mailu…"
            className={`${inputCls} w-full pl-9`}
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {rows.map((p) => {
              const isMe = p.id === user?.id;
              const isBusy = busy.has(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    : <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary-700" />
                      </div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink truncate flex items-center gap-2">
                      {p.display_name || p.email || p.id.slice(0, 8)}
                      {isMe && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-primary-50 text-primary-700">to Ty</span>}
                    </p>
                    {p.email && <p className="text-xs text-slate-500 truncate">{p.email}</p>}
                  </div>
                  <button
                    onClick={() => toggleAdmin(p)}
                    disabled={isBusy}
                    title={p.is_admin ? 'Kliknij, aby odebrać admina' : 'Kliknij, aby nadać admina'}
                    className={[
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50',
                      p.is_admin
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {p.is_admin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                    {p.is_admin ? 'Admin' : 'Zwykły'}
                  </button>
                </div>
              );
            })}
            {rows.length === 0 && (
              <p className="text-center text-slate-500 py-12 text-sm">Brak kont spełniających wyszukiwanie</p>
            )}
          </div>
        )}
      </main>

      {/* Toasts */}
      <div className="fixed inset-0 pointer-events-none flex flex-col items-end justify-start p-6 gap-2 pt-20 md:pt-6 z-[1020]">
        {toasts.map((t) => (
          <div key={t.id} className={[
            'px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs',
            t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
          ].join(' ')}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
