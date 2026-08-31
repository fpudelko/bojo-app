'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Users, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getMyParticipatedEvents, getMyActiveEventIds, getMyGroupEvents, type MyEventRelation } from '@/lib/events';
import { isUpcoming } from '@/lib/eventDates';
import { getCommentsForUnread, policzNieprzeczytanePerWydarzenie, kluczRozmowyWidziano } from '@/lib/comments';
import { splitMyEvents } from '@/lib/myEvents';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { InviteList } from '@/components/events/InviteList';
import { DoRozliczeniaSection, GroupGamesSection, InvitesSection, MyMatchesSection, NastepneEdycjeSection } from '@/components/home/dashboard/DashboardSections';
import { getMyRecurringEvents, getNextEventsForRecurring, nastepnyTermin, dniDo } from '@/lib/recurring';
import { doRozliczenia } from '@/lib/myEvents';
import PustyStanMeczow from '@/components/home/dashboard/PustyStanMeczow';
import { useMyInvites } from '@/lib/useMyInvites';
import { SHOW_RECURRING } from '@/lib/features';
import { useSwipeZakladek } from '@/lib/useSwipeZakladek';
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
// Kolejność zakładek do swipe'a — ta sama, w jakiej są wypisane w pasku niżej.
const TABS: Tab[] = ['upcoming', 'history', 'invites', 'observing'];

function tabButtonCls(active: boolean) {
  // `border-b-2 border-transparent` także dla NIEAKTYWNEJ: bez tego aktywna
  // zakładka jest o 2 px wyższa i cały rząd podskakuje przy każdym przełączeniu.
  // `min-h-[44px]` — cel dotykowy, nie estetyka.
  return `relative flex min-h-[44px] items-center justify-center border-b-2 pb-2 text-[13px] transition-colors ${
    active
      ? 'border-primary-700 text-primary-700 font-semibold'
      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100'
  }`;
}

/** Plakietka liczby przy zakładce — ABSOLUTNA, nie w rzędzie z napisem.
 *  W rzędzie poszerzała zakładkę o swoją szerokość, więc dwie zakładki
 *  z liczbami rozpychały czwartą poza ekran. */
