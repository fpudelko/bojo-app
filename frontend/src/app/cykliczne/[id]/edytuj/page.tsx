'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Globe, MapPin } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import VenuePicker from '@/components/map/VenuePicker';
import { useAuth } from '@/lib/auth';
import { getRecurringEvent, updateRecurringEvent, DAY_OPTIONS } from '@/lib/recurring';
import { getField } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import type { Field, Visibility } from '@/types';

const SPORTS = [
  'piłka nożna', 'futsal', 'koszykówka', 'siatkówka',
  'siatkówka plażowa', 'piłka ręczna', 'inne',
];

/**
 * Edycja szablonu stałej gierki — reguły powtarzania.
 *
 * Zastępuje zaślepkę („Ta funkcja jest jeszcze w przygotowaniu"). Bez tego
 * ekranu dzień tygodnia i wyprzedzenie były nieedytowalne po utworzeniu serii,
 * a od migracji `073` to właśnie one sterują automatycznym tworzeniem terminów.
 *
 * Zakres pól celowo pokrywa się z `/cykliczne/nowe`: szablon niesie regułę
 * powtarzania, a NIE komplet ustawień meczu. Cena, płatności, bramkarze czy
 * akceptacja zapisów dziedziczą się z ostatniego terminu serii — edytuje się je
 * na konkretnym meczu (z pytaniem o zakres). Patrz docs/domena.md.
 */
export default function EditRecurringEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

  const [sport, setSport] = useState('piłka nożna');
  const [field, setField] = useState<Field | null>(null);
  const [fieldName, setFieldName] = useState('');
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

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setNotAllowed(true); setPageLoading(false); return; }

    getRecurringEvent(id)
      .then(async ({ event: ev }) => {
        if (ev.organizerId !== user.id) { setNotAllowed(true); return; }

        setSport(ev.sport);
        setFieldName(ev.fieldName);
        setDayOfWeek(ev.dayOfWeek);
        setEventTime(ev.eventTime.slice(0, 5));
        setEndTime(ev.endTime ? ev.endTime.slice(0, 5) : '');
        setMaxPlayers(ev.maxPlayers);
        setTitle(ev.title ?? '');
        setDescription(ev.description ?? '');
        setVisibility(ev.visibility);
        // Stare szablony mogą mieć 0 („nie wysyłaj przypomnień" ze starej
        // semantyki). Dziś ta wartość steruje otwarciem zapisów, a 0 znaczyłoby
        // „utwórz termin w dniu meczu" — podnosimy do minimum suwaka.
        setNotifyDaysBefore(Math.max(1, ev.notifyDaysBefore));

        if (ev.fieldId) {
          try {
            setField(await getField(ev.fieldId));
          } catch {
            // Boisko mogło zniknąć z katalogu — zostaje sama nazwa z szablonu.
          }
        }
      })
      .catch(() => setNotAllowed(true))
      .finally(() => setPageLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (endTime && endTime <= eventTime) {
      setError('Godzina zakończenia musi być późniejsza niż rozpoczęcia.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateRecurringEvent(id, {
        sport,
        fieldId: field?.id,
        // Boisko nie jest wymagane do zmiany — gdy organizator go nie ruszył,
        // zostaje nazwa z szablonu zamiast pustego stringa.
        fieldName: field?.name ?? fieldName,
        lat: field?.lat,
        lng: field?.lng,
        title: title || undefined,
        description: description || undefined,
        dayOfWeek,
        eventTime,
        endTime: endTime || undefined,
        maxPlayers,
        visibility,
        notifyDaysBefore,
      });
      router.push(`/cykliczne/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian');
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  if (pageLoading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">
          <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-72 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        </main>
      </div>
    );
  }

  if (notAllowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">Brak dostępu</p>
            <p className="text-sm text-slate-500 mt-1">Tylko organizator może edytować ten szablon.</p>
            <Link href="/cykliczne" className="text-primary-600 text-sm underline mt-4 inline-block">
              Wróć do listy
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
        <Link
          href={`/cykliczne/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Wróć do stałej gierki
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Ustawienia stałej gierki</h1>
        <p className="text-sm text-slate-500 mb-6">
          Zmiany dotyczą kolejnych terminów. Już utworzone mecze zostają bez zmian — te edytujesz
          na samym meczu.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sport */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sport</label>
            <select value={sport} onChange={(e) => setSport(e.target.value)} className={inputCls}>
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Venue */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Boisko {(field?.name ?? fieldName) && (
                <span className="text-primary-600">— {field?.name ?? fieldName}</span>
              )}
            </label>
            <p className="text-xs text-slate-500 mb-2">Kliknij pinezkę na mapie, aby zmienić boisko.</p>
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

          {/* Reguła powtarzania */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Dzień tygodnia</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className={inputCls}
              >
                {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rozpoczęcie</label>
              <input
                type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)}
                className={inputCls} required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Zakończenie <span className="text-slate-400 font-normal">(opcjonalnie)</span>
              </label>
              <input
                type="time" value={endTime} min={eventTime}
                onChange={(e) => setEndTime(e.target.value)} className={inputCls}
              />
            </div>
          </div>

          {/* Max players */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tytuł <span className="text-slate-400 font-normal">(opcjonalnie)</span>
            </label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Czwartkowa ligówka" className={inputCls} maxLength={80}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Opis <span className="text-slate-400 font-normal">(opcjonalnie)</span>
            </label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Poziom, zasady, co zabrać…" rows={3} className={inputCls}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Widoczność</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button" onClick={() => setVisibility('public')}
                className={[
                  'flex items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                  visibility === 'public' ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400',
                ].join(' ')}
              >
                <Globe className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Publiczne</span>
                  <span className="block text-xs text-slate-500">Widoczne dla wszystkich</span>
                </span>
              </button>
              <button
                type="button" onClick={() => setVisibility('private')}
                className={[
                  'flex items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                  visibility === 'private' ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400',
                ].join(' ')}
              >
                <Lock className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Prywatne</span>
                  <span className="block text-xs text-slate-500">Nie pojawia się na liście. Wchodzą zaproszeni, grupa i osoby z linkiem</span>
                </span>
              </button>
            </div>
          </div>

          {/* Wyprzedzenie — od migracji 073 steruje automatycznym tworzeniem terminu */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Otwieraj zapisy:{' '}
              <span className="text-primary-600 font-semibold">
                {notifyDaysBefore === 1 ? '1 dzień' : `${notifyDaysBefore} dni`} przed terminem
              </span>
            </label>
            <input
              type="range" min={1} max={14} value={notifyDaysBefore}
              onChange={(e) => setNotifyDaysBefore(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
            <p className="text-xs text-slate-500 mt-1">
              Bojo samo utworzy kolejny termin z tym wyprzedzeniem, a gracze z poprzedniego
              meczu dostaną powiadomienie, że zapisy są otwarte.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Link href={`/cykliczne/${id}`} className="flex-1">
              <Button type="button" variant="outline" size="lg" className="w-full">Anuluj</Button>
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
