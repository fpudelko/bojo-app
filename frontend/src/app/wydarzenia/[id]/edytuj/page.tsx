'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Lock, Globe, ArrowLeft, MapPin } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import VenuePicker from '@/components/map/VenuePicker';
import { useAuth } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { getEvent, updateEvent } from '@/lib/events';
import { getField } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import type { Field, Visibility } from '@/types';
import Link from 'next/link';

const SPORTS = [
  'piłka nożna', 'futsal', 'koszykówka', 'siatkówka',
  'siatkówka plażowa', 'piłka ręczna', 'inne',
];

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useAdmin();

  const [pageLoading, setPageLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

  const [sport, setSport] = useState('piłka nożna');
  const [field, setField] = useState<Field | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [endTime, setEndTime] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setNotAllowed(true); setPageLoading(false); return; }

    getEvent(id)
      .then(async ({ event: ev }) => {
        if (ev.organizerId !== user.id && !isAdmin) { setNotAllowed(true); return; }

        setSport(ev.sport);
        setDate(ev.date);
        setTime(ev.time?.slice(0, 5) ?? '18:00');
        setEndTime(ev.endTime?.slice(0, 5) ?? '');
        setMaxPlayers(ev.maxPlayers);
        setTitle(ev.title ?? '');
        setDescription(ev.description ?? '');
        setVisibility(ev.visibility);

        if (ev.fieldId) {
          try {
            const f = await getField(ev.fieldId);
            setField(f);
          } catch {
            // Field may have been removed; reconstruct minimal object for display
            setField({
              id: ev.fieldId,
              name: ev.fieldName,
              sport: [ev.sport],
              address: ev.fieldName,
              lat: ev.lat ?? 0,
              lng: ev.lng ?? 0,
              available: true,
              surface: '',
              isIndoor: false,
              isBookable: false,
              bookingType: 'none' as const,
              bookingEnabled: false,
            });
          }
        }
      })
      .catch(() => setNotAllowed(true))
      .finally(() => setPageLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field) { setError('Wybierz boisko na mapie.'); return; }
    if (!date) { setError('Podaj datę.'); return; }
    if (endTime && endTime <= time) {
      setError('Godzina zakończenia musi być późniejsza niż rozpoczęcia.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await updateEvent(id, {
        sport,
        fieldId: field.id,
        fieldName: field.name,
        lat: field.lat,
        lng: field.lng,
        title: title || undefined,
        description: description || undefined,
        date,
        time,
        endTime: endTime || undefined,
        maxPlayers,
        visibility,
      });
      router.push(`/wydarzenia/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian');
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  if (pageLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        </main>
      </div>
    );
  }

  if (notAllowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-gray-500">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-700">Brak dostępu</p>
            <p className="text-sm mt-1">Tylko organizator może edytować wydarzenie.</p>
            <Link href={`/wydarzenia/${id}`} className="text-primary-600 text-sm underline mt-4 inline-block">
              Wróć do wydarzenia
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/wydarzenia/${id}`} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Edytuj wydarzenie</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sport */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
            <select value={sport} onChange={(e) => setSport(e.target.value)} className={inputCls}>
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Venue */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Boisko {field && <span className="text-primary-600">— {field.name}</span>}
            </label>
            <p className="text-xs text-gray-500 mb-2">Kliknij pinezkę na mapie, aby zmienić boisko.</p>
            <div className="h-72 rounded-xl overflow-hidden border border-gray-200">
              <VenuePicker selectedId={field?.id} onSelect={setField} />
            </div>
            {field && (
              <div className="mt-2 flex gap-3 items-center bg-gray-50 rounded-lg p-2">
                {venueThumbnail(field.lat, field.lng, 160, 100) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={venueThumbnail(field.lat, field.lng, 160, 100)!}
                    alt={field.name}
                    className="w-20 h-14 object-cover rounded-md shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{field.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" /> {field.address}
                  </p>
                  {field.surface && (
                    <p className="text-xs text-gray-400">{surfaceLabel(field.surface)}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Date / start time / end time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rozpoczęcie</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zakończenie <span className="text-gray-400 font-normal">(opcjonalnie)</span>
              </label>
              <input
                type="time" value={endTime} min={time}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
              />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tytuł <span className="text-gray-400 font-normal">(opcjonalnie)</span>
            </label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Czwartkowa ligówka" className={inputCls} maxLength={80}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opis <span className="text-gray-400 font-normal">(opcjonalnie)</span>
            </label>
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

          <div className="flex gap-3">
            <Link href={`/wydarzenia/${id}`} className="flex-1">
              <Button type="button" variant="outline" className="w-full" size="lg">Anuluj</Button>
            </Link>
            <Button type="submit" size="lg" isLoading={submitting} className="flex-1">
              Zapisz zmiany
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
