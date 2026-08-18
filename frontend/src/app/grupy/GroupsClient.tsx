'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Users, LogIn, ChevronRight, Plus, CalendarPlus } from 'lucide-react';
import Header from '@/components/layout/Header';
import IkonaWiadomosci from '@/components/layout/IkonaWiadomosci';
import Button from '@/components/ui/Button';
import KodGrupySheet from '@/components/groups/KodGrupySheet';
import { useAuth } from '@/lib/auth';
import { getMyGroupsZTerminem, getGroupEventsForNew, policzNoweMeczePerGrupa, kluczGrupyWidziano } from '@/lib/groups';
import { getGroupPostsForUnread, policzNieprzeczytanePerGrupa, kluczTablicaWidziano } from '@/lib/groupPosts';
import { sportEmoji } from '@/lib/sports';
import { withCount } from '@/lib/plural';
import type { GroupWithNext } from '@/types';

function KartaEkipy({ g, nieprzeczytane, noweMecze }: { g: GroupWithNext; nieprzeczytane: number; noweMecze: boolean }) {
  const max = g.nextEvent?.maxPlayers ?? 0;
  const taken = g.nextEvent?.participantsCount ?? 0;
  const brakuje = Math.max(0, max - taken);
  const pct = max > 0 ? Math.min(100, Math.round((taken / max) * 100)) : 0;

  let dzien = '';
  if (g.nextEvent) {
    try { dzien = format(parseISO(g.nextEvent.date), 'EEE d MMM', { locale: pl }); }
    catch { dzien = g.nextEvent.date; }
  }

  return (
    <Link
      href={`/grupy/${g.id}`}
      className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:border-primary-200 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-800"
    >
      <div className="flex items-start gap-3">
        {/* Wskaźniki na rogach ikony, wzorem dolnej nawigacji (BottomNav.tsx):
            różowa CHMURKA z lewej = nieprzeczytana wiadomość na tablicy,
            pomarańczowa kropka z prawej = nowy mecz w ekipie od ostatniej
            wizyty. Kolor niesie stałe znaczenie w całej apce (patrz AGENTS.md,
            Konwencje), a kształt chmurki mówi „ktoś napisał" bez uczenia się
            znaczenia koloru. */}
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-2xl">
          {g.sport ? sportEmoji(g.sport) : '👥'}
          {nieprzeczytane > 0 && (
            <IkonaWiadomosci className="absolute -left-1.5 -top-1.5 h-4 w-4 text-pink-500" />
          )}
          {noweMecze && (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-orange-500 ring-2 ring-white dark:ring-slate-800" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{g.name}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {withCount(g.memberCount ?? 0, 'członek', 'członkowie', 'członków')}
            {g.city && ` · ${g.city}`}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
      </div>

      {g.nextEvent ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="capitalize">{dzien}</span> · {g.nextEvent.time.slice(0, 5)}
            {g.nextEvent.fieldName && ` · ${g.nextEvent.fieldName}`}
          </p>
          {max > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-primary-600" style={{ width: `${pct}%` }} />
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">
                {taken}/{max}{brakuje > 0 ? ` — brakuje ${brakuje}` : ''}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-700/50">
          <span className="text-xs text-slate-500 dark:text-slate-400">Brak terminu</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
            Ustaw termin <CalendarPlus className="h-3.5 w-3.5" />
          </span>
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
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
              <Users className="h-7 w-7 text-primary-700" />
            </div>
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
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Twoje ekipy</h1>
          <Link href="/grupy/nowe">
            <Button size="sm" className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nowa</Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/80 dark:bg-slate-800" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <span className="text-5xl">👥</span>
            <p className="text-base font-semibold text-ink">Nie masz jeszcze ekipy</p>
            <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Ekipa to stała paczka, z którą grasz. Terminy, skład i rozliczenia w jednym miejscu —
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
          <div className="space-y-3">
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
