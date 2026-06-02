'use client';

import { useRef, useState } from 'react';
import { User, Check, LogOut } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName, avatarUrl } from '@/lib/auth';

export default function ProfilePage() {
  const { user, loading, signOut, updateDisplayName, signInWithGoogle, uploadAvatar } = useAuth();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
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
            <User className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h1 className="text-xl font-bold text-gray-900">Zaloguj się</h1>
            <p className="text-gray-500 text-sm mt-2 mb-6">Potrzebujesz konta, aby zobaczyć swój profil.</p>
            <Button onClick={() => signInWithGoogle()}>Zaloguj się przez Google</Button>
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
    try {
      await uploadAvatar(file);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Nie udało się przesłać zdjęcia.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleStartEdit = () => {
    setName(currentName);
    setEditing(true);
    setSaved(false);
    setError(null);
  };

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
  };

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Profil</h1>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-2">
            {currentAvatarUrl ? (
              <img
                src={currentAvatarUrl}
                alt="Awatar"
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold shrink-0">
                {currentName.charAt(0).toUpperCase()}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
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

          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-lg truncate">{currentName}</p>
              <p className="text-sm text-gray-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Display name editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wyświetlana nazwa</label>
            {editing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="Imię lub pseudonim"
                  className={inputCls}
                  maxLength={40}
                  autoFocus
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button onClick={handleSave} isLoading={saving} className="flex-1">
                    Zapisz
                  </Button>
                  <Button onClick={handleCancel} variant="outline" className="flex-1" disabled={saving}>
                    Anuluj
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-800">{currentName}</p>
                  {saved && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Check className="w-3 h-3" /> Zapisano
                    </span>
                  )}
                </div>
                <button
                  onClick={handleStartEdit}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Zmień
                </button>
              </div>
            )}
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        {/* Sign out */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Wyloguj się
          </button>
        </div>
      </main>
    </div>
  );
}
