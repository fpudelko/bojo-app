'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Lock, BarChart3, Users, LogIn, CalendarPlus, UserPlus,
  UsersRound, RefreshCw, TrendingUp,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { AnalyticsEvent } from '@/lib/analytics';

interface Row {
  id: string;
  user_id: string | null;
  user_email: string | null;
  event_type: string;
  path: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const TYPE_LABELS: Record<AnalyticsEvent | string, string> = {
  login: 'Logowanie',
  event_created: 'Utworzył mecz',
  event_joined: 'Dołączył do meczu',
  group_created: 'Utworzył grupę',
  group_joined: 'Dołączył do grupy',
  wizard_step: 'Krok kreatora',
  wizard_summary_open: 'Otworzył podsumowanie',
  event_shared: 'Wysłał link do meczu',
  event_link_opened: 'Otworzył link do meczu',
  guest_joined: 'Zapis bez konta',
  guest_claimed: 'Gość założył konto',
  settlement_shared: 'Wysłał rozliczenie',
};

const DAY = 24 * 60 * 60 * 1000;

/** Local YYYY-MM-DD key for day-bucketing. */
function dayKey(d: Date): string {
  return d.toLocaleDateString('sv-SE'); // ISO-like in local tz
}

export default function AnalyticsAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [adminState, setAdminState] = useState<'checking' | 'yes' | 'no'>('checking');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Admin check ---
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAdminState('no'); return; }
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => setAdminState(data?.is_admin ? 'yes' : 'no'), () => setAdminState('no'));
  }, [authLoading, user]);

  // --- Load last 30 days ---
  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const { data } = await supabase
      .from('analytics_events')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (adminState === 'yes') load(); }, [adminState, load]);

  // --- Derived metrics ---
  const stats = useMemo(() => {
    const now = Date.now();
    const since1 = now - DAY;
    const since7 = now - 7 * DAY;

    const within = (r: Row, from: number) => new Date(r.created_at).getTime() >= from;
    const distinctUsers = (rs: Row[]) =>
      new Set(rs.filter((r) => r.user_id).map((r) => r.user_id)).size;

    const today = rows.filter((r) => within(r, since1));
    const week = rows.filter((r) => within(r, since7));

    const countType = (rs: Row[], t: string) => rs.filter((r) => r.event_type === t).length;

    // Returning users: distinct users active on ≥2 different days in the window
    const daysByUser = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!r.user_id) continue;
      const set = daysByUser.get(r.user_id) ?? new Set<string>();
      set.add(dayKey(new Date(r.created_at)));
      daysByUser.set(r.user_id, set);
    }
    let returning = 0;
    daysByUser.forEach((days) => { if (days.size >= 2) returning += 1; });
    const totalUsers30 = daysByUser.size;

    // Daily activity (distinct active users) for last 14 days
    const daily: { day: string; users: number; events: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      const key = dayKey(d);
      const dayRows = rows.filter((r) => dayKey(new Date(r.created_at)) === key);
      daily.push({
        day: key.slice(5), // MM-DD
        users: new Set(dayRows.filter((r) => r.user_id).map((r) => r.user_id)).size,
        events: dayRows.length,
      });
    }

    return {
      activeToday: distinctUsers(today),
      active7: distinctUsers(week),
      active30: totalUsers30,
      loginsToday: countType(today, 'login'),
      logins7: countType(week, 'login'),
      eventsCreated7: countType(week, 'event_created'),
      eventsJoined7: countType(week, 'event_joined'),
      groupsCreated7: countType(week, 'group_created'),
      groupsJoined7: countType(week, 'group_joined'),
      returning,
      totalUsers30,
      retentionPct: totalUsers30 > 0 ? Math.round((returning / totalUsers30) * 100) : 0,
      daily,
    };
  }, [rows]);

  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.events));

  // ---- Guards ----
  if (authLoading || adminState === 'checking') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        </main>
      </div>
    );
  }

  if (adminState === 'no') {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">Brak dostępu</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Analityka jest dostępna tylko dla administratorów.
            </p>
            <Link href="/" className="text-primary-600 text-sm underline mt-4 inline-block">Wróć na stronę główną</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary-700" /> Analityka
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {loading ? 'Ładowanie…' : `Ostatnie 30 dni · ${rows.length} zdarzeń`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Odśwież
          </button>
        </div>

        {/* Active users */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <StatCard icon={Users} label="Aktywni dziś" value={stats.activeToday} accent />
          <StatCard icon={Users} label="Aktywni / 7 dni" value={stats.active7} />
          <StatCard icon={Users} label="Aktywni / 30 dni" value={stats.active30} />
        </div>

        {/* Retention highlight */}
        <div className="mb-3 rounded-2xl border border-primary-100 bg-primary-50 p-5">
          <div className="flex items-center gap-2 text-primary-800">
            <TrendingUp className="w-5 h-5" />
            <p className="font-semibold">Retencja (30 dni)</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-primary-900">
            {stats.retentionPct}%
            <span className="ml-2 text-sm font-medium text-primary-700">
              {stats.returning} z {stats.totalUsers30} użytkowników wróciło w innym dniu
            </span>
          </p>
          <p className="mt-1 text-xs text-primary-700/80">
            To kluczowy miernik — ilu graczy wraca po pierwszej wizycie. Tę liczbę chcemy ruszyć w górę.
          </p>
        </div>

        {/* Action counts (7d) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <StatCard icon={LogIn} label="Logowania / 7 dni" value={stats.logins7} sub={`dziś: ${stats.loginsToday}`} />
          <StatCard icon={CalendarPlus} label="Mecze utworzone / 7 dni" value={stats.eventsCreated7} />
          <StatCard icon={UserPlus} label="Dołączenia do meczów / 7 dni" value={stats.eventsJoined7} />
          <StatCard icon={UsersRound} label="Grupy utworzone / 7 dni" value={stats.groupsCreated7} />
          <StatCard icon={UserPlus} label="Dołączenia do grup / 7 dni" value={stats.groupsJoined7} />
        </div>

        {/* Daily activity chart */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="font-semibold text-ink mb-4">Aktywność dzienna (14 dni)</p>
          <div className="flex items-end gap-1.5 h-32">
            {stats.daily.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full flex flex-col justify-end h-28">
                  <div
                    className="w-full rounded-t bg-primary-600 group-hover:bg-primary-700 transition-colors relative"
                    style={{ height: `${(d.events / maxDaily) * 100}%` }}
                    title={`${d.day}: ${d.events} zdarzeń, ${d.users} aktywnych`}
                  />
                </div>
                <span className="text-[9px] text-slate-400 -rotate-45 origin-center whitespace-nowrap">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Raw log */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <p className="font-semibold text-ink px-5 pt-4 pb-2">Ostatnie zdarzenia</p>
          {loading ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-slate-500 py-12 text-sm">Brak zdarzeń. Pojawią się gdy użytkownicy zaczną korzystać z aplikacji.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.slice(0, 100).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="inline-flex shrink-0 items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {TYPE_LABELS[r.event_type] ?? r.event_type}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-slate-600">
                    {r.user_email ?? <span className="text-slate-400">anonim</span>}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{formatWhen(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-primary-200 bg-white' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-1.5 text-slate-500">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold text-ink">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'teraz';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min temu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h temu`;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
