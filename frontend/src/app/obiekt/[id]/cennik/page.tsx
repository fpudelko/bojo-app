'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Trash2, Lock, Plus } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getField } from '@/lib/api';
import { getVenuePricing, saveVenuePricing } from '@/lib/bookings';
import type { Field, VenuePricing } from '@/types';

const DAY_NAMES = ['', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

type RuleDraft = Omit<VenuePricing, 'id' | 'fieldId' | 'createdAt'>;

const emptyDraft = (): RuleDraft => ({
  name: '',
  priceGrosze: 0,
  dayOfWeek: undefined,
  timeFrom: undefined,
  timeTo: undefined,
  priority: 0,
});

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

function formatPrice(grosze: number) {
  return (grosze / 100).toFixed(0) + ' zł';
}

function formatDays(days?: number[]) {
  if (!days || days.length === 0) return 'Wszystkie dni';
  return days.map((d) => DAY_NAMES[d]).join(', ');
}

function formatTime(from?: string, to?: string) {
  if (!from && !to) return 'Cały dzień';
  if (from && to) return `${from}–${to}`;
  if (from) return `od ${from}`;
  return `do ${to}`;
}

export default function CennikPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [field, setField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft());
  const [draftDays, setDraftDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); setNotAllowed(true); return; }

    Promise.all([getField(id), getVenuePricing(id)])
      .then(([f, pricing]) => {
        if (f.managerId !== user.id) { setNotAllowed(true); return; }
        setField(f);
        setRules(
          pricing.map(({ name, priceGrosze, dayOfWeek, timeFrom, timeTo, priority }) => ({
            name,
            priceGrosze,
            dayOfWeek,
            timeFrom,
            timeTo,
            priority,
          })),
        );
      })
      .catch(() => setNotAllowed(true))
      .finally(() => setLoading(false));
  }, [authLoading, user, id]);

  const toggleDraftDay = (day: number) => {
    setDraftDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const addRule = () => {
    if (!draft.name.trim()) { setError('Podaj nazwę reguły.'); return; }
    if (draft.priceGrosze <= 0) { setError('Podaj cenę większą od 0.'); return; }
    setError(null);
    setRules((prev) => [
      ...prev,
      { ...draft, dayOfWeek: draftDays.length > 0 ? [...draftDays].sort() : undefined },
    ]);
    setDraft(emptyDraft());
    setDraftDays([]);
  };

  const removeRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveVenuePricing(id, rules);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać cennika.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-8 w-40 bg-slate-200 rounded-lg animate-pulse mb-8" />
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
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
            <Lock className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            <p className="font-medium text-slate-700">Brak dostępu</p>
            <Link href={`/obiekt/${id}`} className="text-primary-600 text-sm underline mt-3 inline-block">
              Wróć do obiektu
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/obiekt/${id}`}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cennik</h1>
            {field && <p className="text-sm text-slate-500">{field.name}</p>}
          </div>
        </div>

        {rules.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-4 text-sm text-amber-800">
            Dodaj przynajmniej jedną regułę — np. &quot;Standardowa&quot; 100 zł przez cały tydzień.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
            {rules.map((rule, idx) => (
              <div
                key={idx}
                className={[
                  'flex items-center justify-between gap-3 px-5 py-4',
                  idx < rules.length - 1 ? 'border-b border-slate-100' : '',
                ].join(' ')}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 truncate">{rule.name}</p>
                    <span className="text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 rounded-full px-2 py-0.5">
                      {formatPrice(rule.priceGrosze)}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                      prioryt. {rule.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDays(rule.dayOfWeek)} &middot; {formatTime(rule.timeFrom, rule.timeTo)}
                  </p>
                </div>
                <button
                  onClick={() => removeRule(idx)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  aria-label="Usuń regułę"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 mb-4">
          <p className="text-sm font-semibold text-slate-700">Dodaj regułę</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nazwa</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder='np. "Szczyt"'
                className={inputCls}
                maxLength={60}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cena (PLN)</label>
              <input
                type="number"
                value={draft.priceGrosze > 0 ? draft.priceGrosze / 100 : ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, priceGrosze: Math.round(Number(e.target.value) * 100) }))
                }
                placeholder="100"
                min={0}
                step={1}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              Dni tygodnia <span className="text-slate-400">(brak zaznaczenia = wszystkie)</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <label key={day} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draftDays.includes(day)}
                    onChange={() => toggleDraftDay(day)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-xs text-slate-700">{DAY_NAMES[day].slice(0, 3)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Od godziny <span className="text-slate-400">(opcjonalnie)</span>
              </label>
              <input
                type="time"
                value={draft.timeFrom ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, timeFrom: e.target.value || undefined }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Do godziny <span className="text-slate-400">(opcjonalnie)</span>
              </label>
              <input
                type="time"
                value={draft.timeTo ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, timeTo: e.target.value || undefined }))
                }
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Priorytet</label>
            <input
              type="number"
              value={draft.priority}
              onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))}
              min={0}
              className={inputCls}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          <Button type="button" variant="outline" onClick={addRule} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Dodaj regułę
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} isLoading={saving} size="lg">
            Zapisz cennik
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
