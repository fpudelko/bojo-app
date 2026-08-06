'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Globe, MapPin } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import VenuePicker from '@/components/map/VenuePicker';
import { useAuth, displayName } from '@/lib/auth';
import { createRecurringEvent } from '@/lib/recurring';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import type { Field, Visibility } from '@/types';

const SPORTS = [
  'piłka nożna',
  'futsal',
  'koszykówka',
  'siatkówka',
  'siatkówka plażowa',
  'piłka ręczna',
  'inne',
];

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Poniedziałek' },
  { value: 2, label: 'Wtorek' },
  { value: 3, label: 'Środa' },
  { value: 4, label: 'Czwartek' },
  { value: 5, label: 'Piątek' },
  { value: 6, label: 'Sobota' },
  { value: 7, label: 'Niedziela' },
];

function NewRecurringForm() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [sport, setSport] = useState('piłka nożna');
  const [field, setField] = useState<Field | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [eventTime, setEventTime] = useState('18:00');
  const [endTime, setEndTime] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <Lock className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            <h1 className="text-xl font-bold text-slate-900">
              Zaloguj się, aby tworzyć cykliczne wydarzenia
            </h1>
            <p className="text-slate-500 text-sm mt-2 mb-6">
              Potrzebujesz konta, żeby organizować regularne mecze i zarządzać grupą graczy.
            </p>
            <Button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname)}`; }}>Zaloguj się</Button>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!field) { setError('Wybierz boisko na mapie.'); return; }
    if (endTime && endTime <= eventTime) {
      setError('Godzina zakończenia musi być późniejsza niż rozpoczęcia.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const id = await createRecurringEvent(
        {
          sport,
          fieldId: field.id,
          fieldName: field.name,
          lat: field.lat,
          lng: field.lng,
          title: title || undefined,
          description: description || undefined,
          dayOfWeek,
          eventTime,
          endTime: endTime || undefined,
          maxPlayers,
          visibility,
          notifyDaysBefore,
        },
        user.id,
        displayName(user),
      );
      router.push(`/cykliczne/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć cyklicznego wydarzenia');
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  const notifyLabel =
    notifyDaysBefore === 0
      ? 'Nie wysyłaj przypomnień'
      : notifyDaysBefore === 1
      ? 'Wyślij zaproszenia 1 dzień przed wydarzeniem'
      : `Wyślij zaproszenia ${notifyDaysBefore} dni przed wydarzeniem`;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Nowe cykliczne wydarzenie</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sport */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sport</label>
            <select value={sport} onChange={(e) => setSport(e.target.value)} className={inputCls}>
              {SPORTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Venue */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Boisko {field && <span className="text-primary-600">— {field.name}</span>}
            </label>
            <p className="text-xs text-slate-500 mb-2">Kliknij pinezkę na mapie, aby wybrać boisko.</p>
            <div className="h-72 rounded-xl overflow-hidden border border-slate-200">
              <VenuePicker selectedId={field?.id} onSelect={setField} />
            </div>
            {field && (
              <div className="mt-2 flex gap-3 items-center bg-slate-50 rounded-lg p-2">
                {venueThumbnail(field.lat, field.lng, 160, 100) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={venueThumbnail(field.lat, field.lng, 160, 100)!}
                    alt={field.name}
                    className="w-20 h-14 object-cover rounded-md shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{field.name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" /> {field.address}
                  </p>
                  {field.surface && (
                    <p className="text-xs text-slate-400">{surfaceLabel(field.surface)}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Day of week + times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Dzień tygodnia</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className={inputCls}
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rozpoczęcie</label>
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Zakończenie <span className="text-slate-400 font-normal">(opcjonalnie)</span>
              </label>
              <input
                type="time"
                value={endTime}
                min={eventTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Max players */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Liczba miejsc: <span className="text-primary-600 font-semibold">{maxPlayers}</span>
            </label>
            <input
              type="range"
              min={2}
              max={30}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tytuł <span className="text-slate-400 font-normal">(opcjonalnie)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Czwartkowa ligówka"
              className={inputCls}
              maxLength={80}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Opis <span className="text-slate-400 font-normal">(opcjonalnie)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Poziom, zasady, co zabrać…"
              rows={3}
              className={inputCls}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Widoczność</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={[
                  'flex items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                  visibility === 'private'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-300 hover:border-slate-400',
                ].join(' ')}
              >
                <Lock className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Prywatne</span>
                  <span className="block text-xs text-slate-500">Nie pojawia się na liście. Wchodzą zaproszeni, ekipa i osoby z linkiem</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={[
                  'flex items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                  visibility === 'public'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-300 hover:border-slate-400',
                ].join(' ')}
              >
                <Globe className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Publiczne</span>
                  <span className="block text-xs text-slate-500">Widoczne dla wszystkich</span>
                </span>
              </button>
            </div>
          </div>

          {/* Notify days before */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Powiadamiaj graczy:{' '}
              <span className="text-primary-600 font-semibold">{notifyDaysBefore} dni wcześniej</span>
            </label>
            <input
              type="range"
              min={0}
              max={7}
              value={notifyDaysBefore}
              onChange={(e) => setNotifyDaysBefore(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
            <p className="text-xs text-slate-500 mt-1">{notifyLabel}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" isLoading={submitting} className="w-full">
            Utwórz cykliczne wydarzenie
          </Button>
        </form>
      </main>
    </div>
  );
}

export default function NewRecurringPage() {
  return (
    <Suspense>
      <NewRecurringForm />
    </Suspense>
  );
}
