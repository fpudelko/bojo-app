'use client';

import { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMyNotifications, markRead, toNotif, otwarteSprawy, WYMAGA_AKCJI } from '@/lib/notifications';
import { useAuth } from '@/lib/auth';
import type { AppNotification } from '@/types';

/** Trasy dla powiadomień, które nie dotyczą żadnego meczu. Bez tej mapy
 *  powiadomienie bez `event_id` renderowało się jako martwy, nieklikalny
 *  wiersz — czyli mówiło „zrób coś" i nie dawało jak. */
const TYP_NA_TRASE: Record<string, string> = {
  uzupelnij_profil: '/profil',
};

/** Dokąd prowadzi powiadomienie; `null`, gdy donikąd.
 *
 *  `niepotwierdzony_wpis_goscia` niesie `event_id` (do treści: „mecz X"), ale
 *  kliknięcie ma prowadzić do przejęcia wpisu, nie od razu na stronę meczu —
 *  inaczej kliknięcie nie robiłoby tego, co obiecuje treść („Potwierdź"). */
function celPowiadomienia(n: AppNotification): string | null {
  if (n.type === 'niepotwierdzony_wpis_goscia' && n.claimToken) {
    return `/gracz/przejmij/${n.claimToken}`;
  }
  if (n.eventId) return `/wydarzenia/${n.eventId}`;
  return TYP_NA_TRASE[n.type] ?? null;
}

/** Treść wiersza — identyczna w wariancie klikalnym i nieklikalnym.
 *
 *  Rozróżnienie, o które chodzi: PRZECZYTANE ≠ ZAŁATWIONE. Otwarcie dzwonka
 *  oznacza wszystko jako przeczytane, a wcześniej wiersz dostawał wtedy zieloną
 *  fajkę i wyszarzenie — czyli prośba o dołączenie, której nikt jeszcze nie
 *  rozpatrzył, wyglądała na obsłużoną. Fajki nie ma już wcale, a powiadomienia
 *  wymagające działania nie blakną po przeczytaniu — zostają czytelne i dostają
 *  znacznik „Sprawdź".
 *
 *  „Wymaga działania" nie jest już cechą TYPU powiadomienia, tylko jego
 *  aktualnego stanu: `otwarteSprawy()` sprawdza w bazie, czy prośba nadal
 *  czeka na decyzję i czy oferta miejsca nadal jest aktywna. Prośba rozpatrzona
 *  gaśnie jak każdy inny przeczytany wpis — bez tego wisiała ze znacznikiem
 *  „Sprawdź" bez końca, mimo że nie było już czego sprawdzać. */
function TrescPowiadomienia({ n, wymagaAkcji }: { n: AppNotification; wymagaAkcji: boolean }) {
  const wygaszone = !!n.readAt && !wymagaAkcji;
  return (
    <>
      {!n.readAt && (
        <span className={`inline-block w-1.5 h-1.5 rounded-full mb-1 ${wymagaAkcji ? 'bg-blue-600' : 'bg-primary-600'}`} />
      )}
      <p className={`text-sm leading-tight ${wygaszone ? 'font-normal text-slate-500' : 'font-medium text-ink'}`}>{n.title}</p>
      {n.body && <p className={`text-xs mt-0.5 ${wygaszone ? 'text-slate-400' : 'text-slate-600'}`}>{n.body}</p>}
      <div className="mt-1 flex items-center gap-2">
        <p className="text-xs text-slate-400">
          {new Date(n.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
        {wymagaAkcji && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
            Sprawdź <ChevronRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </>
  );
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
  // `null` = jeszcze nie wiemy (albo zapytanie padło). Wtedy zostaje
  // dotychczasowy wygląd — lepiej pokazać „Sprawdź" o jeden raz za dużo niż
  // wygasić prośbę, która naprawdę czeka.
  const [otwarte, setOtwarte] = useState<Set<string> | null>(null);
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

  // Realtime powyżej potrafi przegrać wyścig z insertem wykonanym tuż po
  // zalogowaniu (np. `zglos_brak_pelnej_nazwy` w `lib/auth.tsx`) — kanał
  // jeszcze nie zdążył się zasubskrybować, zanim wiersz powstał w bazie.
  // Zamiast na to liczyć, kod tworzący takie jednorazowe powiadomienie
  // jawnie każe tu odświeżyć listę, gdy insert się powiedzie.
  useEffect(() => {
    if (!user) return;
    const odswiez = () => { getMyNotifications(10).then(setNotifs).catch(() => {}); };
    window.addEventListener('bojo:powiadomienia-odswiez', odswiez);
    return () => window.removeEventListener('bojo:powiadomienia-odswiez', odswiez);
  }, [user]);

  // Stan spraw dociągamy przy KAŻDYM otwarciu panelu, nie raz przy montażu:
  // organizator akceptuje prośbę na stronie meczu i wraca do dzwonka: wpis ma
  // wtedy zniknąć ze „Sprawdź", a nic go o tej akceptacji nie powiadomi.
  useEffect(() => {
    if (!user || !open) return;
    const doSprawdzenia = notifs.filter((n) => WYMAGA_AKCJI.has(n.type));
    if (doSprawdzenia.length === 0) { setOtwarte(new Set()); return; }
    let aktualne = true;
    otwarteSprawy(user.id, notifs)
      .then((zbior) => { if (aktualne) setOtwarte(zbior); })
      .catch(() => {});
    return () => { aktualne = false; };
    // `notifs.length` zamiast całej tablicy: `markRead` podmienia obiekty
    // wpisów (nowe `readAt`), co przy zależności od tablicy odpalałoby
    // zapytanie drugi raz zaraz po otwarciu panelu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, open, notifs.length]);

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
        <div className="fixed inset-x-3 top-14 z-[1010] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
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
              {notifs.map((n) => {
                // Dopóki stanu nie znamy (`otwarte === null`), zachowujemy się
                // jak dotąd: typ decyduje. Gdy znamy — decyduje sprawa.
                const wymagaAkcji = WYMAGA_AKCJI.has(n.type)
                  && (otwarte === null || otwarte.has(n.id));
                const bgClass = !n.readAt
                  ? (wymagaAkcji ? 'bg-blue-50/60' : 'bg-primary-50/40')
                  : wymagaAkcji ? 'bg-blue-50/30' : 'opacity-60';
                const cel = celPowiadomienia(n);
                return (
                  <li key={n.id}>
                    {cel ? (
                      <Link
                        href={cel}
                        onClick={() => setOpen(false)}
                        className={`block px-4 py-3 hover:bg-slate-50 transition-colors ${bgClass}`}
                      >
                        <TrescPowiadomienia n={n} wymagaAkcji={wymagaAkcji} />
                      </Link>
                    ) : (
                      <div className={`px-4 py-3 ${bgClass}`}>
                        <TrescPowiadomienia n={n} wymagaAkcji={wymagaAkcji} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
