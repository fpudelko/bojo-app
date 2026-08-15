'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users, ArrowLeft, Loader2, CalendarPlus, Link2, Check, Share2,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import NotificationBell from '@/components/layout/NotificationBell';
import { HideBottomNav } from '@/lib/bottomNavVisibility';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import NajblizszyMeczGrupy from '@/components/groups/NajblizszyMeczGrupy';
import RozmowaGrupy from '@/components/groups/RozmowaGrupy';
import SkladGrupy from '@/components/groups/SkladGrupy';
import StatystykiGrupy from '@/components/groups/StatystykiGrupy';
import ZaprosDoGrupySheet from '@/components/groups/ZaprosDoGrupySheet';
import type { PatchUprawnien } from '@/components/groups/UprawnieniaCzlonkaPanel';
import { useMyParticipation } from '@/lib/useMyParticipation';
import { isUpcoming } from '@/lib/eventDates';
import { startKey } from '@/lib/eventFilters';
import { plural } from '@/lib/plural';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  getGroup, getGroupMembers, getGroupEvents, isGroupMember, getMyGroupPermissions,
  joinGroupByCode, leaveGroup, removeMember, setMemberPermissions, uprawnieniaCzlonka,
} from '@/lib/groups';
import { getGroupPosts, nieprzeczytane } from '@/lib/groupPosts';
import { linkDoGrupy, udostepnijGrupe } from '@/lib/groupShare';
import { sportEmoji, sportLabel } from '@/lib/sports';
import type { Group, GroupMember, EventItem, GroupPermissions } from '@/types';

type Tab = 'mecze' | 'tablica' | 'sklad' | 'staty';
const TABS: { value: Tab; label: string }[] = [
  { value: 'mecze', label: 'Mecze' },
  { value: 'tablica', label: 'Rozmowa' },
  { value: 'sklad', label: 'Skład' },
  { value: 'staty', label: 'Statystyki' },
];

function tabParam(t: Tab): string | null {
  return t === 'mecze' ? null : t;
}

function tabCls(active: boolean) {
  return `pb-2.5 text-sm transition-colors whitespace-nowrap ${
    active
      ? 'border-b-2 border-primary-700 font-semibold text-primary-700'
      : 'text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-slate-100'
  }`;
}

const KLUCZ_WIDZIANO = (groupId: string) => `bojo:tablica-widziano:${groupId}`;

