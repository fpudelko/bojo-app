'use client';

import { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMyNotifications, markRead, toNotif } from '@/lib/notifications';
import { useAuth } from '@/lib/auth';
import type { AppNotification } from '@/types';

/** Trasy dla powiadomień, które nie dotyczą żadnego meczu. Bez tej mapy
 *  powiadomienie bez `event_id` renderowało się jako martwy, nieklikalny
 *  wiersz — czyli mówiło „zrób coś" i nie dawało jak. */
const TYP_NA_TRASE: Record<string, string> = {
  uzupelnij_profil: '/profil',
};

/** Dokąd prowadzi powiadomienie; `null`, gdy donikąd. */
function celPowiadomienia(n: AppNotification): string | null {
  if (n.eventId) return `/wydarzenia/${n.eventId}`;
  return TYP_NA_TRASE[n.type] ?? null;
}

export default function NotificationBell() {
  const { user } = useAuth();
  // Nazwa kanału musi być unikalna PER INSTANCJA, nie per użytkownik. Dzwonek
  // renderuje się dwa razy — raz w nagłówku mobilnym, raz w desktopowym —
  // a Supabase przy powtórzonej nazwie oddaje istniejący kanał zamiast tworzyć
  // nowy. Drugi komponent trafiał wtedy na kanał już zasubskrybowany i jego
  // `.on()` kończyło się wyjątkiem „cannot add postgres_changes callbacks
  // after subscribe()". Widoczny jest zawsze tylko jeden dzwonek, ale
  // zamontowane są oba.
  // `useId()` zwraca wartości z dwukropkami (`:r1:`), a nazwa kanału trafia
  // do topiku Phoenixa — zostawiamy tylko znaki alfanumeryczne.
  const instancja = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [open,   setOpen]   = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.readAt).length;

  // Load + subscribe
  useEffect(() => {
    if (!user) { setNotifs([]); return; }
    getMyNotifications(10).then(setNotifs).catch(() => {});

    const ch = supabase
      .channel(`notifs-${user.id}-${instancja}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifs((prev) => [toNotif(payload.new), ...prev]),
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, instancja]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleToggle = async () => {
    const opening = !open;
    setOpen(opening);
    if (opening && unread > 0) {
      const ids = notifs.filter((n) => !n.readAt).map((n) => n.id);
      await markRead(ids);
      setNotifs((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        aria-label={`Powiadomienia${unread > 0 ? ` · ${unread} nowych` : ''}`}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white shadow-xl z-[1010] overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Powiadomienia</p>
            {notifs.length > 0 && (
              <span className="text-xs text-slate-400">{notifs.length} ostatnich</span>
            )}
          </div>

          {notifs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Brak powiadomień</p>
              <p className="text-xs text-slate-300 mt-1">Damy znać, gdy coś się wydarzy w Twoich grach.</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {notifs.map((n) => (
                <li key={n.id}>
                  {celPowiadomienia(n) ? (
                    <Link
                      href={celPowiadomienia(n)!}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-3 hover:bg-slate-50 transition-colors ${!n.readAt ? 'bg-primary-50/40' : ''}`}
                    >
                      {!n.readAt && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-600 mb-1" />
                      )}
                      <p className="text-sm font-medium text-ink leading-tight">{n.title}</p>
                      {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(n.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </Link>
                  ) : (
                    <div className={`px-4 py-3 ${!n.readAt ? 'bg-primary-50/40' : ''}`}>
                      <p className="text-sm font-medium text-ink">{n.title}</p>
                      {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
