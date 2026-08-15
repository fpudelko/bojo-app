'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Loader2, Pin, Send, Trash2 } from 'lucide-react';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { getGroupPosts, addGroupPost, deleteGroupPost, setGroupPostPinned } from '@/lib/groupPosts';
import type { GroupPost, GroupPermissions } from '@/types';

/**
 * Rozmowa ekipy — dawna "Tablica". Wygląd dymków czatu (własne wiadomości po
 * prawej), ale mechanika bez zmian: płaska lista, bez wątków, przypięcie
 * wysyła powiadomienie do całej ekipy (`powiadom_o_ogloszeniu_w_grupie`, 093).
 */
export default function RozmowaGrupy({ groupId, permissions }: { groupId: string; permissions: GroupPermissions }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [przypnij, setPrzypnij] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getGroupPosts(groupId).then(setPosts).catch((e) => console.warn('[RozmowaGrupy]', e)).finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!user || !body.trim() || busy) return;
    setBusy(true);
    try {
      const post = await addGroupPost(groupId, user.id, displayName(user), body, { przypnij: przypnij && permissions.canModerateWall });
      setBody('');
      setPrzypnij(false);
      // Nowy przypięty wpis ma wylądować na górze, więc po prostu odświeżamy
      // całą listę zamiast dokładać wiersz lokalnie w niepewnej kolejności.
      if (post.pinnedAt) load(); else setPosts((prev) => [post, ...prev]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      await deleteGroupPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handlePin = async (post: GroupPost) => {
    const nowyStan = !post.pinnedAt;
    try {
      await setGroupPostPinned(post.id, nowyStan);
      toast(nowyStan ? 'Przypięte. Wszyscy w ekipie zobaczą to pod dzwonkiem.' : 'Odpięte');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {user && (
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
            placeholder="Napisz do ekipy…"
            rows={2}
            maxLength={1000}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <div className="mt-2 flex items-center justify-between">
            {permissions.canModerateWall ? (
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <input type="checkbox" checked={przypnij} onChange={(e) => setPrzypnij(e.target.checked)} className="rounded" />
                Przypnij na górze
              </label>
            ) : <span />}
            <button
              onClick={handleAdd}
              disabled={busy || !body.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-primary-800 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Wyślij
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8 text-slate-300"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : posts.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Cisza w ekipie</p>
          <p className="mt-1 text-sm text-slate-400">
            Napisz coś — kto bierze piłki, gdzie parkujemy, kto odpada w ten czwartek.
          </p>
        </div>
      ) : (
        // Kolejność zostaje jak w `getGroupPosts`: przypięty pierwszy, reszta
        // malejąco. Pole do pisania jest nad listą (nie pod, jak w typowym
        // czacie), więc najnowszy wpis MA być na górze, blisko composera —
        // odwrócenie do porządku chronologicznego oddaliłoby świeżą
        // wiadomość od miejsca, w którym powstała.
        <ul className="flex flex-col gap-2.5">
          {posts.map((p) => {
            const wlasny = user?.id === p.userId;
            return (
              <li key={p.id} className={`flex ${wlasny ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${wlasny ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!wlasny && (
                    <span className="mb-0.5 px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{p.userName}</span>
                  )}
                  <div
                    className={[
                      'rounded-2xl px-3.5 py-2.5 text-sm',
                      wlasny
                        ? 'rounded-br-sm bg-primary-700 text-white'
                        : 'rounded-bl-sm bg-white text-ink shadow-sm dark:bg-slate-800',
                      p.pinnedAt && !wlasny ? 'ring-1 ring-primary-200' : '',
                      p.pinnedAt && wlasny ? 'ring-1 ring-primary-300' : '',
                    ].join(' ')}
                  >
                    {p.pinnedAt && (
                      <span className={`mb-1 flex items-center gap-1 text-[11px] font-semibold ${wlasny ? 'text-primary-100' : 'text-primary-700'}`}>
                        <Pin className="h-3 w-3" /> Przypięte
                      </span>
                    )}
                    <p className="whitespace-pre-line">{p.body}</p>
                  </div>
                  <div className={`mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-400 ${wlasny ? 'flex-row-reverse' : ''}`}>
                    <span>{format(parseISO(p.createdAt), 'd MMM, HH:mm', { locale: pl })}</span>
                    {permissions.canModerateWall && (
                      <button onClick={() => handlePin(p)} className="hover:text-primary-600" title={p.pinnedAt ? 'Odepnij' : 'Przypnij na górze'}>
                        <Pin className="h-3 w-3" />
                      </button>
                    )}
                    {(wlasny || permissions.canModerateWall) && (
                      <button onClick={() => handleDelete(p.id)} className="hover:text-red-500" title="Usuń wiadomość">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
