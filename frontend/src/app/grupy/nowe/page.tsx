'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MapPin, ChevronDown, ChevronUp, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import VenuePicker from '@/components/map/VenuePicker';
import { useAuth } from '@/lib/auth';
import { createGroup } from '@/lib/groups';
import { useToast } from '@/lib/toast';
import { FOCUS_SPORTS, sportLabel, sportEmoji } from '@/lib/sports';

export default function NewGroupPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('');
  const [city, setCity] = useState('');
  const [fieldId, setFieldId] = useState<string | undefined>(undefined);
  const [fieldName, setFieldName] = useState<string | undefined>(undefined);
  const [venueOpen, setVenueOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const inputCls =
    'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';

  const handleSubmit = async () => {
    if (!user || name.trim().length < 2) return;
    setSubmitting(true);
    try {
      const id = await createGroup(
        { name, description: description || undefined, sport: sport || undefined, city: city || undefined, fieldId, fieldName },
        user.id,
      );
      toast('Grupa utworzona! 🎉');
      router.push(`/grupy/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się utworzyć grupy', 'error');
      setSubmitting(false);
    }
  };

  if (!loading && !user) {
    if (typeof window !== 'undefined') window.location.href = `/logowanie?next=${encodeURIComponent('/grupy/nowe')}`;
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Wróć
        </button>

        <h1 className="font-display text-2xl font-bold text-ink mb-6">Nowa grupa</h1>

        <div className="space-y-5 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nazwa grupy *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Czwartkowa gierka"
              maxLength={60}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Sport</label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_SPORTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSport(sport === s ? '' : s)}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    sport === s ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <span>{sportEmoji(s)}</span> {sportLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Miasto / dzielnica</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="np. Mokotów"
              maxLength={60}
              className={inputCls}
            />
          </div>

          {/* Optional venue */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Boisko (opcjonalnie)</label>
            {fieldName ? (
              <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 dark:bg-primary-950 px-3 py-2.5 text-sm">
                <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
                <span className="flex-1 truncate text-primary-800 dark:text-primary-200">{fieldName}</span>
                <button type="button" onClick={() => { setFieldId(undefined); setFieldName(undefined); }} className="text-slate-400 hover:text-red-500" aria-label="Usuń boisko">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setVenueOpen((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4" /> Przypisz boisko grupy</span>
                {venueOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            {venueOpen && !fieldName && (
              <div className="mt-2 h-[320px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <VenuePicker
                  sport={sport || undefined}
                  onSelect={(f) => { setFieldId(f.id); setFieldName(f.name); setVenueOpen(false); }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Opis (opcjonalnie)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kilka słów o grupie…"
              rows={3}
              maxLength={300}
              className={inputCls}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={name.trim().length < 2 || submitting}
            className="w-full inline-flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Stwórz grupę'}
          </Button>
        </div>
      </main>
    </div>
  );
}
