'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, ArrowLeft, Share2, Copy, Check, Plus, LogOut, Trash2,
  User as UserIcon, Loader2, Crown, ChevronRight, Calendar,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import CoverUpload from '@/components/ui/CoverUpload';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { isUpcoming } from '@/components/EventCard';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  getGroup, getGroupMembers, getGroupEvents, isGroupMember,
  joinGroup, leaveGroup, removeMember, deleteGroup,
} from '@/lib/groups';
import { sportEmoji, sportLabel } from '@/lib/sports';
import type { Group, GroupMember, EventItem } from '@/types';

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [member, setMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const g = await getGroup(id);
      if (!g) { setNotFound(true); return; }
      setGroup(g);
      const [m, ev] = await Promise.all([getGroupMembers(id), getGroupEvents(id)]);
      setMembers(m);
      setEvents(ev);
      setMember(user ? m.some((x) => x.userId === user.id) : false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { if (!authLoading) load(); }, [load, authLoading]);

  const isOwner = !!user && !!group && group.createdBy === user.id;

  const link = typeof window !== 'undefined' ? `${window.location.origin}/grupy/${id}` : '';

  const copyCode = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const share = async () => {
    if (!group) return;
    const text = `Dołącz do grupy "${group.name}" w Bojo — kod: ${group.joinCode}`;
    if (navigator.share) {
      await navigator.share({ title: group.name, text, url: link }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}\n${link}`).catch(() => {});
      toast('Skopiowano zaproszenie');
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
    setBusy(true);
    try { await leaveGroup(id, user.id); toast('Opuściłeś grupę'); router.push('/grupy'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); setBusy(false); }
  };

  const handleRemove = async (userId: string) => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-canvas">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-40 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 animate-pulse" />
        </main>
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="min-h-screen flex flex-col bg-canvas">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center">
          <div>
            <Users className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-500 dark:text-slate-400 mb-3">Nie znaleziono grupy</p>
            <Link href="/grupy" className="text-primary-700 text-sm font-medium hover:underline">Wróć do grup</Link>
          </div>
        </main>
      </div>
    );
  }

  const upcoming = events.filter((e) => e.status !== 'cancelled' && isUpcoming(e));
  const past = events.filter((e) => e.status === 'cancelled' || !isUpcoming(e));

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <button onClick={() => router.push('/grupy')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Grupy
        </button>

        {/* Header card */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
          {/* Cover image */}
          <div className="relative h-36 bg-gradient-to-br from-primary-700 to-primary-900">
            {group.coverImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <span className="absolute bottom-3 left-4 text-3xl drop-shadow-md">
              {group.sport ? sportEmoji(group.sport) : '👥'}
            </span>
            {isOwner && (
              <div className="absolute bottom-3 right-3">
                <CoverUpload
                  currentUrl={group.coverImageUrl}
                  path={`groups/${group.id}/cover`}
                  onSaved={async (url) => {
                    const { supabase } = await import('@/lib/supabase');
                    const { error } = await supabase
                      .from('groups')
                      .update({ cover_image_url: url })
                      .eq('id', group.id);
                    if (!error) setGroup((g) => g ? { ...g, coverImageUrl: url ?? undefined } : g);
                  }}
                />
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-ink">{group.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {members.length} {members.length === 1 ? 'członek' : 'członków'}
                {group.sport && ` · ${sportLabel(group.sport)}`}
                {group.city && ` · ${group.city}`}
              </p>
            </div>
            {group.description && (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">{group.description}</p>
            )}

            {/* Membership actions */}
            <div className="mt-5">
              {!member ? (
                <Button onClick={handleJoin} disabled={busy} className="w-full inline-flex items-center justify-center gap-2">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Dołącz do grupy</>}
                </Button>
              ) : (
                <Link href={`/wydarzenia/nowe?group=${group.id}`}>
                  <Button className="w-full inline-flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Stwórz mecz w grupie
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Events */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Mecze grupy
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Brak meczów. {member && 'Stwórz pierwszy!'}</p>
          ) : (
            <div className="space-y-4">
              {upcoming.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nadchodzące</p>
                  {upcoming.map((e) => <EventBrowseCard key={e.id} event={e} />)}
                </div>
              )}
              {past.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Historia</p>
                  {past.map((e) => <EventBrowseCard key={e.id} event={e} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Członkowie
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{members.length}</span>
          </h2>
          <ul className="divide-y divide-slate-50 dark:divide-slate-700">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <Link href={`/gracz/${m.userId}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                  {m.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={m.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                      <UserIcon className="w-4 h-4" />
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-ink truncate group-hover:text-primary-700 transition-colors">{m.name}</span>
                    {m.role === 'admin' && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                        <Crown className="w-3 h-3" /> Założyciel
                      </span>
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-primary-600 transition-colors" />
                </Link>
                {isOwner && m.userId !== user?.id && (
                  <button onClick={() => handleRemove(m.userId)} disabled={busy} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-500 rounded shrink-0" title="Usuń z grupy">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Invite */}
        {member && (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Zaproś do grupy</p>
            <p className="font-mono text-4xl font-bold tracking-[0.25em] text-primary-700 mb-4">{group.joinCode}</p>
            <div className="flex gap-2">
              <button
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 whitespace-nowrap"
              >
                {copied ? <><Check className="w-3.5 h-3.5 text-green-600" /> Skopiowano</> : <><Copy className="w-3.5 h-3.5" /> Kopiuj kod</>}
              </button>
              <button
                onClick={share}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-800 active:scale-95 whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5" /> Udostępnij
              </button>
            </div>
          </div>
        )}

        {/* Danger zone */}
        {member && (
          <div className="flex flex-col gap-2 pt-2">
            {isOwner ? (
              <button onClick={handleDelete} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-800 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                <Trash2 className="w-4 h-4" /> Usuń grupę
              </button>
            ) : (
              <button onClick={handleLeave} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
                <LogOut className="w-4 h-4" /> Opuść grupę
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
