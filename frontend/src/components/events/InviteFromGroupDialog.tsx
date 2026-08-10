'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Users, Check, Loader2 } from 'lucide-react';
import { getMyGroups, getGroupMembers } from '@/lib/groups';
import { getEventPlayerInvites, invitePlayers } from '@/lib/playerInvites';
import type { Group, GroupMember } from '@/types';
import { withCount } from '@/lib/plural';
import { WARSTWA } from '@/lib/warstwy';

/**
 * Zaproszenie na mecz grupy albo wybranych jej graczy.
 *
 * Domyślnie zaznaczeni są wszyscy, których da się zaprosić — bo „zaproś grupę"
 * to najczęstszy przypadek, a odznaczenie kilku osób jest szybsze niż
 * zaznaczanie dziesięciu. Osoby już zapisane na mecz albo już zaproszone
 * zostają na liście, ale jako nieaktywne z podpisem, żeby było widać,
 * że nie zniknęły — tylko nie ma po co ich zapraszać drugi raz.
 */
export default function InviteFromGroupDialog({
  eventId,
  userId,
  participantUserIds,
  onClose,
  onInvited,
}: {
  eventId: string;
  userId: string;
  /** Kto już jest w składzie / na rezerwie / czeka na akceptację. */
  participantUserIds: string[];
  onClose: () => void;
  onInvited: (count: number) => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMyGroups(userId), getEventPlayerInvites(eventId)])
      .then(([gs, invites]) => {
        setGroups(gs);
        setInvitedIds(new Set(invites.map((i) => i.userId)));
        if (gs.length > 0) setGroupId(gs[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Nie udało się wczytać grup'))
      .finally(() => setLoading(false));
  }, [userId, eventId]);

  useEffect(() => {
    if (!groupId) { setMembers([]); return; }
    getGroupMembers(groupId)
      .then((ms) => {
        setMembers(ms);
        // Wstępnie zaznacz wszystkich, których w ogóle da się zaprosić.
        setSelected(new Set(
          ms
            .filter((m) => m.userId !== userId
              && !participantUserIds.includes(m.userId)
              && !invitedIds.has(m.userId))
            .map((m) => m.userId),
        ));
      })
      .catch(() => setMembers([]));
  }, [groupId, userId, participantUserIds, invitedIds]);

  const reasonFor = (m: GroupMember): string | null => {
    if (m.userId === userId) return 'to Ty';
    if (participantUserIds.includes(m.userId)) return 'już zapisany';
    if (invitedIds.has(m.userId)) return 'już zaproszony';
    return null;
  };

  const invitable = members.filter((m) => reasonFor(m) === null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleInvite = async () => {
    setBusy(true);
    setError(null);
    try {
      const count = await invitePlayers(eventId, Array.from(selected), { invitedBy: userId, groupId });
      onInvited(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wysłać zaproszeń');
      setBusy(false);
    }
  };

  return (
    <div className={`fixed inset-0 ${WARSTWA.modal} flex items-end justify-center bg-black/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4`}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Users className="h-4 w-4 text-slate-400" />
          <h2 className="font-semibold text-ink">Zaproś z grupy</h2>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : groups.length === 0 ? (
            // Ślepy zaułek bez wyjścia: tekst kazał założyć grupę i nie dawał
            // jak. Boli tym bardziej, odkąd „Zaproś z grupy" stoi w panelu tuż
            // po publikacji — a świeży organizator z definicji nie ma jeszcze
            // grupy.
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500">
                Nie należysz jeszcze do żadnej grupy. Załóż ją, a potem zaprosisz ją na mecz
                jednym kliknięciem.
              </p>
              <Link
                href="/grupy/nowe"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-800"
              >
                <Users className="h-4 w-4" /> Załóż grupę
              </Link>
            </div>
          ) : (
            <>
              {groups.length > 1 && (
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink"
                >
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}

              {invitable.length > 0 && (
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Zaznaczono {selected.size} z {invitable.length}
                  </span>
                  <button
                    onClick={() => setSelected(
                      selected.size === invitable.length
                        ? new Set()
                        : new Set(invitable.map((m) => m.userId)),
                    )}
                    className="font-semibold text-primary-700 hover:text-primary-800"
                  >
                    {selected.size === invitable.length ? 'Odznacz wszystkich' : 'Zaznacz wszystkich'}
                  </button>
                </div>
              )}

              <ul className="divide-y divide-slate-100">
                {members.map((m) => {
                  const reason = reasonFor(m);
                  const checked = selected.has(m.userId);
                  return (
                    <li key={m.userId}>
                      <button
                        disabled={reason !== null}
                        onClick={() => toggle(m.userId)}
                        className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-50"
                      >
                        <span
                          className={[
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                            checked && !reason
                              ? 'border-primary-700 bg-primary-700 text-white'
                              : 'border-slate-300 bg-white',
                          ].join(' ')}
                        >
                          {checked && !reason && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{m.name}</span>
                        {reason && <span className="shrink-0 text-xs text-slate-400">{reason}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {members.length > 0 && invitable.length === 0 && (
                <p className="pt-3 text-center text-sm text-slate-500">
                  Cała grupa jest już zapisana albo zaproszona.
                </p>
              )}
            </>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <button
            onClick={handleInvite}
            disabled={busy || selected.size === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {/* Zaproszenie całej grupy jednym dotknięciem działa od początku
                (wszyscy zapraszalni są domyślnie zaznaczeni), ale przycisk
                mówił tylko „Zaproś 8 osób" — nie widać było, że to komplet. */}
            {selected.size === 0
              ? 'Wybierz kogo zaprosić'
              : invitable.length > 1 && selected.size === invitable.length
                ? `Zaproś całą grupę (${selected.size})`
                : `Zaproś ${withCount(selected.size, 'osobę', 'osoby', 'osób')}`}
          </button>
        </div>
      </div>
    </div>
  );
}
