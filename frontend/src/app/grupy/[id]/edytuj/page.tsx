'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getGroup, updateGroup } from '@/lib/groups';
import { useToast } from '@/lib/toast';
import { FOCUS_SPORTS, sportLabel, sportEmoji } from '@/lib/sports';

export default function EditGroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'notfound'>('loading');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const inputCls =
    'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';

  const load = useCallback(async () => {
    try {
      const g = await getGroup(id);
      if (!g) { setState('notfound'); return; }
      // Only the founder (creator) may edit.
      if (!user || g.createdBy !== user.id) { setState('denied'); return; }
      setName(g.name);
      setDescription(g.description ?? '');
      setSport(g.sport ?? '');
      setCity(g.city ?? '');
      setState('ok');
    } catch {
      setState('notfound');
    }
  }, [id, user]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const handleSubmit = async () => {
    if (name.trim().length < 2) return;
    setSubmitting(true);
    try {
      await updateGroup(id, {
        name,
        description: description || undefined,
        sport: sport || undefined,
        city: city || undefined,
      });
      toast('Zapisano zmiany');
      router.push(`/grupy/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error');
      setSubmitting(false);
    }
  };

  if (state === 'loading' || authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-canvas">
        <Header />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
          <div className="h-40 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 animate-pulse" />
        </main>
      </div>
    );
  }

  if (state === 'denied' || state === 'notfound') {
    return (
      <div className="min-h-screen flex flex-col bg-canvas">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-700 dark:text-slate-300">
              {state === 'denied' ? 'Tylko założyciel może edytować grupę' : 'Nie znaleziono grupy'}
            </p>
            <Link href={`/grupy/${id}`} className="text-primary-700 text-sm font-medium hover:underline mt-3 inline-block">
              Wróć do grupy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        <button onClick={() => router.push(`/grupy/${id}`)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Wróć
        </button>

        <h1 className="font-display text-2xl font-bold text-ink mb-6">Edytuj grupę</h1>

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
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Zapisz zmiany'}
          </Button>
        </div>
      </main>
    </div>
  );
}
