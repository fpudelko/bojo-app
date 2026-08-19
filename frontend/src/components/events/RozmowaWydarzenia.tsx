'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowDown, Loader2, Send, Trash2 } from 'lucide-react';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { getComments, addComment, deleteComment } from '@/lib/comments';
import type { EventComment } from '@/types';

/**
 * Rozmowa meczu — ten sam mechanizm i wygląd co RozmowaGrupy (chronologia
 * rosnąco, grupowanie wiadomości tej samej osoby, separatory dni, własny
 * scroll z auto-przewijaniem na dół, composer jako pigułka pod listą).
 * Dane to dawne `event_comments` (lib/comments.ts) — bez przypinania i bez
 * moderacji: to nie jest funkcja ekipy, tylko rozmowa uczestników jednego
 * meczu, więc każdy usuwa wyłącznie swoją wiadomość, tak jak w dawnym
 * EventComments, który ten komponent zastępuje.
 */
export default function RozmowaWydarzenia({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<EventComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pierwszyRender = useRef(true);

  const load = useCallback(() => {
    getComments(eventId).then(setComments).catch((e) => console.warn('[RozmowaWydarzenia]', e)).finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const scrollDoDolu = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  // Ta sama pułapka co w RozmowaGrupy/EventDetailClient: requestAnimationFrame,
  // bo kontener musi się najpierw przerenderować z nową wysokością.
  useEffect(() => {
    if (loading || comments.length === 0) return;
    requestAnimationFrame(() => scrollDoDolu(pierwszyRender.current ? 'auto' : 'smooth'));
    pierwszyRender.current = false;
  }, [loading, comments.length, scrollDoDolu]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  };
  useEffect(() => { autoGrow(); }, [body]);

  const handleAdd = async () => {
    if (!user || !body.trim() || busy) return;
    setBusy(true);
    try {
      const comment = await addComment(eventId, user.id, displayName(user), body);
      setBody('');
      setComments((prev) => [...prev, comment]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const etykietaDnia = (iso: string) => {
    const d = parseISO(iso);
    if (isToday(d)) return 'Dzisiaj';
    if (isYesterday(d)) return 'Wczoraj';
    return format(d, 'd MMMM', { locale: pl });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      <div ref={listRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex justify-center py-8 text-slate-300"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : comments.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Cisza przed meczem</p>
            <p className="mt-1 text-sm text-slate-400">
              Napisz coś — gdzie parkujemy, kto bierze piłki, o której się zbieramy.
            </p>
          </div>
        ) : (
          <div>
            {comments.map((c, i) => {
              const poprzedni = comments[i - 1];
              const nowyDzien = !poprzedni || etykietaDnia(c.createdAt) !== etykietaDnia(poprzedni.createdAt);
              const tenSamNadawca = !nowyDzien && poprzedni?.userId === c.userId;
              const wlasny = user?.id === c.userId;

              return (
                <div key={c.id}>
                  {nowyDzien && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                        {etykietaDnia(c.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${wlasny ? 'justify-end' : 'justify-start'} ${tenSamNadawca ? 'mt-0.5' : 'mt-2.5'}`}>
                    <div className="group relative max-w-[78%]">
                      {!wlasny && !tenSamNadawca && (
                        <p className="mb-0.5 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{c.userName}</p>
                      )}
                      <div
                        className={[
                          'relative rounded-2xl py-1.5 pl-3 pr-12 text-sm',
                          wlasny ? 'rounded-br-sm bg-primary-700 text-white' : 'rounded-bl-sm bg-white text-ink shadow-sm dark:bg-slate-800',
                        ].join(' ')}
                      >
                        <p className="whitespace-pre-line py-0.5">{c.body}</p>
                        <span className={`pointer-events-none absolute bottom-1 right-2.5 text-[10px] ${wlasny ? 'text-primary-200' : 'text-slate-400'}`}>
                          {format(parseISO(c.createdAt), 'HH:mm')}
                        </span>
                      </div>
                      {wlasny && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          aria-label="Usuń wiadomość"
                          className="absolute -left-6 top-0.5 rounded p-0.5 text-slate-300 opacity-60 hover:text-red-500 hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {!atBottom && comments.length > 0 && (
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
        <div data-bez-swipe className="flex shrink-0 items-end gap-2 border-t border-slate-100 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
            placeholder="Napisz do uczestników…"
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