export default function GroupDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const statusFor = useMyParticipation();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [member, setMember] = useState(false);
  const [permissions, setPermissions] = useState<GroupPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [nieprzeczytaneN, setNieprzeczytaneN] = useState(0);

  // Zakładka: stan lokalny odczytany z URL-a, zapisywany przez
  // history.replaceState — nie router.replace. `/grupy/[id]` jest trasą
  // dynamiczną, więc router.replace to pełny round-trip po dane z
  // generateMetadata; przełączenie zakładki jest czysto kliencke.
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    return t === 'tablica' || t === 'sklad' || t === 'staty' ? t : 'mecze';
  });

  const goToTab = (t: Tab) => {
    setTab(t);
    const sp = new URLSearchParams(window.location.search);
    const p = tabParam(t);
    if (p) sp.set('tab', p); else sp.delete('tab');
    sp.delete('dolacz'); sp.delete('od'); sp.delete('join'); sp.delete('kod');
    const qs = sp.toString();
    window.history.replaceState(null, '', `/grupy/${id}${qs ? `?${qs}` : ''}`);
  };

  // Dołączenie kodem z linku zaproszenia — `?dolacz=<kod>` (nowy adres
  // /g/[kod]) albo `?join=1&kod=<kod>` (przekierowanie starych linków).
  // Bez kodu (`?join=1` samo) dołączenie nie jest już możliwe — kod
  // przestał być ozdobą UI (migracja `094`) — banner mówi to wprost.
  const kodZUrl = searchParams.get('dolacz') || (searchParams.get('join') === '1' ? searchParams.get('kod') : null);
  const odZUrl = searchParams.get('od') || undefined;
  const legacyBezKodu = searchParams.get('join') === '1' && !searchParams.get('kod') && !searchParams.get('dolacz');
  const autoJoinProbowane = useRef(false);

  // Zaraz po utworzeniu ekipy (`/grupy/nowe`) — otwórz od razu sheet
  // zaproszenia. Ekipa z jedną osobą jest martwa, a to jedyny moment, w którym
  // organizator na pewno chce zapraszać.
  const zaprosZUrl = searchParams.get('zapros') === '1';
  const autoInviteProbowane = useRef(false);
  useEffect(() => {
    if (autoInviteProbowane.current || !zaprosZUrl) return;
    autoInviteProbowane.current = true;
    setInviteOpen(true);
    const sp = new URLSearchParams(window.location.search);
    sp.delete('zapros');
    const qs = sp.toString();
    window.history.replaceState(null, '', `/grupy/${id}${qs ? `?${qs}` : ''}`);
  }, [zaprosZUrl, id]);

  const load = useCallback(async () => {
    let g: Group | null = null;
    try {
      g = await getGroup(id);
    } catch {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (!g) { setNotFound(true); setLoading(false); return; }
    setGroup(g);

    if (user) {
      isGroupMember(id, user.id).then(setMember).catch(() => {});
      getMyGroupPermissions(id, user.id).then(setPermissions).catch(() => {});
    } else {
      setMember(false);
      setPermissions(null);
    }

    try {
      const [m, ev] = await Promise.all([getGroupMembers(id), getGroupEvents(id)]);
      setMembers(m);
      setEvents(ev);
    } catch (e) {
      console.warn('[group] secondary data load failed', e);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { if (!authLoading) load(); }, [load, authLoading]);

  // Nieprzeczytane wpisy na tablicy — jedno dodatkowe zapytanie, wyłącznie
  // dla członka (nie-członek i tak nie zobaczy tablicy, RLS zwróci pustkę).
  useEffect(() => {
    if (!member) { setNieprzeczytaneN(0); return; }
    getGroupPosts(id).then((posts) => {
      const widziano = typeof window !== 'undefined' ? window.localStorage.getItem(KLUCZ_WIDZIANO(id)) : null;
      setNieprzeczytaneN(nieprzeczytane(posts, widziano));
    }).catch(() => {});
  }, [member, id]);

  // Wejście na zakładkę Tablica zaznacza wszystko jako widziane.
  useEffect(() => {
    if (tab === 'tablica' && typeof window !== 'undefined') {
      window.localStorage.setItem(KLUCZ_WIDZIANO(id), new Date().toISOString());
      setNieprzeczytaneN(0);
    }
  }, [tab, id]);

  // Auto-dołączenie: zalogowany użytkownik z kodem w adresie dołącza bez
  // dodatkowego kliknięcia — dokładnie ta sama miękkość, co `?auto=1` przy
  // przejęciu wpisu gościa (`PrzejmijClient.tsx`).
  useEffect(() => {
    if (autoJoinProbowane.current) return;
    if (authLoading || loading) return;
    if (!user || !kodZUrl || member) return;
    autoJoinProbowane.current = true;
    joinGroupByCode(kodZUrl, odZUrl)
      .then(() => { toast('Dołączyłeś do ekipy!'); return load(); })
      .catch((e) => toast(e instanceof Error ? e.message : 'Błąd', 'error'))
      .finally(() => {
        const sp = new URLSearchParams(window.location.search);
        sp.delete('dolacz'); sp.delete('od'); sp.delete('join'); sp.delete('kod');
        const qs = sp.toString();
        window.history.replaceState(null, '', `/grupy/${id}${qs ? `?${qs}` : ''}`);
      });
  }, [authLoading, loading, user, kodZUrl, odZUrl, member, id, load, toast]);

  const perms = permissions ?? uprawnieniaCzlonka(group ?? {}, undefined);

  const handleLeave = async () => {
    if (!user) return;
    if (!confirm('Opuścić ekipę?')) return;
    setBusy(true);
    try { await leaveGroup(id, user.id); toast('Opuściłeś ekipę'); router.push('/grupy'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); setBusy(false); }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Usunąć tego gracza z ekipy? Straci dostęp do rozmowy i meczów ekipy. Wpisy zostają.')) return;
    setBusy(true);
    try { await removeMember(id, userId); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleSetPerms = async (m: GroupMember, patch: PatchUprawnien) => {
    try {
      await setMemberPermissions(m.id, {
        canManageMembers: patch.canManageMembers ?? m.canManageMembers,
        canCreateEvents: patch.canCreateEvents ?? m.canCreateEvents,
        canModerateWall: patch.canModerateWall ?? m.canModerateWall,
        canInvite: patch.canInvite ?? m.canInvite,
      });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zmienić uprawnień', 'error');
    }
  };

  // Belka „Zaproś do ekipy" nad Składem (patrz zakładka Skład niżej) — kod
  // dołączenia i udostępnianie linku żyły wcześniej wyłącznie w
  // `ZaprosDoGrupySheet`; tu jest szybki podgląd/kopiowanie bez otwierania
  // arkusza.
  const [kodSkopiowany, setKodSkopiowany] = useState(false);
  const handleCopyCode = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.joinCode);
      setKodSkopiowany(true);
      toast('Skopiowano kod dołączenia');
      setTimeout(() => setKodSkopiowany(false), 2000);
    } catch { /* ignore */ }
  };
  const handleShareGroup = async () => {
    if (!group) return;
    const link = linkDoGrupy(group.joinCode, user?.id);
    const wynik = await udostepnijGrupe(group, link, undefined, nextMatch ?? undefined);
    if (wynik === 'copied') toast('Skopiowano zaproszenie');
  };

  // Nadchodzące rosnąco (najbliższy pierwszy), historia malejąco.
  const { upcoming, past } = useMemo(() => {
    const up = events
      .filter((e) => e.status !== 'cancelled' && isUpcoming(e))
      .sort((a, b) => (startKey(a) < startKey(b) ? -1 : 1));
    const hist = events
      .filter((e) => e.status === 'cancelled' || !isUpcoming(e))
      .sort((a, b) => (startKey(a) > startKey(b) ? -1 : 1));
    return { upcoming: up, past: hist };
  }, [events]);

  const nextMatch = upcoming[0] ?? null;
  const ostatniMecz = past.find((e) => e.status !== 'cancelled') ?? null;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <div className="h-24 animate-pulse rounded-2xl border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800" />
        </main>
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <main className="flex flex-1 items-center justify-center px-4 text-center">
          <div>
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="mb-3 font-medium text-slate-500 dark:text-slate-400">Nie znaleziono ekipy</p>
            <Link href="/grupy" className="text-sm font-medium text-primary-700 hover:underline">Wróć do ekip</Link>
          </div>
        </main>
      </div>
    );
  }

  const memberCount = members.length;
  // Zakładka Rozmowa jest jedynym miejscem, gdzie strona ma zachowywać się
  // jak ekran czatu: BottomNav znika (patrz HideBottomNav niżej), więc bez
  // stałej wysokości viewportu pod kontenerem rozmowy zostawałaby pusta
  // przestrzeń, którą kiedyś zajmował pasek nawigacji.
  const rozmowaPelnoekranowa = tab === 'tablica' && member;

  return (
    <div className={`flex flex-col bg-canvas ${rozmowaPelnoekranowa ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'}`}>
      {/* Na mobile Header oddaje swój pasek grupie — dokładnie jak na /mapa
          (`hideMobileBarForUser`): tożsamość (dzwonek+avatar) nie znika,
          tylko przenosi się do paska grupy niżej, żeby nie dublować się
          z jej własnym niskim paskiem. Na desktopie Header zostaje bez zmian. */}
      <Header hideMobileBarForUser />
      <main className={`mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-5 ${rozmowaPelnoekranowa ? 'flex min-h-0 flex-col overflow-hidden' : ''}`}>
        {/* Niska belka — dawniej osobny wiersz "← Ekipy" i karta nagłówka
            z okładką na pół ekranu zjadały cały górny ekran zgłoszenie
            wprost. Wszystko w jednym niskim pasku, przyklejonym na górze
            (zastępuje mobilny pasek Header): powrót, logo, nazwa, „Zaproś"
            i na mobile dzwonek. Kod dołączenia i ustawienia miały tu za dużo
            miejsca — kod dołączenia żyje w arkuszu „Zaproś" (ZaprosDoGrupySheet),
            a ustawienia dostały własną zakładkę (link niżej, przy pozostałych
            zakładkach) zamiast osobnej zębatki tutaj. Awatar zniknął — sam
            dzwonek wystarczy, profil jest już w dolnej nawigacji. */}
        {/* -mt-5 znosi górny padding <main> (py-5) na mobile, żeby pasek
            siedział tuż przy górnej krawędzi ekranu, tak jak zgłoszono
            wprost — zbyt duży odstęp od krawędzi. Na desktopie Header
            zostaje widoczny nad tym paskiem, więc odstęp z <main> ma sens
            i go nie znosimy. */}
        {/* Belka i zakładki razem w JEDNYM sticky kontenerze — dwa osobne
            `sticky top-0` elementy nakładałyby się na tej samej wysokości
            zamiast układać w stos, więc oba trzymają się razem jako jedna
            całość podczas przewijania.
            Zakładka Rozmowa nie ma `sticky` — tam <main> jest już
            `overflow-hidden` w stałej wysokości ekranu (rozmowaPelnoekranowa)
            i nie przewija się, więc `position: sticky` na dziecku
            overflow-hidden liczy swój "punkt zaczepienia" inaczej niż
            zwykły scroll i belka lądowała niżej niż na pozostałych
            zakładkach — zgłoszone wprost. Statyczne pozycjonowanie w tym
            jednym przypadku daje ten sam efekt (belka i tak jest pierwszym
            elementem na górze), bez tej niespójności. */}
        <div className={`${rozmowaPelnoekranowa ? '' : 'sticky top-0 z-[1010]'} -mx-4 -mt-5 bg-canvas md:static md:mx-0 md:mt-0 md:bg-transparent`}>
          <div className="space-y-1 px-4 pb-1 pt-2 md:px-0 md:pb-0 md:pt-0">
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-100 bg-white px-2 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <button
                onClick={() => router.push('/grupy')}
                aria-label="Wróć do ekip"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-ink dark:hover:bg-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary-700 to-primary-900 text-base">
                {group.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-white">{group.sport ? sportEmoji(group.sport) : '👥'}</span>
                )}
              </span>
              <h1 className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink">{group.name}</h1>
              {member && perms.canInvite && (
                <button
                  onClick={() => setInviteOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950"
                >
                  <Link2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Zaproś</span>
                </button>
              )}
              <div className="shrink-0 md:hidden">
                <NotificationBell />
              </div>
            </div>
            <p className="truncate px-1 text-xs text-slate-500 dark:text-slate-400">
              {[group.sport ? sportLabel(group.sport) : null, group.city, group.fieldName].filter(Boolean).join(' · ')}
              {(group.sport || group.city || group.fieldName) && ' · '}
              {memberCount} {plural(memberCount, 'członek', 'członkowie', 'członków')}
            </p>
          </div>

          {/* Zakładki — nad "Najbliższy mecz", nie pod nią: to nawigacja
              strony, więc ma stać najwyżej, zaraz pod paskiem grupy.
              `scrollbar-hide` (globals.css): przewijanie w bok na wąskim
              telefonie nie ma pokazywać poziomego paska przewijania — samo
              przewijanie działa tak samo, znika tylko sam pasek. */}
          <div className="border-b border-slate-100 bg-canvas px-4 dark:border-slate-700 md:bg-transparent md:px-0">
            <div className="scrollbar-hide flex gap-5 overflow-x-auto">
              {TABS.map(({ value, label }) => (
                <button key={value} onClick={() => goToTab(value)} className={tabCls(tab === value)}>
                  {label}
                  {value === 'sklad' && <span className="ml-1.5 text-xs font-normal text-slate-400">{memberCount}</span>}
                  {value === 'tablica' && nieprzeczytaneN > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{nieprzeczytaneN}</span>
                  )}
                </button>
              ))}
              {/* Zębatka ustawień zniknęła z belki — zbyt dużo elementów w jednym
                niskim pasku. Ta sama akcja, teraz jako zakładka: styl identyczny
                z resztą, ale to Link do /edytuj, nie przełącznik stanu `tab` —
                strona ustawień ma już własne zakładki (Ogólne/Zaproszenia/
                Uprawnienia), więc nie duplikujemy jej treści tutaj. */}
            {(perms.isFounder || perms.canManageMembers) && (
              <Link href={`/grupy/${group.id}/edytuj`} className={tabCls(false)}>
                Ustawienia
              </Link>
            )}
            </div>
          </div>
        </div>

        {legacyBezKodu && !member && (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-4">
            <p className="text-sm font-semibold text-ink">Zaproszenie do ekipy „{group.name}”</p>
            <p className="mt-1 text-sm text-slate-600">
              Ten link jest nieaktualny — poproś kogoś z ekipy o nowy.
            </p>
          </div>
        )}

        {/* Widoczne wyłącznie w zakładce Mecze — to jest jej treść (skrót
            najbliższego terminu), nie uniwersalny nagłówek strony. Na
            pozostałych zakładkach (zwłaszcza Rozmowa, gdzie ma być widać
            composer bez przewijania) tylko zajmowała miejsce. */}
        {tab === 'mecze' && (
          <NajblizszyMeczGrupy
            groupId={group.id}
            upcoming={member ? nextMatch : null}
            ostatni={member ? ostatniMecz : null}
            canCreateEvents={perms.canCreateEvents}
            relation={nextMatch ? statusFor(nextMatch) : undefined}
          />
        )}

        {tab === 'mecze' && (
          <div className="space-y-5">
            <div className="hidden items-center justify-between md:flex">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Mecze ekipy</h2>
              {perms.canCreateEvents && (
                <Link href={`/wydarzenia/nowe?group=${group.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800">
                  <CalendarPlus className="h-3.5 w-3.5" /> Nowy termin
                </Link>
              )}
            </div>
            {events.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Brak meczów. {perms.canCreateEvents && 'Stwórz pierwszy!'}
              </p>
            )}
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nadchodzące</h3>
                {upcoming.map((e) => <EventBrowseCard key={e.id} event={e} relation={statusFor(e)} />)}
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Historia</h3>
                {past.map((e) => <EventBrowseCard key={e.id} event={e} relation={statusFor(e)} />)}
              </section>
            )}
          </div>
        )}

        {tab === 'tablica' && (member ? (
          <>
            {/* BottomNav jest `fixed bottom-0` i nie rezerwuje miejsca w
                dokumencie — bez tego zasłaniał composer na dole kontenera
                rozmowy, zgłoszone wprost jako "zasłonięte". */}
            <HideBottomNav />
            {/* flex-1 min-h-0 rozciąga kontener rozmowy do dołu ekranu —
                <main> i ten div są teraz `h-[100dvh] overflow-hidden`
                (rozmowaPelnoekranowa), więc to jest jedyny element, który
                może jeszcze rosnąć. Bez min-h-0 flex nie pozwoliłby
                kontenerowi rozmowy skurczyć się poniżej wysokości jego
                treści, co wyłączyłoby jego własny scroll. */}
            <div className="min-h-0 flex-1">
              <RozmowaGrupy groupId={group.id} permissions={perms} />
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Rozmowa jest widoczna wyłącznie dla członków ekipy.
          </p>
        ))}

        {tab === 'sklad' && member && perms.canInvite && (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold text-primary-700 hover:text-primary-800 dark:hover:text-primary-400"
            >
              <Link2 className="h-4 w-4 shrink-0" /> <span className="truncate">Zaproś do ekipy</span>
            </button>
            <button
              onClick={handleCopyCode}
              title="Kopiuj kod dołączenia"
              className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              {kodSkopiowany ? <Check className="h-3 w-3 text-green-600" /> : group.joinCode}
            </button>
            <button
              onClick={handleShareGroup}
              aria-label="Udostępnij zaproszenie"
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-ink dark:hover:bg-slate-700"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {tab === 'sklad' && (
          <SkladGrupy
            members={members}
            myUserId={user?.id}
            permissions={perms}
            founderId={group.createdBy}
            onRemove={handleRemove}
            onSetPerms={handleSetPerms}
            onLeave={member && !perms.isFounder ? handleLeave : undefined}
            leaveBusy={busy}
          />
        )}

        {tab === 'staty' && (member ? (
          <StatystykiGrupy groupId={group.id} />
        ) : (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Statystyki są widoczne wyłącznie dla członków ekipy.
          </p>
        ))}

        {!member && !legacyBezKodu && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            {kodZUrl ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Dołączam do ekipy…</span>
            ) : (
              'Poproś kogoś z ekipy o link, żeby dołączyć.'
            )}
          </div>
        )}
      </main>

      {inviteOpen && (
        <ZaprosDoGrupySheet group={group} najblizszy={nextMatch ?? undefined} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}