function PlakietkaZakladki({ ile }: { ile: number }) {
  if (ile <= 0) return null;
  return (
    <span className="absolute -top-0.5 right-0 rounded-full bg-primary-700 px-1.5 text-[10px] font-bold leading-[15px] text-white tabular-nums">
      {ile > 9 ? '9+' : ile}
    </span>
  );
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
  const gestSwipe = useSwipeZakladek(TABS, tab, goToTab);

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

  // MECZE MOICH EKIP, DO KTÓRYCH JESZCZE NIE DOŁĄCZYŁEM. Przyszło tu razem
  // z likwidacją drugiego pulpitu na „/" — i jako JEDYNA sekcja stamtąd, bo
  // jako jedyna niosła treść, której nie ma nigdzie indziej. Reszta miała już
  // swoje miejsca: otwarte mecze to zakładka „Szukaj", obserwowane i historia
  // to zakładki obok, ekipy to `/grupy`, a „Jak to działa" i FAQ mają własne
  // strony (`/jak-dziala-bojo`, `/faq`).
  //
  // Bez tego przeniesienia gracz nie miałby ANI JEDNEGO miejsca, w którym widzi
  // „moja ekipa gra, a mnie jeszcze nie ma" — pozostałe listy tutaj pokazują
  // mecze, w których już jest. To jest pętla, po którą wraca się do aplikacji.
  const [groupEvents, setGroupEvents] = useState<EventItem[]>([]);
  useEffect(() => {
    if (!user) { setGroupEvents([]); return; }
    let aktualne = true;
    getMyGroupEvents(user.id)
      .then((evs) => { if (aktualne) setGroupEvents(evs.filter(isUpcoming)); })
      .catch(() => { if (aktualne) setGroupEvents([]); });
    return () => { aktualne = false; };
  }, [user]);

  // Relacja do meczu ekipy liczona z `items`, bez osobnego zapytania:
  // `getMyParticipatedEvents` bierze WSZYSTKIE moje wiersze z
  // `event_participants` plus mecze, które organizuję, więc brak meczu na tej
  // liście naprawdę znaczy „nie mam z nim nic wspólnego".
  const statusMeczuEkipy = useCallback((event: EventItem): MyEventRelation => ({
    isOrganizer: event.organizerId === user?.id,
    status: items.find((i) => i.event.id === event.id)?.relation.status ?? 'none',
  }), [items, user?.id]);

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
  const { history, playing, observing } = splitMyEvents(items);

  // TRZY KUBEŁKI WG RELACJI, nie jeden wyróżniony mecz na górze (zgłoszone
  // wprost: „bez sensu jest ten jeden osobny najbliższy mecz"). Przy podziale
  // na „Grasz" / „Organizujesz" pierwszy element pierwszej sekcji I TAK jest
  // meczem najbliższym w czasie — `splitMyEvents` sortuje rosnąco po terminie —
  // więc osobna karta-hero mówiła to, co lista mówi sama.
  //
  // Podstawą jest `playing` (czyli `upcoming` bez obserwowanych, bo te mają
  // własną zakładkę). Kubełki są ROZŁĄCZNE i razem pokrywają całość:
  const graszWidoczne = playing.filter((r) => r.relation.status === 'playing');
  const organizujeszWidoczne = playing.filter((r) => r.relation.isOrganizer && r.relation.status !== 'playing');
  // Reszta: rezerwa i czekanie na akceptację na CUDZYM meczu. Osobna sekcja,
  // bo „Grasz" byłoby nieprawdą (nie masz miejsca w składzie), a wrzucenie ich
  // pod „Organizujesz" jest bez sensu. Pokazuje się tylko wtedy, gdy jest co
  // pokazać — u większości ludzi nie będzie jej nigdy.
  const pozostaleWidoczne = playing.filter((r) => r.relation.status !== 'playing' && !r.relation.isOrganizer);

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
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6" {...gestSwipe}>

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

        {/* CZTERY RÓWNE KOLUMNY, ZERO PRZEWIJANIA W BOK.
            Rząd przewijał się poziomo, więc na 360-pikselowym telefonie
            „Obserwowane" po prostu nie było widać — a zakładki, w odróżnieniu
            od filtrów, są całą nawigacją tego ekranu. Siatka mieści wszystkie
            cztery, bo napisy są krótsze o jedno słowo, a liczby zeszły
            z rzędu do rogu (`PlakietkaZakladki`). */}
        <div className="border-b border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-4">
            <button onClick={() => goToTab('upcoming')} className={tabButtonCls(tab === 'upcoming')}>
              Najbliższe
            </button>
            <button onClick={() => goToTab('history')} className={tabButtonCls(tab === 'history')}>
              Historia
            </button>
            <button onClick={() => goToTab('invites')} className={tabButtonCls(tab === 'invites')}>
              Zaproszenia
              <PlakietkaZakladki ile={visibleInviteCount} />
            </button>
            <button onClick={() => goToTab('observing')} className={tabButtonCls(tab === 'observing')}>
              Obserwuję
              <PlakietkaZakladki ile={observing.length} />
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
          // JEDNA LISTA MOICH MECZÓW, OD NAJBLIŻSZEGO — i to jest cała ta
          // zakładka. Wcześniej stały tu SIEDEM sekcji, z czego trzy kroiły tę
          // samą listę `upcoming`: „Czekają na Twoją decyzję", „Brakuje
          // graczy" i właściwa lista. Mecz organizowany, bez kompletu
          // i z prośbą o dołączenie pokazywał się przez to na jednym ekranie
          // TRZY RAZY, a zanim dojechało się do własnych meczów, trzeba było
          // minąć trzy nagłówki.
          //
          // Reguła, która to porządkuje: FAKT O MECZU (prośby, brakujący
          // skład, nieprzeczytane) należy do KARTY meczu, a osobną sekcję
          // dostaje wyłącznie to, czego na tej liście NIE MA — zaproszenie
          // (jeszcze nie mój mecz) i mecz ekipy, do którego nie dołączyłem.
          <div className="space-y-8">
            <InvitesSection
              invites={openInvites}
              statusFor={inviteStatusFor}
              href="/moje-gry?tab=zaproszenia"
            />
            {/* „Grasz" ma nagłówek NA STAŁE (zgłoszone wprost 2026-08-28) —
                zamiast znikać przy pustej liście, jak reszta sekcji na tej
                stronie, pokazuje pusty stan z CTA. To jedyne miejsce, gdzie
                gracz w ogóle dowiaduje się, że nic nie ma zaplanowane. */}
            <MyMatchesSection
              items={graszWidoczne}
              title="Grasz"
              limit={null}
              href={null}
              unreadByEvent={unreadByEvent}
              emptyState={<PustyStanMeczow />}
            />
            <MyMatchesSection
              items={organizujeszWidoczne}
              title="Organizujesz"
              subtitle="Twoje mecze, w których sam nie grasz"
              limit={null}
              href={null}
              unreadByEvent={unreadByEvent}
            />
            <MyMatchesSection
              items={pozostaleWidoczne}
              title="Rezerwa i oczekujące"
              limit={null}
              href={null}
              unreadByEvent={unreadByEvent}
            />
            {/* Mecze ekipy, w których jeszcze mnie nie ma — POD moimi meczami,
                bo najpierw odpowiadamy „co mam zaklepane", a dopiero potem
                „gdzie mógłbym dojść". Sekcja sama się chowa, gdy nie ma czego
                pokazać (`GroupGamesSection` zwraca null przy pustej liście). */}
            <GroupGamesSection events={groupEvents} statusFor={statusMeczuEkipy} />
            <NastepneEdycjeSection pozycje={nastepneEdycje} />
          </div>
        ) : tab === 'observing' ? (
          observing.length === 0 ? (
            // Ten sam wzorzec co pusty stan „Zaproszeń" wyżej — ikona, tytuł,
            // jedno zdanie wyjaśnienia. Wcześniej była tu goła linijka tekstu
            // bez ikony, jedyna taka na tym ekranie. Zgłoszone wprost z sesji
            // QA jako niespójność między zakładkami.
            <div className="py-12 text-center">
              <p className="text-4xl">👀</p>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Nie obserwujesz żadnych meczów</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Obserwuj mecz, żeby widzieć go tutaj bez zajmowania miejsca w składzie.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {observing.map(({ event, relation }) => (
                <EventBrowseCard key={event.id} event={event} relation={relation} />
              ))}
            </div>
          )
        ) : (
          history.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl">🗓️</p>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Brak historii meczów</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Rozegrane mecze pojawią się tutaj.
              </p>
            </div>
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
