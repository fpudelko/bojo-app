'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Trash2, Send, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { EventComment } from '@/types';
import { getComments, addComment, deleteComment } from '@/lib/comments';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';

export default function EventComments({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<EventComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getComments(eventId)
      .then(setComments)
      .catch((e) => console.error('[Comments]', e))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleAdd = async () => {
    if (!user || !body.trim()) return;
    setBusy(true);
    try {
      const comment = await addComment(eventId, user.id, displayName(user), body.trim());
      setComments((prev) => [...prev, comment]);
      setBody('');
      toast('Komentarz dodany');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd podczas dodawania komentarza', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast('Komentarz usunięty');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4" /> Komentarze
        {!loading && comments.length > 0 && (
          <span className="text-xs font-normal text-gray-400">({comments.length})</span>
        )}
      </h2>

      {loading ? (
        <div className="flex justify-center py-4 text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">
          Brak komentarzy. {user ? 'Napisz pierwszy!' : 'Zaloguj się, aby dodać komentarz.'}
        </p>
      ) : (
        <ul className="space-y-4 mb-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                {c.userName.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-800">{c.userName}</span>
                  <span className="text-xs text-gray-400">
                    {format(parseISO(c.createdAt), 'd MMM, HH:mm', { locale: pl })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 break-words leading-relaxed">{c.body}</p>
              </div>
              {user?.id === c.userId && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 text-gray-200 hover:text-red-400 rounded shrink-0 self-start transition-colors"
                  aria-label="Usuń komentarz"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Napisz komentarz…"
            rows={2}
            maxLength={1000}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
          <button
            onClick={handleAdd}
            disabled={busy || !body.trim()}
            className="self-end p-2.5 rounded-xl bg-primary-700 text-white hover:bg-primary-800 disabled:opacity-50 transition-colors shrink-0"
            aria-label="Wyślij komentarz"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      ) : null}
    </div>
  );
}
