'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { User, Check, LogOut, Trash2, Phone, AlertTriangle, BarChart2, Building2, Sun, Moon, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName, avatarUrl } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { hasManagedVenue } from '@/lib/api';
import { ADMIN_LINKS } from '@/lib/adminLinks';
import { validatePhone, normalizePhone } from '@/lib/validation';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, signOut, updateDisplayName, uploadAvatar } = useAuth();
  const isAdmin = useAdmin();
  const { resolvedTheme, setTheme } = useTheme();
  // Guard against the server/client theme mismatch on first paint — same
  // pattern as components/layout/Header.tsx.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [hasVenue, setHasVenue] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phone state
  const [phone, setPhone] = useState('');
  const [phoneConsent, setPhoneConsent] = useState(false);
  const [phoneEditMode, setPhoneEditMode] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load phone from profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('phone, phone_consent')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPhone(data.phone ?? '');
          setPhoneConsent(data.phone_consent ?? false);
        }
      });
  }, [user]);

  // "Moje obiekty" — przeniesione tu z nagłówka (patrz Header.tsx), bo
  // hamburger na mobile stracił wszystkie opcje zalogowanego.
  useEffect(() => {
    if (!user) { setHasVenue(false); return; }
    hasManagedVenue(user.id).then(setHasVenue).catch(() => {});
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
          <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <User className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            <h1 className="text-xl font-bold text-slate-900">Zaloguj się</h1>
            <p className="text-slate-500 text-sm mt-2 mb-6">Potrzebujesz konta, aby zobaczyć swój profil.</p>
            <Button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname)}`; }}>Zaloguj się</Button>
          </div>
        </main>
      </div>
    );
  }

  const currentName = displayName(user);
  const currentAvatarUrl = avatarUrl(user);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Plik jest za duży. Maksymalny rozmiar to 5 MB.');
      e.target.value = '';
      return;
    }
    setAvatarUploading(true);
    setAvatarError(null);
    try { await uploadAvatar(file); }
    catch (err) { setAvatarError(err instanceof Error ? err.message : 'Nie udało się przesłać zdjęcia.'); }
    finally { setAvatarUploading(false); e.target.value = ''; }
  };

  const handleStartEdit = () => { setName(currentName); setEditing(true); setSaved(false); setError(null); };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Podaj imię lub pseudonim.'); return; }
    if (trimmed === currentName) { setEditing(false); return; }
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName(trimmed);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Nie udało się zapisać'); }
    finally { setSaving(false); }
  };

  const handleSavePhone = async () => {
    setPhoneError(null);
    const trimmed = phone.trim();
    if (trimmed && !validatePhone(trimmed)) {
      setPhoneError('Podaj numer w formacie 9-cyfrowym lub +48XXXXXXXXX.');
      return;
    }
    if (trimmed && !phoneConsent) {
      setPhoneError('Zaznacz zgodę na kontakt SMS, aby zapisać numer.');
      return;
    }
    setPhoneSaving(true);
    try {
      const normalized = trimmed ? normalizePhone(trimmed) : null;
      await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          phone: normalized,
          phone_consent: trimmed ? phoneConsent : false,
        });
      setPhoneEditMode(false);
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 3000);
    } catch (e) { setPhoneError(e instanceof Error ? e.message : 'Błąd zapisu'); }
    finally { setPhoneSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_account');
      if (error) throw error;
      await signOut();
      router.push('/');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Błąd usuwania konta. Spróbuj ponownie.');
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const inputCls =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Profil</h1>

        {/* Nawigacja — dawniej częściowo w hamburgerze (Header.tsx); mobile
            straciło ten hamburger dla zalogowanych, więc "Moje statystyki"
            i "Moje obiekty" mają tu swój jedyny dom. */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
          <Link
            href={`/gracz/${user.id}`}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <BarChart2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-slate-700">Moje statystyki</span>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </Link>
          {hasVenue && (
            <Link
              href="/obiekt"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="flex-1 text-sm font-medium text-slate-700">Moje obiekty</span>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </Link>
          )}
        </div>

        {/* Identity card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            {currentAvatarUrl ? (
              <img src={currentAvatarUrl} alt="Awatar" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold shrink-0">
                {currentName.charAt(0).toUpperCase()}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
            >
              {avatarUploading ? 'Przesyłanie…' : 'Zmień zdjęcie'}
            </button>
            {avatarError && <p className="text-xs text-red-600 text-center">{avatarError}</p>}
          </div>

          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-lg truncate">{currentName}</p>
              <p className="text-sm text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Wyświetlana nazwa</label>
            {editing ? (
              <div className="space-y-2">
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="Imię lub pseudonim" className={inputCls} maxLength={40} autoFocus
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button onClick={handleSave} isLoading={saving} className="flex-1">Zapisz</Button>
                  <Button onClick={() => { setEditing(false); setError(null); }} variant="outline" className="flex-1" disabled={saving}>Anuluj</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-800">{currentName}</p>
                  {saved && <span className="flex items-center gap-1 text-xs text-green-600"><Check className="w-3 h-3" /> Zapisano</span>}
                </div>
                <button onClick={handleStartEdit} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Zmień</button>
              </div>
            )}
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>

        {/* Phone with consent */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Numer telefonu</h2>
            <span className="text-xs text-slate-400 font-normal">(opcjonalny)</span>
          </div>

          {!phoneEditMode ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {phone || <span className="text-slate-400 italic">Nie podano</span>}
                {phoneSaved && <span className="ml-2 text-xs text-green-600"><Check className="inline w-3 h-3" /> Zapisano</span>}
              </p>
              <button
                onClick={() => setPhoneEditMode(true)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {phone ? 'Zmień' : 'Dodaj'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneError(null); }}
                  placeholder="np. 501234567 lub +48501234567"
                  className={inputCls}
                  maxLength={13}
                />
                {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
              </div>

              {/* Consent checkbox — unchecked by default */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={phoneConsent}
                  onChange={(e) => setPhoneConsent(e.target.checked)}
                  className="mt-0.5 shrink-0 accent-primary-600"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Wyrażam zgodę na kontakt SMS w sprawach wydarzeń, w których uczestniczę
                  lub które organizuję. Zgoda jest dobrowolna i można ją cofnąć w dowolnym
                  momencie usuwając numer z profilu.
                </span>
              </label>

              <div className="flex gap-2">
                <Button onClick={handleSavePhone} isLoading={phoneSaving} className="flex-1" size="sm">Zapisz</Button>
                <Button onClick={() => { setPhoneEditMode(false); setPhoneError(null); }} variant="outline" className="flex-1" size="sm">Anuluj</Button>
              </div>
            </div>
          )}
        </div>

        {/* Wygląd — przeniesione z Header.tsx (mobile straciło hamburger) */}
        {mounted && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {resolvedTheme === 'dark' ? <Moon className="w-4 h-4 text-slate-400" /> : <Sun className="w-4 h-4 text-slate-400" />}
                <span className="text-sm font-medium text-slate-700">Wygląd</span>
              </div>
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {resolvedTheme === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
              </button>
            </div>
          </div>
        )}

        {/* Panel administratora — przeniesione z Header.tsx (mobile straciło
            hamburger; desktop nadal ma osobne menu z zębatką w Header.tsx) */}
        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            <div className="px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Panel administratora</p>
            </div>
            {ADMIN_LINKS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </Link>
            ))}
          </div>
        )}

        {/* Sign out */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Wyloguj się
          </button>
        </div>

        {/* Danger zone — delete account */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5">
          <h2 className="text-sm font-semibold text-red-700 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Strefa niebezpieczna
          </h2>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Usunięcie konta jest nieodwracalne. Twoje dane osobowe zostaną zanonimizowane
            lub usunięte zgodnie z{' '}
            <a href="/prywatnosc" className="text-primary-600 hover:underline">Polityką prywatności</a>.
            Zapisane mecze pozostaną widoczne jako „Usunięty użytkownik".
          </p>

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Usuń konto
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-red-700">Na pewno chcesz usunąć konto?</p>
              <div className="flex gap-2">
                <Button
                  onClick={handleDelete}
                  isLoading={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 focus:ring-red-500 border-transparent text-white"
                  size="sm"
                >
                  Tak, usuń bezpowrotnie
                </Button>
                <Button
                  onClick={() => setDeleteConfirm(false)}
                  variant="outline"
                  className="flex-1"
                  size="sm"
                  disabled={deleting}
                >
                  Anuluj
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
