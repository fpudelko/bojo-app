'use client';

import { useState, useEffect } from 'react';
import { Bell, Trash2, Plus, Clock } from 'lucide-react';
import { getEventReminders, addReminder, deleteReminder } from '@/lib/reminders';
import type { EventReminder, ReminderChannel } from '@/types';

const MAX_REMINDERS = 5;

const PRESET_OFFSETS: { label: string; minutes: number }[] = [
  { label: '7 dni przed',  minutes: 7 * 24 * 60 },
  { label: '3 dni przed',  minutes: 3 * 24 * 60 },
  { label: '1 dzień przed', minutes: 24 * 60 },
  { label: '12h przed',    minutes: 12 * 60 },
  { label: '3h przed',     minutes: 3 * 60 },
  { label: '1h przed',     minutes: 60 },
  { label: 'Własne…',      minutes: 0 },
];

const CHANNEL_OPTIONS: { value: ReminderChannel; label: string }[] = [
  { value: 'sms',   label: 'SMS' },
  { value: 'email', label: 'E-mail' },
  { value: 'both',  label: 'SMS + E-mail' },
];

function offsetLabel(minutes: number): string {
  if (minutes >= 24 * 60 && minutes % (24 * 60) === 0) {
    const d = minutes / (24 * 60);
    return `${d} ${d === 1 ? 'dzień' : 'dni'} przed`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h przed`;
  return `${h}h ${m}min przed`;
}

interface Props {
  eventId: string;
}

export default function RemindersSection({ eventId }: Props) {
  const [reminders, setReminders] = useState<EventReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [selectedPreset, setSelectedPreset] = useState<number>(60);
  const [customMinutes, setCustomMinutes] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<ReminderChannel>('sms');

  useEffect(() => {
    getEventReminders(eventId)
      .then(setReminders)
      .catch(() => setError('Nie udało się załadować przypomnień'))
      .finally(() => setLoading(false));
  }, [eventId]);

  async function handleAdd() {
    const minutes = isCustom ? parseInt(customMinutes, 10) : selectedPreset;
    if (!minutes || minutes <= 0) { setError('Podaj czas przypomnienia'); return; }
    if (reminders.length >= MAX_REMINDERS) { setError(`Maksymalnie ${MAX_REMINDERS} przypomnień`); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await addReminder(eventId, { offsetMinutes: minutes, message: message || undefined, channel });
      setReminders((prev) => [...prev, r].sort((a, b) => b.offsetMinutes - a.offsetMinutes));
      setShowForm(false);
      setMessage('');
      setIsCustom(false);
      setSelectedPreset(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await deleteReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Przypomnienia
        </h2>
        {reminders.length < MAX_REMINDERS && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800"
          >
            <Plus className="w-3.5 h-3.5" /> Dodaj
          </button>
        )}
      </div>

      {/* Existing reminders list */}
      {reminders.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {reminders.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800">
                    <Clock className="w-3 h-3 text-green-700" /> {offsetLabel(r.offsetMinutes)}
                  </span>
                  <span className="text-xs text-slate-400 uppercase tracking-wide">{r.channel}</span>
                  {r.sent && (
                    <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">Wysłano</span>
                  )}
                </div>
                {r.message && (
                  <p className="text-xs text-slate-500 mt-1 truncate">"{r.message}"</p>
                )}
              </div>
              {!r.sent && (
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={busy}
                  className="shrink-0 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : !showForm ? (
        <p className="text-sm text-slate-400 text-center py-3">
          Brak przypomnień. Gracze nie dostają powiadomień przed meczem.
        </p>
      ) : null}

      {/* Add form */}
      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          {/* Time offset */}
          <div>
            <p className="text-xs font-medium text-slate-700 mb-1.5">Czas przed meczem</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_OFFSETS.map((p) => {
                const isThisCustom = p.minutes === 0;
                const active = isThisCustom ? isCustom : (!isCustom && selectedPreset === p.minutes);
                return (
                  <button
                    key={p.minutes}
                    type="button"
                    onClick={() => {
                      if (isThisCustom) { setIsCustom(true); }
                      else { setIsCustom(false); setSelectedPreset(p.minutes); }
                    }}
                    className={[
                      'px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors',
                      active
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                    ].join(' ')}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {isCustom && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10080}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="np. 90"
                  className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
                <span className="text-sm text-slate-500">minut przed</span>
              </div>
            )}
          </div>

          {/* Channel */}
          <div>
            <p className="text-xs font-medium text-slate-700 mb-1.5">Kanał</p>
            <div className="flex gap-2">
              {CHANNEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannel(opt.value)}
                  className={[
                    'px-3 py-1 rounded-lg border text-xs font-medium transition-colors',
                    channel === opt.value
                      ? 'bg-green-700 text-white border-green-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional message */}
          <div>
            <p className="text-xs font-medium text-slate-700 mb-1.5">Wiadomość (opcjonalna)</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="np. Pamiętaj o czarnej koszulce, szatnia nr 3…"
              rows={2}
              maxLength={200}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="flex-1 py-2 rounded-xl border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy}
              className="flex-1 py-2 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
            >
              {busy ? 'Dodawanie…' : 'Dodaj przypomnienie'}
            </button>
          </div>
        </div>
      )}

      {error && !showForm && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <p className="text-xs text-slate-400 mt-3">
        Przypomnienia są wysyłane automatycznie przed meczem do graczy z numerem telefonu / e-mailem.
        Maksymalnie {MAX_REMINDERS} przypomnień na mecz.
      </p>
    </div>
  );
}
