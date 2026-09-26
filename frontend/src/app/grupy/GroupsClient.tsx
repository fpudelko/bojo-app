'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { LogIn, Plus } from 'lucide-react';
import Header from '@/components/layout/Header';
import IkonaWiadomosci from '@/components/layout/IkonaWiadomosci';
import Button from '@/components/ui/Button';
import KodGrupySheet from '@/components/groups/KodGrupySheet';
import { useAuth } from '@/lib/auth';
import { getMyGroupsZTerminem, getGroupEventsForNew, policzNoweMeczePerGrupa, kluczGrupyWidziano } from '@/lib/groups';
import { getGroupPostsForUnread, policzNieprzeczytanePerGrupa, kluczTablicaWidziano } from '@/lib/groupPosts';
import { withCount } from '@/lib/plural';
import type { GroupWithNext } from '@/types';
import { zWielkiejLitery } from '@/lib/utils';

function KartaEkipy({ g, nieprzeczytane, noweMecze }: { g: GroupWithNext; nieprzeczytane: number; noweMecze: boolean }) {
  const max = g.nextEvent?.maxPlayers ?? 0;
  const taken = g.nextEvent?.participantsCount ?? 0;
  const brakuje = Math.max(0, max - taken);

  let dzien = '';
  if (g.nextEvent) {
    try { dzien = format(parseISO(g.nextEvent.date), 'EEE d MMM', { locale: pl }); }
    catch { dzien = g.nextEvent.date; }
  }

  // WIERSZ, NIE KARTA (redesign 2026-09): bez ikony sportu w kafelku i bez
  // paska postępu. Wskaźniki, które siedziały na rogach ikony, stoją teraz
  // przy nazwie ekipy i znaczą to samo co wszędzie (AGENTS.md, Konwencje):
  // różowa CHMURKA = nieprzeczytana wiadomość na tablicy, pomarańczowa
  // kropka = nowy mecz w ekipie od ostatniej wizyty.
  return (
    <Link
      href={`/grupy/${g.id}`}
      className="flex items-start gap-3 border-b border-slate-200 px-4 py-3.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-ink">{g.name}</span>
          {nieprzeczytane > 0 && (
            <IkonaWiadomosci className="h-4 w-4 shrink-0 text-pink-500" />
          )}
          {noweMecze && (
            <span className="h-1.5 w-1.5 shrink-0 bg-orange-500" aria-hidden="true" />
          )}
        </p>
        <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
          {withCount(g.memberCount ?? 0, 'członek', 'członkowie', 'członków')}
          {g.city && ` · ${g.city}`}
        </p>
        {/* Obiekt najbliższego meczu drugorzędny i ucięty (`min-w-0` +
            `truncate`): na tej liście liczy się KIEDY i czy jest komplet. */}
        {g.nextEvent?.fieldName && (
          <p className="mt-0.5 min-w-0 truncate text-[13px] text-slate-500 dark:text-slate-400" title={g.nextEvent.fieldName}>
            {g.nextEvent.fieldName}
          </p>
        )}
      </div>
      {g.nextEvent ? (
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="text-[15px] font-medium tabular-nums text-ink">{g.nextEvent.time.slice(0, 5)}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{zWielkiejLitery(dzien)}</span>
          {max > 0 && (
            <span className={`text-xs font-semibold ${brakuje > 0 ? 'text-amber-600' : 'text-slate-500 dark:text-slate-400'}`}>
              {brakuje > 0 ? `brakuje ${brakuje}` : 'komplet'}
            </span>
          )}
        </div>
      ) : (
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="text-xs text-slate-500 dark:text-slate-400">Brak terminu</span>
          <span className="text-xs font-semibold text-primary-700">Ustaw termin</span>
        </div>
      )}
    </Link>
  );
}

export default function GroupsPage() {
  const { user, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<GroupWithNext[]>([]);
  const [loading, setLoading] = useState(true);
  const [kodOtwarty, setKodOtwarty] = useState(false);
  const [nieprzeczytane, setNieprzeczytane] = useState<Record<string, number>>({});
  const [noweMecze, setNoweMecze] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getMyGroupsZTerminem(user.id)
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  // Plakietki „nieprzeczytane" — jedno zapytanie dla wszystkich kart naraz.
  useEffect(() => {
    if (!user || groups.length === 0) { setNieprzeczytane({}); return; }
    getGroupPostsForUnread(groups.map((g) => g.id))
      .then((posts) => setNieprzeczytane(
        policzNieprzeczytanePerGrupa(posts, user.id, (groupId) => window.localStorage.getItem(kluczTablicaWidziano(groupId))),
      ))
      .catch(() => {});
  }, [user, groups]);

  // Pomarańczowe kropki „nowy mecz w ekipie" — jedno zapytanie dla wszystkich
  // kart naraz, wzorem powyższego dla wiadomości.
  useEffect(() => {
    if (!user || groups.length === 0) { setNoweMecze({}); return; }
    getGroupEventsForNew(groups.map((g) => g.id))
      .then((events) => setNoweMecze(
        policzNoweMeczePerGrupa(events, (groupId) => window.localStorage.getItem(kluczGrupyWidziano(groupId))),
      ))
      .catch(() => {});
  }, [user, groups]);

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header showMobileWordmark />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <h1 className="mb-2 font-display text-2xl font-bold text-ink">Zbierz ekipę w jednym miejscu</h1>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              Terminy, skład na żywo i rozliczenia. Bez liczenia plusów w czacie.
            </p>
            <Button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent('/grupy')}`; }} className="inline-flex items-center gap-2">
              <LogIn className="h-4 w-4" /> Zaloguj się
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header showMobileWordmark />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Twoje ekipy</h1>
          <Link href="/grupy/nowe">
            <Button size="sm" className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nowa</Button>
          </Link>
        </div>

        {loading ? (
          <div className="-mx-4 border-t border-slate-200 dark:border-slate-700">
            {[1, 2].map((i) => (
              <div key={i} className="flex h-[76px] items-center gap-4 border-b border-slate-200 px-4 dark:border-slate-700">
                <div className="h-3 flex-1 animate-pulse bg-slate-100 dark:bg-slate-700" />
                <div className="h-3 w-12 animate-pulse bg-slate-100 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <p className="text-base font-semibold text-ink">Nie masz jeszcze ekipy</p>
            <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Ekipa to stała paczka, z którą grasz. Terminy, skład i rozliczenia w jednym miejscu,
              zamiast liczenia plusów w czacie.
            </p>
            <Link href="/grupy/nowe" className="mt-1">
              <Button size="sm" className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Załóż ekipę</Button>
            </Link>
            <button onClick={() => setKodOtwarty(true)} className="text-sm font-medium text-slate-500 hover:text-primary-700">
              Mam kod
            </button>
          </div>
        ) : (
          <div className="-mx-4 border-t border-slate-200 dark:border-slate-700">
            {groups.map((g) => (
              <KartaEkipy key={g.id} g={g} nieprzeczytane={nieprzeczytane[g.id] ?? 0} noweMecze={noweMecze[g.id] ?? false} />
            ))}
          </div>
        )}

        {groups.length > 0 && (
          <button
            onClick={() => setKodOtwarty(true)}
            className="mx-auto block text-sm font-medium text-slate-400 hover:text-primary-700"
          >
            Masz kod zaproszenia? →
          </button>
        )}
      </main>

      {kodOtwarty && <KodGrupySheet onClose={() => setKodOtwarty(false)} />}
    </div>
  );
}
