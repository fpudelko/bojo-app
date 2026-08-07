'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users, ArrowLeft, Share2, Copy, Check, Plus, LogOut, Trash2,
  User as UserIcon, Loader2, Crown, ChevronRight, Pencil, MapPin, Mail, CalendarPlus,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import CoverUpload from '@/components/ui/CoverUpload';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { useMyParticipation } from '@/lib/useMyParticipation';
import { isUpcoming } from '@/lib/eventDates';
import { startKey } from '@/lib/eventFilters';
import { plural } from '@/lib/plural';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  getGroup, getGroupMembers, getGroupEvents, isGroupMember,
  joinGroup, leaveGroup, removeMember, deleteGroup, setGroupCover,
} from '@/lib/groups';
import { sportEmoji, sportLabel } from '@/lib/sports';
import type { Group, GroupMember, EventItem } from '@/types';

type Tab = 'mecze' | 'sklad';
const TABS: { value: Tab; label: string }[] = [
  { value: 'mecze', label: 'Mecze' },
  { value: 'sklad', label: 'Skład' },
];

function tabCls(active: boolean) {
  return `pb-2.5 text-sm transition-colors ${
    active
      ? 'border-b-2 border-primary-700 font-semibold text-primary-700'
      : 'text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-slate-100'
  }`;
}

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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Zakładka: stan lokalny, ale odczytany z URL-a, więc ?tab=sklad da się
  // podlinkować i przeżywa odświeżenie.
  //
  // Adres aktualizujemy przez history.replaceState, nie router.replace jak na
  // /moje-gry. Tam trasa jest statyczna i nawigacja nic nie kosztuje; tutaj
  // /grupy/[id] jest dynamiczna, więc każde router.replace to round-trip po
  // dane z serwera (łącznie z generateMetadata) — a przełączenie zakładki jest
  // czysto kliencke i niczego z serwera nie potrzebuje.
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'sklad' ? 'sklad' : 'mecze');

  const goToTab = (t: Tab) => {
    setTab(t);
    const sp = new URLSearchParams(window.location.search);
    if (t === 'mecze') sp.delete('tab'); else sp.set('tab', t);
    const qs = sp.toString();
    window.history.replaceState(null, '', `/grupy/${id}${qs ? `?${qs}` : ''}`);
  };

  // Wejście z linku zaproszenia /g/[kod] — przekierowanie dokleja ?join=1,
  // ale nikt tego dotąd nie czytał, więc obiecana „prominent join action"
  // nie istniała: zaproszony lądował na zwykłej stronie.
  const fromInvite = searchParams.get('join') === '1';

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

    // Członkostwo pytane osobno, nie wyliczane z listy członków. Wcześniej
    // awaria dogrywki danych zostawiała `member = false` i pokazywała
    // członkowi grupy przycisk „Dołącz do grupy".
    if (user) {
      isGroupMember(id, user.id).then(setMember).catch(() => {});
    } else {
      setMember(false);
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

  const isOwner = !!user && !!group && group.createdBy === user.id;

  const inviteLink = group && typeof window !== 'undefined'
    ? `${window.location.origin}/g/${group.joinCode}`
    : '';

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const share = async () => {
    if (!group) return;
    const text = `Dołącz do mojej grupy "${group.name}" w Bojo ⚽`;
    if (navigator.share) {
      await navigator.share({ title: group.name, text, url: inviteLink }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}\n${inviteLink}`).catch(() => {});
      toast('Skopiowano link z zaproszeniem');
    }
  };

  const handleJoin = async () => {
    if (!user) { window.location.href = `/logowanie?next=${encodeURIComponent(`/grupy/${id}`)}`; return; }
    setBusy(true);
    try { await joinGroup(id, user.id); await load(); toast('Dołączyłeś do grupy!'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleLeave = async () => {
    if (!user) return;
    if (!confirm('Na pewno opuścić grupę?')) return;
    setBusy(true);
    try { await leaveGroup(id, user.id); toast('Opuściłeś grupę'); router.push('/grupy'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); setBusy(false); }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Usunąć tego gracza z grupy?')) return;
    setBusy(true);
    try { await removeMember(id, userId); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Na pewno usunąć grupę? Tej operacji nie można cofnąć.')) return;
    setBusy(true);
    try { await deleteGroup(id); toast('Grupa usunięta'); router.push('/grupy'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); setBusy(false); }
  };

  // Nadchodzące rosnąco (najbliższy pierwszy). getEventsByGroup sortuje
  // `event_date DESC`, więc bez tego na górze stał mecz NAJDALSZY.
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

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <div className="h-44 animate-pulse rounded-2xl border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800" />
        </main>
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 text-center">
          <div>
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="mb-3 font-medium text-slate-500 dark:text-slate-400">Nie znaleziono grupy</p>
            <Link href="/grupy" className="text-sm font-medium text-primary-700 hover:underline">Wróć do grup</Link>
          </div>
        </main>
      </div>
    );
  }

  const memberCount = members.length;
  const showJoinBanner = fromInvite && !member;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <button
          onClick={() => router.push('/grupy')}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-ink dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> Grupy
        </button>

        {/* Zaproszenie z linku — domyka obietnicę, którą /g/[kod] składa od zawsze */}
        {showJoinBanner && (
          <div className="mb-4 rounded-2xl border-2 border-primary-200 bg-primary-50/70 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-700">
              <Mail className="h-3.5 w-3.5" /> Zaproszenie
            </p>
            <p className="mt-1.5 text-sm text-ink">
              Masz zaproszenie do <span className="font-bold">{group.name}</span>.
            </p>
            <Button onClick={handleJoin} disabled={busy} className="mt-3 inline-flex w-full items-center justify-center gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Dołącz do grupy</>}
            </Button>
          </div>
        )}

        {/* Hero: okładka + nazwa + kontekst na jednym ekranie */}
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="relative h-44 bg-gradient-to-br from-primary-700 to-primary-900">
            {group.coverImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {isOwner && (
              <div className="absolute right-3 top-3 flex gap-2">
                <CoverUpload
                  currentUrl={group.coverImageUrl}
                  path={`groups/${group.id}/cover`}
                  onSaved={async (url) => {
                    try {
                      await setGroupCover(group.id, url ?? null);
                      setGroup((g) => (g ? { ...g, coverImageUrl: url ?? undefined } : g));
                    } catch { toast('Nie udało się zapisać okładki', 'error'); }
                  }}
                />
                <Link
                  href={`/grupy/${group.id}/edytuj`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 backdrop-blur-sm transition hover:bg-white active:scale-95"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edytuj
                </Link>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 p-4">
              <span className="text-3xl drop-shadow-md">{group.sport ? sportEmoji(group.sport) : '👥'}</span>
              <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-white drop-shadow">{group.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {group.sport && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                    {sportLabel(group.sport)}
                  </span>
                )}
                {group.city && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                    {group.city}
                  </span>
                )}
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                  {memberCount} {plural(memberCount, 'członek', 'członkowie', 'członków')}
                </span>
              </div>
            </div>
          </div>

          {(group.description || group.fieldName) && (
            <div className="space-y-2 p-4">
              {group.fieldName && (
                group.fieldId ? (
                  <Link href={`/boisko/${group.fieldId}`} className="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {group.fieldName}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {group.fieldName}
                  </span>
                )
              )}
              {group.description && (
                <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">{group.description}</p>
              )}
            </div>
          )}
        </div>

        {/* Najbliższy mecz — pierwsze pytanie, jakie ma członek ekipy */}
        {member && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-700">Najbliższy mecz</p>
            {nextMatch ? (
              <EventBrowseCard event={nextMatch} relation={statusFor(nextMatch)} />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ekipa nie ma zaplanowanej gry</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Wrzuć termin, a wszyscy go zobaczą.</p>
              </div>
            )}
          </div>
        )}

        {/* Zakładki */}
        <div className="mt-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex gap-6">
            {TABS.map(({ value, label }) => (
              <button key={value} onClick={() => goToTab(value)} className={tabCls(tab === value)}>
                {label}
                {value === 'sklad' && <span className="ml-1.5 text-xs font-normal text-slate-400">{memberCount}</span>}
              </button>
            ))}
          </div>
        </div>

        {tab === 'mecze' ? (
          <div className="mt-4 space-y-5">
            {events.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Brak meczów. {member && 'Stwórz pierwszy!'}
              </p>
            )}
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Nadchodzące
                </h2>
                {upcoming.map((e) => <EventBrowseCard key={e.id} event={e} relation={statusFor(e)} />)}
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Historia
                </h2>
                {past.map((e) => <EventBrowseCard key={e.id} event={e} relation={statusFor(e)} />)}
              </section>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Rząd awatarów — kto to jest, jednym rzutem oka, bez czytania listy */}
            {members.length > 0 && (
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {members.slice(0, 8).map((m) => (
                    m.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img key={m.id} src={m.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-canvas" />
                    ) : (
                      <span key={m.id} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700 ring-2 ring-canvas">
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                    )
                  ))}
                </div>
                {members.length > 8 && (
                  <span className="ml-2 text-xs font-medium text-slate-500">+{members.length - 8}</span>
                )}
              </div>
            )}

            <ul className="divide-y divide-slate-50 dark:divide-slate-700">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <Link href={`/gracz/${m.userId}`} className="group flex min-w-0 flex-1 items-center gap-3">
                    {m.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={m.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                        <UserIcon className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink transition-colors group-hover:text-primary-700">{m.name}</span>
                      {m.role === 'admin' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                          <Crown className="h-3 w-3" /> Założyciel
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-primary-600 dark:text-slate-600" />
                  </Link>
                  {isOwner && m.userId !== user?.id && (
                    <button
                      onClick={() => handleRemove(m.userId)}
                      disabled={busy}
                      title="Usuń z grupy"
                      className="shrink-0 rounded p-1.5 text-slate-500 hover:text-red-500 dark:text-slate-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* Zaproszenie żyje tam, gdzie skład — to jest jego kontekst */}
            {member && (
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Zaproś do grupy</p>
                <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                  Wyślij link — po kliknięciu znajomy od razu zobaczy zaproszenie.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={share}
                    className="inline-flex min-w-[140px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-800 active:scale-95"
                  >
                    <Share2 className="h-4 w-4" /> Udostępnij link
                  </button>
                  <button
                    onClick={copyLink}
                    className="inline-flex min-w-[140px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {copied ? <><Check className="h-4 w-4 text-green-600" /> Skopiowano</> : <><Copy className="h-4 w-4" /> Kopiuj link</>}
                  </button>
                </div>
                <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                  lub podaj kod: <span className="font-mono font-bold tracking-widest text-primary-700">{group.joinCode}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Strefa niebezpieczna — celowo dyskretna */}
        {member && (
          <div className="flex justify-center pb-2 pt-6">
            {isOwner ? (
              <button onClick={handleDelete} disabled={busy} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600 dark:text-slate-500">
                <Trash2 className="h-3.5 w-3.5" /> Usuń grupę
              </button>
            ) : (
              <button onClick={handleLeave} disabled={busy} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600 dark:text-slate-500">
                <LogOut className="h-3.5 w-3.5" /> Opuść grupę
              </button>
            )}
          </div>
        )}
      </main>

      {/* Jedna główna akcja, zawsze pod ręką. Baner zaproszenia ma już własny
          przycisk „Dołącz", więc wtedy pasek się nie dubluje.
          `--bottom-nav-h` (globals.css) trzyma go nad dolną nawigacją. */}
      {!showJoinBanner && (
        <div
          className="sticky z-30 border-t border-slate-200 bg-canvas/95 px-4 py-3 backdrop-blur-sm dark:border-slate-700"
          style={{ bottom: 'var(--bottom-nav-h)' }}
        >
          <div className="mx-auto w-full max-w-2xl">
            {member ? (
              <Link href={`/wydarzenia/nowe?group=${group.id}`}>
                <Button className="inline-flex w-full items-center justify-center gap-2">
                  <CalendarPlus className="h-4 w-4" /> Stwórz mecz w grupie
                </Button>
              </Link>
            ) : (
              <Button onClick={handleJoin} disabled={busy} className="inline-flex w-full items-center justify-center gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Dołącz do grupy</>}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
