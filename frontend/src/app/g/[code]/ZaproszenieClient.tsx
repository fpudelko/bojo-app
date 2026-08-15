'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Loader2, MapPin, Users } from 'lucide-react';
import Header from '@/components/layout/Header';
import AuthForm from '@/components/auth/AuthForm';
import { useAuth } from '@/lib/auth';
import { sportEmoji } from '@/lib/sports';
import { withCount } from '@/lib/plural';

interface DaneGrupy {
  id: string; name: string; sport?: string; city?: string; fieldName?: string;
  coverImageUrl?: string; memberCount: number; createdAt: string;
}
interface DaneMeczu {
  date: string; time: string; fieldName?: string; maxPlayers: number; participantsCount: number;
}

/**
 * Lądowanie zaproszenia do ekipy — czytelne BEZ konta, bo `groups` i
 * `group_members` są publicznie czytelne przez RLS. To jest ekran, o który
 * rozbija się dziś organizator: zanim ten PR, `/g/[kod]` prosiło o
 * zalogowanie, zanim ktokolwiek się czegokolwiek dowiedział o ekipie.
 *
 * Zalogowany odwiedzający jest przekierowany bez migania tego widoku —
 * `/grupy/{id}` sam dołączy go kodem z adresu (patrz efekt auto-dołączenia
 * w `GroupDetailClient.tsx`).
 */
export default function ZaproszenieClient({
  code, group, nextEvent, totalMatches, inviterName, od,
}: {
  code: string; group: DaneGrupy; nextEvent?: DaneMeczu; totalMatches: number;
  inviterName?: string; od?: string;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const celPoZalogowaniu = `/grupy/${group.id}?dolacz=${code}${od ? `&od=${od}` : ''}`;

  useEffect(() => {
    if (!loading && user) router.replace(celPoZalogowaniu);
  }, [loading, user, router, celPoZalogowaniu]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </main>
      </div>
    );
  }

  let kiedyGraja = '';
  try { kiedyGraja = format(parseISO(group.createdAt), 'LLLL yyyy', { locale: pl }); } catch { /* noop */ }

  let terminKiedy = '';
  if (nextEvent) {
    try { terminKiedy = format(parseISO(nextEvent.date), 'EEEE, d MMMM', { locale: pl }); } catch { terminKiedy = nextEvent.date; }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header showMobileWordmark />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-3xl shadow-sm">
            {group.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-white">{group.sport ? sportEmoji(group.sport) : '👥'}</span>
            )}
          </span>
          <h1 className="mt-3 font-display text-xl font-bold text-ink">{group.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {inviterName ? `${inviterName} zaprasza Cię do ekipy` : 'Zaproszenie do ekipy'}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {[group.city, group.fieldName].filter(Boolean).join(' · ')}
            {(group.city || group.fieldName) && ' · '}
            {withCount(group.memberCount, 'członek', 'członkowie', 'członków')}
          </p>
        </div>

        {nextEvent && (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Najbliższy mecz</p>
            <p className="mt-1 text-sm font-semibold capitalize text-ink">{terminKiedy}, {nextEvent.time}</p>
            {nextEvent.fieldName && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5" /> {nextEvent.fieldName}
              </p>
            )}
            {nextEvent.maxPlayers > 0 && (
              <p className="mt-1 text-xs text-slate-400">{nextEvent.participantsCount}/{nextEvent.maxPlayers} miejsc</p>
            )}
          </div>
        )}

        {totalMatches > 0 && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <Users className="h-3.5 w-3.5" /> Grają razem od {kiedyGraja} · {withCount(totalMatches, 'mecz', 'mecze', 'meczów')}
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="mb-4 text-center text-sm text-slate-600">
            Konto zajmie 30 sekund. Potem widzisz wszystkie terminy ekipy, skład na żywo i kto ile ma dorzucić.
          </p>
          <AuthForm next={celPoZalogowaniu} initialMode="signup" />
        </div>
      </main>
    </div>
  );
}
