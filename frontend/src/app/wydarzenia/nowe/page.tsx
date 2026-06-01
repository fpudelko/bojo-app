'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Lock, Globe } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import VenuePicker from '@/components/map/VenuePicker';
import { useAuth, displayName } from '@/lib/auth';
import { createEvent } from '@/lib/events';
import type { Field, Visibility } from '@/types';

const SPORTS = ['piłka nożna', 'koszykówka', 'siatkówka', 'tenis', 'futsal', 'inne'];

export default function NewEventPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle } = useAuth();

  const [sport, setSport] = useState('piłka nożna');
  const [field, setField] = useState<Field | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <Lock className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h1 className="text-xl font-bold text-gray-900">Zaloguj się, aby tworzyć wydarzenia</h1>
            <p className="text-gray-500 text-sm mt-2 mb-6">
              Potrzebujesz konta, żeby organizować mecze i zarządzać uczestnikami.
            </p>
            <Button onClick={() => signInWithGoogle()}>Zaloguj się przez Google</Button>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!field) { setError('Wybierz boisko na mapie.'); return; }
    if (!date) { setError('Podaj datę.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const id = await createEvent(
        {
          sport,
          fieldId: field.id,
          fieldName: field.name,
          lat: field.lat,
          lng: field.lng,
          title: title || undefined,
          description: description || undefined,
          date,
          time,
          maxPlayers,
          visibility,
        },
        user.id,
        displayName(user),
      );
      router.push(`/wydarzenia/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć wydarzenia');
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Nowe wydarzenie</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sport */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
            <select value={sport} onChange={(e) => setSport(e.target.value)} className={inputCls}>
              {SPORTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Venue */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Boisko {field && <span className="text-primary-600">— {field.name}</span>}
            </label>
            <p className="text-xs text-gray-500 mb-2">Kliknij pinezkę na mapie, aby wybrać boisko.</p>
            <div className="h-72 rounded-xl overflow-hidden border border-gray-200">
              <VenuePicker selectedId={field?.id} onSelect={setField} />
            </div>
            {field && (
              <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {field.address}
              </p>
            )}
          </div>

          {/* Date / time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Godzina</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} required />
            </div>
          </div>

          {/* Max players */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Liczba miejsc: <span className="text-primary-600 font-semibold">{maxPlayers}</span>
            </label>
            <input
              type="range" min={2} max={30} value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł (opcjonalnie)</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Czwartkowa ligówka" className={inputCls} maxLength={80}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opis (opcjonalnie)</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Poziom, zasady, co zabrać…" rows={3} className={inputCls}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Widoczność</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button" onClick={() => setVisibility('private')}
                className={[
                  'flex items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                  visibility === 'private' ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400',
                ].join(' ')}
              >
                <Lock className="w-4 h-4 mt-0.5 text-gray-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Prywatne</span>
                  <span className="block text-xs text-gray-500">Tylko przez link</span>
                </span>
              </button>
              <button
                type="button" onClick={() => setVisibility('public')}
                className={[
                  'flex items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                  visibility === 'public' ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400',
                ].join(' ')}
              >
                <Globe className="w-4 h-4 mt-0.5 text-gray-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Publiczne</span>
                  <span className="block text-xs text-gray-500">Widoczne dla wszystkich</span>
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" isLoading={submitting} className="w-full">
            Utwórz wydarzenie
          </Button>
        </form>
      </main>
    </div>
  );
}
