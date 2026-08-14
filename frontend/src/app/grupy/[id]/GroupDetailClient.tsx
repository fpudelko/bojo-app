'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users, ArrowLeft, Settings, Loader2, LogOut, Trash2, CalendarPlus, Link2,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import NajblizszyMeczGrupy from '@/components/groups/NajblizszyMeczGrupy';
import TablicaGrupy from '@/components/groups/TablicaGrupy';
import SkladGrupy from '@/components/groups/SkladGrupy';
import StatystykiGrupy from '@/components/groups/StatystykiGrupy';
import ZaprosDoGrupySheet from '@/components/groups/ZaprosDoGrupySheet';
import { useMyParticipation } from '@/lib/useMyParticipation';
import { isUpcoming } from '@/lib/eventDates';
import { startKey } from '@/lib/eventFilters';
import { plural } from '@/lib/plural';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  getGroup, getGroupMembers, getGroupEvents, isGroupMember, getMyGroupPermissions,
  joinGroupByCode, leaveGroup, removeMember, deleteGroup, uprawnieniaCzlonka,
} from '@/lib/groups';
import { getGroupPosts, nieprzeczytane } from '@/lib/groupPosts';
import { sportEmoji, sportLabel } from '@/lib/sports';
import type { Group, GroupMember, EventItem, GroupPermissions } from '@/types';

type Tab = 'mecze' | 'tablica' | 'sklad' | 'staty';
const TABS: { value: Tab; label: string }[] = [
  { value: 'mecze', label: 'Mecze' },
  { value: 'tablica', label: 'Tablica' },
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

  const isOwner = !!user && !!group && group.createdBy === user.id;
  const perms = permissions ?? uprawnieniaCzlonka(group ?? {}, undefined);

  const handleLeave = async () => {
    if (!user) return;
    if (!confirm('Opuścić ekipę?')) return;
    setBusy(true);
    try { await leaveGroup(id, user.id); toast('Opuściłeś ekipę'); router.push('/grupy'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); setBusy(false); }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Usunąć tego gracza z ekipy? Straci dostęp do tablicy i meczów ekipy. Wpisy zostają.')) return;
    setBusy(true);
    try { await removeMember(id, userId); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!group) return;
    if (!confirm(`Usunąć ekipę ${group.name}? Znika tablica, skład i statystyki. Mecze zostają, ale przestają być przypisane do ekipy. Tego nie da się cofnąć.`)) return;
    setBusy(true);
    try { await deleteGroup(id); toast('Ekipa usunięta'); router.push('/grupy'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); setBusy(false); }
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

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header showMobileWordmark />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-5">
        <button
          onClick={() => router.push('/grupy')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-ink dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> Ekipy
        </button>

        {legacyBezKodu && !member && (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-4">
            <p className="text-sm font-semibold text-ink">Zaproszenie do ekipy „{group.name}”</p>
            <p className="mt-1 text-sm text-slate-600">
              Ten link jest nieaktualny — poproś kogoś z ekipy o nowy.
            </p>
          </div>
        )}

        {/* Nagłówek — okładka jako mały kafelek, nie pół ekranu (dawny problem
            zgłoszony wprost: zakrywała najważniejszą treść). */}
        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-700 to-primary-900 text-2xl">
            {group.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-white">{group.sport ? sportEmoji(group.sport) : '👥'}</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-bold text-ink">{group.name}</h1>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {[group.sport ? sportLabel(group.sport) : null, group.city, group.fieldName].filter(Boolean).join(' · ')}
              {(group.sport || group.city || group.fieldName) && ' · '}
              {memberCount} {plural(memberCount, 'członek', 'członkowie', 'członków')}
            </p>
            {member && (
              <button
                onClick={() => setInviteOpen(true)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
              >
                <Link2 className="h-3.5 w-3.5" /> Zaproś
              </button>
            )}
          </div>
          {perms.isFounder || perms.canManageMembers ? (
            <Link
              href={`/grupy/${group.id}/edytuj`}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-700"
              aria-label="Ustawienia ekipy"
            >
              <Settings className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        <NajblizszyMeczGrupy
          groupId={group.id}
          upcoming={member ? nextMatch : null}
          ostatni={member ? ostatniMecz : null}
          canCreateEvents={perms.canCreateEvents}
        />

        {/* Zakładki */}
        <div className="border-b border-slate-100 dark:border-slate-700">
          <div className="flex gap-5 overflow-x-auto">
            {TABS.map(({ value, label }) => (
              <button key={value} onClick={() => goToTab(value)} className={tabCls(tab === value)}>
                {label}
                {value === 'sklad' && <span className="ml-1.5 text-xs font-normal text-slate-400">{memberCount}</span>}
                {value === 'tablica' && nieprzeczytaneN > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{nieprzeczytaneN}</span>
                )}
              </button>
            ))}
          </div>
        </div>

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
          <TablicaGrupy groupId={group.id} permissions={perms} />
        ) : (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Tablica jest widoczna wyłącznie dla członków ekipy.
          </p>
        ))}

        {tab === 'sklad' && (
          <SkladGrupy
            members={members}
            myUserId={user?.id}
            permissions={perms}
            founderId={group.createdBy}
            onRemove={handleRemove}
          />
        )}

        {tab === 'staty' && (member ? (
          <StatystykiGrupy groupId={group.id} />
        ) : (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Statystyki są widoczne wyłącznie dla członków ekipy.
          </p>
        ))}

        {/* Strefa niebezpieczna — celowo dyskretna */}
        {member && (
          <div className="flex justify-center pb-2 pt-4">
            {isOwner ? (
              <button onClick={handleDelete} disabled={busy} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600 dark:text-slate-500">
                <Trash2 className="h-3.5 w-3.5" /> Usuń ekipę
              </button>
            ) : (
              <button onClick={handleLeave} disabled={busy} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600 dark:text-slate-500">
                <LogOut className="h-3.5 w-3.5" /> Opuść ekipę
              </button>
            )}
          </div>
        )}

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
