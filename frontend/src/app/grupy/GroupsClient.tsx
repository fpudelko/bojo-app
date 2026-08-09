'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, LogIn, ChevronRight, Plus, ArrowRight, Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getMyGroups, getGroupByCode, joinGroup } from '@/lib/groups';
import { useToast } from '@/lib/toast';
import { sportEmoji } from '@/lib/sports';
import type { Group } from '@/types';
import { withCount } from '@/lib/plural';

export default function GroupsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getMyGroups(user.id)
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleJoin = async () => {
    if (!user || code.trim().length < 4) return;
    setJoining(true);
    try {
      const group = await getGroupByCode(code);
      if (!group) { toast('Nie znaleziono grupy o tym kodzie', 'error'); return; }
      await joinGroup(group.id, user.id);
      router.push(`/grupy/${group.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally {
      setJoining(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showMobileWordmark />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
              <Users className="w-7 h-7 text-primary-700" />
            </div>
            <h1 className="font-display text-2xl font-bold text-ink mb-2">Grupy</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Zaloguj się, aby tworzyć grupy i grać ze swoją ekipą.</p>
            <Button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent('/grupy')}`; }} className="inline-flex items-center gap-2">
              <LogIn className="w-4 h-4" /> Zaloguj się
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header showMobileWordmark />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Grupy</h1>
          <Link href="/grupy/nowe">
            <Button size="sm" className="inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nowa grupa</Button>
          </Link>
        </div>

        {/* Join by code */}
        <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
          <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200">Masz kod grupy?</p>
          <div className="flex gap-2 max-w-xs">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="K7QP4B"
              maxLength={8}
              className="w-32 min-w-0 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-mono text-base font-bold uppercase tracking-widest text-primary-700 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-slate-100"
            />
            <button
              onClick={handleJoin}
              disabled={code.trim().length < 4 || joining}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-800 active:scale-95 disabled:opacity-40"
            >
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Dołącz <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>

        {/* My groups */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-[72px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 animate-pulse" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
            <span className="text-5xl">👥</span>
            <p className="text-base font-semibold text-ink">Nie należysz jeszcze do żadnej grupy</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">Stwórz grupę dla swojej ekipy albo dołącz kodem od znajomego.</p>
            <Link href="/grupy/nowe" className="mt-1">
              <Button size="sm" className="inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Stwórz grupę</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/grupy/${g.id}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 px-4 py-3.5 shadow-sm hover:border-primary-200 hover:shadow-md transition-all group"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-2xl">
                  {g.sport ? sportEmoji(g.sport) : '👥'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink truncate">{g.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {withCount(g.memberCount ?? 0, 'członek', 'członkowie', 'członków')}
                    {g.city && ` · ${g.city}`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-primary-600 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
