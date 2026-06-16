'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, User, Trophy, Calendar, Check, Star, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import Header from '@/components/layout/Header';
import { getPublicPlayer, getPlayerStats, getPlayerHistory, type PublicPlayer } from '@/lib/players';
import { sportEmoji } from '@/lib/sports';
import type { PlayerAggregateStats, PlayerHistoryItem } from '@/types';

export default function PublicPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicPlayer | null>(null);
  const [stats, setStats] = useState<PlayerAggregateStats | null>(null);
  const [history, setHistory] = useState<PlayerHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const p = await getPublicPlayer(id);
        if (!p) { setNotFound(true); return; }
        setProfile(p);
        const [s, h] = await Promise.all([getPlayerStats(id), getPlayerHistory(id)]);
        setStats(s);
        setHistory(h);
      } catch (e) {
        console.error('[PublicProfile]', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const attendanceRate =
    stats && stats.eventsJoined > 0
      ? Math.round((stats.attended / stats.eventsJoined) * 100)
      : null;

  const reliablePlayer = attendanceRate !== null && attendanceRate >= 80 && stats!.eventsJoined >= 5;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20 text-slate-300">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : notFound || !profile ? (
          <div className="text-center py-20">
            <p className="text-slate-400 mb-4">Nie znaleziono gracza</p>
            <Link href="/wydarzenia" className="text-primary-700 text-sm font-medium hover:underline">
              Wróć do wydarzeń
            </Link>
          </div>
        ) : (
          <>
            {/* Profile card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center gap-4">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="w-16 h-16 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                    <User className="w-7 h-7" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-ink">{profile.displayName}</h1>
                    {reliablePlayer && (
                      <span
                        title="Niezawodny gracz (powyżej 80% frekwencji, min. 5 meczów)"
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium"
                      >
                        <Star className="w-3 h-3" /> Niezawodny
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">
                    W Bojo od {new Date(profile.createdAt).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4" /> Statystyki
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <StatBox
                    icon={<Calendar className="w-4 h-4" />}
                    label="Mecze dołączone"
                    value={stats.eventsJoined}
                  />
                  <StatBox
                    icon={<Check className="w-4 h-4" />}
                    label="Mecze rozegrane"
                    value={stats.matchesPlayed}
                    color="text-green-700"
                  />
                  <StatBox
                    icon={<Trophy className="w-4 h-4" />}
                    label="Gole"
                    value={stats.goalsTotal}
                    color="text-amber-600"
                  />
                  <StatBox
                    icon={<Star className="w-4 h-4" />}
                    label="Zorganizowane"
                    value={stats.eventsOrganized}
                    color="text-primary-700"
                  />
                </div>

                {attendanceRate !== null && stats.attended > 0 && stats.eventsJoined >= 3 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-slate-500">Frekwencja</span>
                      <span className={[
                        'font-semibold',
                        attendanceRate >= 80 ? 'text-green-700' : attendanceRate >= 60 ? 'text-amber-600' : 'text-red-500',
                      ].join(' ')}>
                        {attendanceRate}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={[
                          'h-full rounded-full transition-all',
                          attendanceRate >= 80 ? 'bg-green-500' : attendanceRate >= 60 ? 'bg-amber-400' : 'bg-red-400',
                        ].join(' ')}
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Game history */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4" /> Historia gier
              </h2>
              {history.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">Brak rozegranych meczów.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <li key={h.eventId}>
                      <Link
                        href={`/wydarzenia/${h.eventId}`}
                        className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-2xl shrink-0" aria-hidden="true">{sportEmoji(h.sport)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {h.title || h.fieldName}
                          </p>
                          <p className="text-xs text-slate-400">
                            {(() => { try { return format(parseISO(h.date), 'd MMM yyyy', { locale: pl }); } catch { return h.date; } })()}
                            {h.isOrganizer && ' · organizator'}
                            {h.isReserve && ' · rezerwa'}
                          </p>
                        </div>
                        {h.goals > 0 && (
                          <span className="shrink-0 text-xs font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                            {h.goals} {h.goals === 1 ? 'gol' : 'gole'}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 shrink-0 text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatBox({
  icon, label, value, color = 'text-slate-800',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className={`flex items-center gap-1.5 text-xs mb-1 ${color}`}>
        {icon}
        <span className="text-slate-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
