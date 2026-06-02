'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Lock } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getField } from '@/lib/api';
import { getVenueSchedules, saveVenueSchedules } from '@/lib/bookings';
import type { Field } from '@/types';

const DAY_NAMES = ['', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

const SLOT_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
  { value: 120, label: '120 min' },
];

interface DayState {
  open: boolean;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
}

const defaultDay = (): DayState => ({
  open: false,
  openTime: '08:00',
  closeTime: '22:00',
  slotMinutes: 60,
});

const inputCls =
  'border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

export default function HarmonogramPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [field, setField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<Record<number, DayState>>(
    Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, defaultDay()])),
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); setNotAllowed(true); return; }

    Promise.all([getField(id), getVenueSchedules(id)])
      .then(([f, schedules]) => {
        if (f.managerId !== user.id) { setNotAllowed(true); return; }
        setField(f);
        setDays((prev) => {
          const next = { ...prev };
          schedules.forEach((s) => {
            next[s.dayOfWeek] = {
              open: true,
              openTime: s.openTime.slice(0, 5),
              closeTime: s.closeTime.slice(0, 5),
              slotMinutes: s.slotMinutes,
            };
          });
          return next;
        });
      })
      .catch(() => setNotAllowed(true))
      .finally(() => setLoading(false));
  }, [authLoading, user, id]);

  const setDay = (day: number, patch: Partial<DayState>) => {
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const enabled = [1, 2, 3, 4, 5, 6, 7]
        .filter((d) => days[d].open)
        .map((d) => ({
          dayOfWeek: d,
          openTime: days[d].openTime,
          closeTime: days[d].closeTime,
          slotMinutes: days[d].slotMinutes,
        }));
      await saveVenueSchedules(id, enabled);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać harmonogramu.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-8 w-56 bg-gray-200 rounded-lg animate-pulse mb-8" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (notAllowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <Lock className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <p className="font-medium text-gray-700">Brak dostępu</p>
            <Link href={`/obiekt/${id}`} className="text-primary-600 text-sm underline mt-3 inline-block">
              Wróć do obiektu
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/obiekt/${id}`}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Harmonogram</h1>
            {field && <p className="text-sm text-gray-500">{field.name}</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          {[1, 2, 3, 4, 5, 6, 7].map((day, idx) => {
            const state = days[day];
            const isLast = idx === 6;
            return (
              <div
                key={day}
                className={[
                  'px-5 py-4',
                  !isLast ? 'border-b border-gray-100' : '',
                  !state.open ? 'bg-gray-50/60' : '',
                ].join(' ')}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-[140px]">
                    <input
                      type="checkbox"
                      checked={state.open}
                      onChange={(e) => setDay(day, { open: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span
                      className={[
                        'text-sm font-medium',
                        state.open ? 'text-gray-900' : 'text-gray-400',
                      ].join(' ')}
                    >
                      {DAY_NAMES[day]}
                    </span>
                  </label>

                  {state.open ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">od</span>
                        <input
                          type="time"
                          value={state.openTime}
                          onChange={(e) => setDay(day, { openTime: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">do</span>
                        <input
                          type="time"
                          value={state.closeTime}
                          onChange={(e) => setDay(day, { closeTime: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <select
                        value={state.slotMinutes}
                        onChange={(e) => setDay(day, { slotMinutes: Number(e.target.value) })}
                        className={inputCls}
                      >
                        {SLOT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Zamknięty</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} isLoading={saving} size="lg">
            Zapisz harmonogram
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <Check className="w-4 h-4" /> Zapisano
            </span>
          )}
        </div>
      </main>
    </div>
  );
}
