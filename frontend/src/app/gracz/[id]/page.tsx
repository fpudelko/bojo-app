'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, User, Trophy, Calendar, Check, X, Star } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { supabase } from '@/lib/supabase';

interface PublicProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

interface PlayerStats {
  eventsOrganized: number;
  eventsJoined: number;
  eventsAttended: number;
  noShows: number;
  goalsTotal: number;
}

export default function PublicPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Profile
        const { data: profileRow, error: pErr } = await supabase
          .from('profiles')
          .select('id, avatar_url, created_at')
          .eq('id', id)
          .single();
        if (pErr || !profileRow) { setNotFound(true); return; }

        // Display name from auth metadata via participants table (most recent non-guest entry)
        const { data: nameRow } = await supabase
          .from('event_participants')
          .select('name')
          .eq('user_id', id)
          .eq('is_guest', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setProfile({
          id: profileRow.id,
          displayName: nameRow?.name ?? 'Gracz',
          avatarUrl: profileRow.avatar_url ?? undefined,
          createdAt: profileRow.created_at,
        });

        // Stats
        const [{ count: organized }, { count: joined }, playerStatsRow] = await Promise.all([
          supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('organizer_id', id),
          supabase
            .from('event_participants')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', id)
            .eq('is_guest', false),
          supabase
            .from('player_stats')
            .select('confirmed_count, no_show_count, goals_total')
            .eq('user_id', id)
            .maybeSingle(),
        ]);

        setStats({
          eventsOrganized: organized ?? 0,
          eventsJoined: joined ?? 0,
          eventsAttended: playerStatsRow.data?.confirmed_count ?? 0,
          noShows: playerStatsRow.data?.no_show_count ?? 0,
          goalsTotal: playerStatsRow.data?.goals_total ?? 0,
        });
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
      ? Math.round((stats.eventsAttended / stats.eventsJoined) * 100)
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
                  <div className="flex items-center gap-2">
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
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
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
                    value={stats.eventsAttended}
                    color="text-green-700"
                  />
                  <StatBox
                    icon={<X className="w-4 h-4" />}
                    label="Nie przyszedł"
                    value={stats.noShows}
                    color="text-red-500"
                  />
                  <StatBox
                    icon={<Trophy className="w-4 h-4" />}
                    label="Gole"
                    value={stats.goalsTotal}
                    color="text-amber-600"
                  />
                </div>

                {attendanceRate !== null && stats.eventsJoined >= 3 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-500">Frekwencja</span>
                      <span className={[
                        'font-semibold',
                        attendanceRate >= 80 ? 'text-green-700' : attendanceRate >= 60 ? 'text-amber-600' : 'text-red-500',
                      ].join(' ')}>
                        {attendanceRate}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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

                {stats.eventsOrganized > 0 && (
                  <p className="text-sm text-gray-500 mt-3">
                    Zorganizował <span className="font-semibold text-gray-800">{stats.eventsOrganized}</span>{' '}
                    {stats.eventsOrganized === 1 ? 'mecz' : stats.eventsOrganized < 5 ? 'mecze' : 'meczów'}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatBox({
  icon, label, value, color = 'text-gray-800',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className={`flex items-center gap-1.5 text-gray-400 text-xs mb-1 ${color}`}>
        {icon}
        <span className="text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
