'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowDown, Loader2, MoreVertical, Pin, Send } from 'lucide-react';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { getGroupPosts, addGroupPost, deleteGroupPost, setGroupPostPinned } from '@/lib/groupPosts';
import type { GroupPost, GroupPermissions } from '@/types';

/**
 * Rozmowa ekipy — dawna "Tablica". Wygląda i zachowuje się jak czat
 * (WhatsApp jest wprost punktem odniesienia): chronologia rosnąco, composer
 * pod listą, własny kontener przewijania z auto-scrollem na dół i przyciskiem
 * powrotu. Mechanika bazy bez zmian — płaska lista `group_posts` (093),
 * przypinanie wysyła powiadomienie do całej ekipy tylko wtedy, gdy przypina
 * ktoś z `can_moderate_wall` (pilnuje tego wyzwalacz w bazie, nie UI).
 *
 * `getGroupPosts()` zwraca dane przypięty-pierwszy/malejąco (kolejność
 * potrzebna gdzie indziej, np. do licznika nieprzeczytanych) — tu sortujemy
 * do wyświetlenia osobno, żeby nie dotykać kontraktu funkcji ani testu, który
 * go przypina.
 */
export default function RozmowaGrupy({ groupId, permissions }: { groupId: string; permissions: GroupPermissions }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pierwszyRender = useRef(true);

  const load = useCallback(() => {
    getGroupPosts(groupId).then(setPosts).catch((e) => console.warn('[RozmowaGrupy]', e)).finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  // Chronologia rosnąco — najstarsza u góry, najnowsza na dole, jak w każdym
  // czacie. Przypięty banner liczymy z surowej listy (najświeższy przypięty).
  const chronologicznie = useMemo(
    () => [...posts].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [posts],
  );
  const przypiety = useMemo(
    () => posts.filter((p) => p.pinnedAt).sort((a, b) => (a.pinnedAt! > b.pinnedAt! ? -1 : 1))[0],
    [posts],
  );

  const scrollDoDolu = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  // Po pierwszym załadowaniu wjeżdżamy od razu na dół, bez animacji — tak
  // otwiera się każdy czat. Po dopisaniu własnej wiadomości też, tym razem
  // płynnie. requestAnimationFrame, bo kontener musi się najpierw
  // przerenderować z nową wysokością (ta sama pułapka co przy scrollIntoView
  // w EventDetailClient.tsx).
  useEffect(() => {
    if (loading || chronologicznie.length === 0) return;
    requestAnimationFrame(() => scrollDoDolu(pierwszyRender.current ? 'auto' : 'smooth'));
    pierwszyRender.current = false;
  }, [loading, chronologicznie.length, scrollDoDolu]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  // Auto-rosnący textarea (do 4 wierszy), zamiast sztywnego rows={2} —
  // krótka wiadomość nie ma zajmować tyle samo miejsca co długa.
  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  };
  useEffect(() => { autoGrow(); }, [body]);

  // Zamyka menu wiadomości po kliknięciu gdziekolwiek indziej.
  useEffect(() => {
    if (!menuId) return;
    const zamknij = () => setMenuId(null);
    document.addEventListener('click', zamknij);
    return () => document.removeEventListener('click', zamknij);
  }, [menuId]);

  const handleAdd = async () => {
    if (!user || !body.trim() || busy) return;
    setBusy(true);
    try {
      const post = await addGroupPost(groupId, user.id, displayName(user), body);
      setBody('');
      setPosts((prev) => [post, ...prev]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (postId: string) => {
    setMenuId(null);
    try {
      await deleteGroupPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handlePin = async (post: GroupPost) => {
    setMenuId(null);
    const nowyStan = !post.pinnedAt;
    try {
      await setGroupPostPinned(post.id, nowyStan);
      toast(nowyStan ? 'Przypięte. Wszyscy w ekipie zobaczą to pod dzwonkiem.' : 'Odpięte');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const skoczDoPrzypietej = () => {
    const el = przypiety && bubbleRefs.current[przypiety.id];
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const etykietaDnia = (iso: string) => {
    const d = parseISO(iso);
    if (isToday(d)) return 'Dzisiaj';
    if (isYesterday(d)) return 'Wczoraj';
    return format(d, 'd MMMM', { locale: pl });
  };

  return (
    <div className="flex h-[60dvh] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      {przypiety && (
        <button
          onClick={skoczDoPrzypietej}
          className="flex shrink-0 items-center gap-2 border-b border-primary-100 bg-primary-50 px-3 py-1.5 text-left text-xs text-primary-800 dark:border-primary-900 dark:bg-primary-950 dark:text-primary-200"
        >
          <Pin className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{przypiety.body}</span>
        </button>
      )}

      <div ref={listRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex justify-center py-8 text-slate-300"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : chronologicznie.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Cisza w ekipie</p>
            <p className="mt-1 text-sm text-slate-400">
              Napisz coś — kto bierze piłki, gdzie parkujemy, kto odpada w ten czwartek.
            </p>
          </div>
        ) : (
          <div>
            {chronologicznie.map((p, i) => {
              const poprzedni = chronologicznie[i - 1];
              const nowyDzien = !poprzedni || etykietaDnia(p.createdAt) !== etykietaDnia(poprzedni.createdAt);
              const tenSamNadawca = !nowyDzien && poprzedni?.userId === p.userId;
              const wlasny = user?.id === p.userId;
              const mozeUsunac = wlasny || permissions.canModerateWall;

              return (
                <div key={p.id}>
                  {nowyDzien && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                        {etykietaDnia(p.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${wlasny ? 'justify-end' : 'justify-start'} ${tenSamNadawca ? 'mt-0.5' : 'mt-2.5'}`}>
                    <div className="group relative max-w-[78%]">
                      {!wlasny && !tenSamNadawca && (
                        <p className="mb-0.5 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{p.userName}</p>
                      )}
                      <div
                        ref={(el) => { bubbleRefs.current[p.id] = el; }}
                        className={[
                          'relative rounded-2xl py-1.5 pl-3 pr-12 text-sm',
                          wlasny ? 'rounded-br-sm bg-primary-700 text-white' : 'rounded-bl-sm bg-white text-ink shadow-sm dark:bg-slate-800',
                          p.pinnedAt ? (wlasny ? 'ring-1 ring-primary-300' : 'ring-1 ring-primary-200') : '',
                        ].join(' ')}
                      >
                        <p className="whitespace-pre-line py-0.5">{p.body}</p>
                        <span className={`pointer-events-none absolute bottom-1 right-2.5 text-[10px] ${wlasny ? 'text-primary-200' : 'text-slate-400'}`}>
                          {p.pinnedAt && <Pin className="mr-0.5 inline h-2.5 w-2.5 align-[1px]" />}
                          {format(parseISO(p.createdAt), 'HH:mm')}
                        </span>
                      </div>
                      {mozeUsunac && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}
                          className={`absolute top-0.5 rounded p-0.5 text-slate-300 opacity-60 hover:opacity-100 ${wlasny ? '-left-6' : '-right-6'}`}
                          aria-label="Więcej"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {menuId === p.id && (
                        <div
                          className={`absolute top-6 z-10 w-36 overflow-hidden rounded-lg border border-slate-100 bg-white text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800 ${wlasny ? 'right-0' : 'left-0'}`}
                        >
                          {permissions.canModerateWall && (
                            <button onClick={() => handlePin(p)} className="block w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700">
                              {p.pinnedAt ? 'Odepnij' : 'Przypnij na górze'}
                            </button>
                          )}
                          {mozeUsunac && (
                            <button onClick={() => handleDelete(p.id)} className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                              Usuń
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {!atBottom && chronologicznie.length > 0 && (
          <div className="pointer-events-none sticky bottom-1 z-10 flex justify-end pr-1">
            <button
              onClick={() => scrollDoDolu()}
              aria-label="Przewiń do najnowszych"
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-md ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {user && (
        <div className="flex shrink-0 items-end gap-2 border-t border-slate-100 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
            placeholder="Napisz do ekipy…"
            rows={1}
            maxLength={1000}
            className="max-h-[110px] flex-1 resize-none rounded-2xl border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <button
            onClick={handleAdd}
            disabled={busy || !body.trim()}
            aria-label="Wyślij"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white transition hover:bg-primary-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
