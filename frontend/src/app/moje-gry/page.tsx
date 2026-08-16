'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Users, ChevronRight, MessageCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getMyParticipatedEvents, getMyActiveEventIds, type MyEventRelation } from '@/lib/events';
import { getCommentsForUnread, policzNieprzeczytanePerWydarzenie, kluczRozmowyWidziano } from '@/lib/comments';
import { splitMyEvents, nextMatch } from '@/lib/myEvents';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { InviteList } from '@/components/events/InviteList';
import { DoRozliczeniaSection, InvitesSection, MyMatchesSection, NastepneEdycjeSection, NeedsPlayersSection, PendingRequestsSection } from '@/components/home/dashboard/DashboardSections';
import { getMyRecurringEvents, getNextEventsForRecurring, nastepnyTermin, dniDo } from '@/lib/recurring';
import { doRozliczenia } from '@/lib/myEvents';
import NextMatchCard from '@/components/home/dashboard/NextMatchCard';
import { useMyInvites } from '@/lib/useMyInvites';
import { SHOW_RECURRING } from '@/lib/features';
import type { EventItem } from '@/types';

type Tab = 'upcoming' | 'history' | 'invites' | 'observing';

// URL slugs are Polish (matches the app's URL conventions elsewhere), the
// internal Tab type stays as it always was. An unrecognised ?tab= falls back
// to 'upcoming' rather than erroring.
const SLUG_TO_TAB: Record<string, Tab> = {
  nadchodzace: 'upcoming', historia: 'history', zaproszenia: 'invites', obserwowane: 'observing',
};
const TAB_TO_SLUG: Record<Tab, string> = {
  upcoming: 'nadchodzace', history: 'historia', invites: 'zaproszenia', observing: 'obserwowane',
};

function tabButtonCls(active: boolean) {
  return `pb-2.5 text-sm transition-colors ${
    active
      ? 'border-b-2 border-primary-700 text-primary-700 font-semibold'
      : 'text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100'
  }`;
}

function MojeGryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<{ event: EventItem; relation: MyEventRelation }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // The URL is the only source of truth for the active tab — no useState
  // alongside it — so the tab survives a refresh and a link from elsewhere
  // (the invites badge on /wydarzenia) can point straight at it.
  const tab: Tab = SLUG_TO_TAB[searchParams.get('tab') ?? ''] ?? 'upcoming';
  const goToTab = (t: Tab) => router.replace(`/moje-gry?tab=${TAB_TO_SLUG[t]}`, { scroll: false });

  const { open: openInvites, statusFor: inviteStatusFor, loading: invitesLoading } = useMyInvites();
  const visibleInviteCount = openInvites.length;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoadError(false);
    getMyParticipatedEvents(user.id)
      .then(setItems)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [user]);

  // Plakietki „nieprzeczytane" na kartach meczów — jedno zapytanie dla
  // wszystkich naraz (gram/organizuję/rezerwa, patrz `getMyActiveEventIds`).
  const [unreadByEvent, setUnreadByEvent] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!user) { setUnreadByEvent({}); return; }
    getMyActiveEventIds(user.id)
      .then((eventIds) => getCommentsForUnread(eventIds))
      .then((comments) => setUnreadByEvent(
        policzNieprzeczytanePerWydarzenie(comments, user.id, (eventId) => window.localStorage.getItem(kluczRozmowyWidziano(eventId))),
      ))
      .catch(() => {});
  }, [user]);

  // Kolejne terminy serii, których jeszcze nie ma w bazie. Osobno od
  // `getMyParticipatedEvents`, bo to nie są mecze — to szablony. Cicha porażka
  // jest tu w porządku: brak tej sekcji nie psuje strony.
  const [nastepneEdycje, setNastepneEdycje] = useState<
    { serieId: string; nazwa: string; data: string; godzina: string; zaIle: number; powstanieZa: number }[]
  >([]);
  useEffect(() => {
    // Gry cykliczne wyłączone (`SHOW_RECURRING`, produktowa decyzja
    // 2026-08-16) — bez tego strażnika strona i tak dociągałaby serie
    // z bazy tylko po to, żeby sekcja niżej ich nie pokazała.
    if (!user || !SHOW_RECURRING) { setNastepneEdycje([]); return; }
    let aktualne = true;
    (async () => {
      const serie = (await getMyRecurringEvents(user.id)).filter((s) => s.isActive);
      if (serie.length === 0) { if (aktualne) setNastepneEdycje([]); return; }
      const utworzone = await getNextEventsForRecurring(serie.map((s) => s.id));
      const pozycje = serie
        .map((s) => {
          const data = nastepnyTermin(s.dayOfWeek, s.eventTime);
          // Termin już istnieje → nie ma czego zapowiadać, mecz jest na liście
          // wyżej jak każdy inny.
          if (utworzone[s.id]?.date === data) return null;
          const zaIle = dniDo(data);
          return {
            serieId: s.id,
            nazwa: s.title || `${s.sport} — ${s.fieldName}`,
            data,
            godzina: s.eventTime,
            zaIle,
            powstanieZa: zaIle - s.notifyDaysBefore,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => a.data.localeCompare(b.data));
      if (aktualne) setNastepneEdycje(pozycje);
    })().catch(() => {});
    return () => { aktualne = false; };
  }, [user]);

  // Cancelled games never count as "upcoming" — they drop into History so the
  // calendar only shows games that are actually happening. Observing is split
  // out: seeing it next to real sign-ups reads as "I'm in". Organizing and
  // playing stay together in one list — both are "your match".
  const { upcoming, history, playing, observing } = splitMyEvents(items);
  const next = nextMatch(items);

  // Filtr „tylko z nieprzeczytanymi" — dotyczy wyłącznie zakładki Nadchodzące;
  // zaproszenia i stałe gierki nie niosą wiadomości, więc filtr ich nie rusza.
  const [onlyUnread, setOnlyUnread] = useState(false);
  const maNieprzeczytane = (event: EventItem) => (unreadByEvent[event.id] ?? 0) > 0;
  const upcomingWidoczne = onlyUnread ? upcoming.filter(({ event }) => maNieprzeczytane(event)) : upcoming;
  const playingWidoczne = onlyUnread ? playing.filter(({ event }) => maNieprzeczytane(event)) : playing;
  const nextWidoczny = onlyUnread ? (next && maNieprzeczytane(next.event) ? next : null) : next;
  const jestNieprzeczytanych = Object.keys(unreadByEvent).length > 0;

  // Kotwiczony na wysokości „Brakuje graczy" (patrz `NeedsPlayersSection`
  // niżej), nie w pasku zakładek — zgłoszone wprost.
  const filtrNieprzeczytanychButton = (
    <button
      onClick={() => setOnlyUnread((v) => !v)}
      aria-pressed={onlyUnread}
      aria-label={onlyUnread ? 'Pokaż wszystkie mecze' : 'Pokaż tylko mecze z nieprzeczytanymi wiadomościami'}
      title={onlyUnread ? 'Pokaż wszystkie mecze' : 'Tylko z nieprzeczytanymi wiadomościami'}
      className={`shrink-0 rounded-full p-1.5 transition-colors ${
        onlyUnread ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-pink-600 dark:hover:bg-slate-800'
      }`}
    >
      <MessageCircle className="h-4 w-4" />
    </button>
  );

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showMobileWordmark />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
              <Users className="w-7 h-7 text-primary-700" />
            </div>
            <h1 className="font-display text-2xl font-bold text-ink mb-2">Twoje mecze</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Zaloguj się, aby zobaczyć swoje mecze.</p>
            <Button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname)}`; }} className="inline-flex items-center gap-2">
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

        {/* Bez nagłówka "Twoje mecze" i przycisku "+ Nowy mecz" — mecz
            tworzy się z FAB-a w dolnej nawigacji, dostępnego z każdego ekranu. */}

        {/* Stałe gierki link */}
        {SHOW_RECURRING && (
          <Link
            href="/cykliczne"
            className="flex items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 px-4 py-3.5 shadow-sm hover:border-primary-200 hover:shadow-md transition-all group"
          >
            <span className="text-sm font-semibold text-ink">🔁 Stałe gierki</span>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary-600 transition-colors" />
          </Link>
        )}

        {/* Tabs — poziomy scroll z ukrytym scrollbarem: cztery zakładki +
            dwie plakietki nie mieszczą się zawsze na 360px. */}
        <div className="border-b border-slate-100 dark:border-slate-700">
          <div className="flex gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button onClick={() => goToTab('upcoming')} className={`${tabButtonCls(tab === 'upcoming')} shrink-0 whitespace-nowrap`}>
              Nadchodzące
            </button>
            <button onClick={() => goToTab('history')} className={`${tabButtonCls(tab === 'history')} shrink-0 whitespace-nowrap`}>
              Historia
            </button>
            <button onClick={() => goToTab('invites')} className={`${tabButtonCls(tab === 'invites')} inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap`}>
              Zaproszenia
              {visibleInviteCount > 0 && (
                <span className="rounded-full bg-primary-700 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                  {visibleInviteCount}
                </span>
              )}
            </button>
            <button onClick={() => goToTab('observing')} className={`${tabButtonCls(tab === 'observing')} inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap`}>
              Obserwowane
              {observing.length > 0 && (
                <span className="rounded-full bg-primary-700 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                  {observing.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab content */}
        {tab === 'invites' ? (
          invitesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[76px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 animate-pulse" />
              ))}
            </div>
          ) : (
            <section className="space-y-3">
              <InviteList
                invites={openInvites}
                statusFor={inviteStatusFor}
                emptyMessage={
                  <div className="py-12 text-center">
                    <p className="text-4xl">✉️</p>
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Brak zaproszeń</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Gdy ktoś zaprosi Cię na mecz, znajdziesz to tutaj.
                    </p>
                  </div>
                }
              />
            </section>
          )
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <span className="text-4xl">⚠️</span>
            <p className="text-base font-semibold text-ink">Nie udało się załadować meczy</p>
            <button onClick={() => { setLoading(true); setLoadError(false); getMyParticipatedEvents(user!.id).then(setItems).catch(() => setLoadError(true)).finally(() => setLoading(false)); }} className="text-sm font-semibold text-primary-700 hover:text-primary-800">Spróbuj ponownie</button>
          </div>
        ) : tab === 'upcoming' ? (
          // Ten sam układ co pulpit dla zalogowanych (AppHome), bez sekcji
          // "Twoje grupy" / "Otwarte mecze" — te mają swoje strony (/grupy,
          // /wydarzenia). Zero pustego stanu tutaj: NextMatchCard ma własny
          // ("Nie masz zaplanowanych gier" + CTA), więc pokrywa przypadek
          // zerowej aktywności bez drugiej kopii tego ekranu. Obserwowane mają
          // teraz własną zakładkę — nie dublują się tutaj.
          <div className="space-y-8">
            <InvitesSection
              invites={openInvites}
              statusFor={inviteStatusFor}
              href="/moje-gry?tab=zaproszenia"
            />
            <PendingRequestsSection items={upcomingWidoczne} unreadByEvent={unreadByEvent} />
            {/* Filtr „tylko nieprzeczytane" stoi na wysokości „Brakuje graczy"
                (`extra` w `SectionHeader`), nie w pasku zakładek — zgłoszone
                wprost. `pokazPustyNaglowek` trzyma przycisk widocznym nawet
                gdy akurat nie ma czego pokazać w tej sekcji (i wtedy niżej
                stoi komunikat „nic z nieprzeczytanymi"), bo przycisk musi
                zostać dostępny, żeby dało się wyłączyć filtr z powrotem. */}
            <NeedsPlayersSection
              items={upcomingWidoczne}
              limit={null}
              unreadByEvent={unreadByEvent}
              extra={jestNieprzeczytanych ? filtrNieprzeczytanychButton : undefined}
              pokazPustyNaglowek
            />
            {onlyUnread && upcomingWidoczne.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                Żaden z nadchodzących meczów nie ma nieprzeczytanych wiadomości.
              </p>
            ) : (
              <>
                {(!onlyUnread || nextWidoczny) && (
                  <NextMatchCard row={nextWidoczny} unreadMessages={nextWidoczny ? unreadByEvent[nextWidoczny.event.id] : undefined} />
                )}
                <MyMatchesSection
                  items={playingWidoczne.filter(({ event }) => event.id !== nextWidoczny?.event.id)}
                  limit={null}
                  href={null}
                  unreadByEvent={unreadByEvent}
                />
              </>
            )}
            <NastepneEdycjeSection pozycje={nastepneEdycje} />
          </div>
        ) : tab === 'observing' ? (
          observing.length === 0 ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">Nie obserwujesz żadnych meczów</p>
          ) : (
            <div className="space-y-3">
              {observing.map(({ event, relation }) => (
                <EventBrowseCard key={event.id} event={event} relation={relation} />
              ))}
            </div>
          )
        ) : (
          history.length === 0 ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">Brak historii meczy</p>
          ) : (
            <div className="space-y-8">
              <DoRozliczeniaSection items={doRozliczenia(history)} />
              <div className="space-y-3">
                {history.map(({ event, relation }) => (
                  <EventBrowseCard key={event.id} event={event} relation={relation} unreadMessages={unreadByEvent[event.id]} />
                ))}
              </div>
            </div>
          )
        )}

      </main>
    </div>
  );
}

export default function MojeGryPage() {
  return (
    <Suspense>
      <MojeGryContent />
    </Suspense>
  );
}
