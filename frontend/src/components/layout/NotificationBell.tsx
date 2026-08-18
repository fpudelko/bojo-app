'use client';

import { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import {
  Bell, CalendarPlus, CalendarX, Check, ChevronRight, MessageCircle, TicketCheck,
  UserPlus, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMyNotifications, markRead, toNotif, otwarteSprawy, WYMAGA_AKCJI } from '@/lib/notifications';
import { useAuth } from '@/lib/auth';
import OdpowiedzJednymKlikiem from '@/components/events/OdpowiedzJednymKlikiem';
import type { AppNotification } from '@/types';

/** Typy powiadomień, na które da się odpowiedzieć „Gram/Nie gram" wprost
 *  z panelu, bez wchodzenia na mecz. Świadomie WĄSKA lista: to pytania o mój
 *  udział. `prosba_o_dolaczenie` (ktoś chce dołączyć do MOJEGO meczu) ani
 *  `reserve_claim_offered` (oferta miejsca z rezerwy, ma własny przepływ
 *  z terminem ważności) tu nie należą — obie znaczą co innego niż „grasz?". */
const ODPOWIEM_STAD = new Set(['pytanie_o_udzial', 'zaproszenie_na_mecz']);

/**
 * Ikona i podpis rodzaju — jedno spojrzenie zamiast czytania.
 *
 * Panel wyglądał jak lista identycznych szarych akapitów: cztery pozycje
 * „Nowy mecz w grupie" pod rząd różniły się wyłącznie treścią drobnym drukiem
 * (zgłoszone wprost — „te powiadomienia jakoś mi się nie podobają"). Ikona
 * niesie rodzaj, więc oko odróżnia „odwołany" od „nowy" bez czytania, a kolor
 * trzyma się konwencji z AGENTS.md: niebieski = wymaga decyzji, różowy =
 * wiadomość, reszta neutralnie.
 */
const IKONY: Record<string, { Ikona: LucideIcon; klasa: string; rodzaj: string }> = {
  nowy_mecz_w_grupie:          { Ikona: CalendarPlus,  klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Nowy mecz' },
  event_cancelled:             { Ikona: CalendarX,     klasa: 'bg-red-50 text-red-600',         rodzaj: 'Odwołany' },
  mecz_odwolany:               { Ikona: CalendarX,     klasa: 'bg-red-50 text-red-600',         rodzaj: 'Odwołany' },
  prosba_o_dolaczenie:         { Ikona: UserPlus,      klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Prośba' },
  pytanie_o_udzial:            { Ikona: Check,         klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Grasz?' },
  zaproszenie_na_mecz:         { Ikona: Check,         klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Zaproszenie' },
  reserve_claim_offered:       { Ikona: TicketCheck,   klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Wolne miejsce' },
  ogloszenie_w_grupie:         { Ikona: MessageCircle, klasa: 'bg-pink-50 text-pink-600',       rodzaj: 'Ogłoszenie' },
  niepotwierdzony_wpis_goscia: { Ikona: UserPlus,      klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Potwierdź' },
};

const IKONA_DOMYSLNA = { Ikona: Bell, klasa: 'bg-slate-100 text-slate-500', rodzaj: 'Powiadomienie' };

/**
 * Nagłówek grupy: „Dziś", „Wczoraj", „Wcześniej".
 *
 * Data przy każdym wierszu („16 sie o 21:01") powtarzała tę samą informację
 * dziesięć razy i zabierała miejsce treści. Grupa mówi to raz, a przy wierszu
 * zostaje sama godzina — dokładnie tak jak w komunikatorach, z których ludzie
 * korzystają codziennie.
 */
function grupaDnia(iso: string, teraz: Date): string {
  const d = new Date(iso);
  const dzien = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const roznica = Math.round((dzien(teraz) - dzien(d)) / 86_400_000);
  if (roznica <= 0) return 'Dziś';
  if (roznica === 1) return 'Wczoraj';
  return 'Wcześniej';
}

function godzina(iso: string, grupa: string): string {
  const d = new Date(iso);
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (grupa !== 'Wcześniej') return hhmm;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

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
  // Ogłoszenie na tablicy grupy (093) nie ma meczu — prowadzi na samą grupę.
  if (n.groupId) return `/grupy/${n.groupId}`;
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
function TrescPowiadomienia({ n, wymagaAkcji, grupa }: {
  n: AppNotification;
  wymagaAkcji: boolean;
  grupa: string;
}) {
  const { Ikona, klasa, rodzaj } = IKONY[n.type] ?? IKONA_DOMYSLNA;
  // PRZECZYTANE ≠ ZAŁATWIONE, więc pozycja wymagająca decyzji nie blaknie
  // nigdy. Reszta po przeczytaniu traci wyłącznie WAGĘ (cieńsza czcionka,
  // spokojniejszy kolor) — wcześniej dostawała `opacity-60` i robiła się
  // nieczytelna, czyli historia powiadomień była bezużyteczna.
  const wygaszone = !!n.readAt && !wymagaAkcji;

  return (
    <div className="flex gap-3">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${klasa}`}>
        <Ikona className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className={`min-w-0 flex-1 text-sm leading-tight ${
            wygaszone ? 'font-medium text-slate-600' : 'font-semibold text-ink'
          }`}>
            {n.title}
          </p>
          <span className="shrink-0 text-[11px] text-slate-400">{godzina(n.createdAt, grupa)}</span>
        </div>

        {n.body && (
          <p className={`mt-0.5 line-clamp-2 text-xs ${wygaszone ? 'text-slate-400' : 'text-slate-600'}`}>
            {n.body}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{rodzaj}</span>
          {wymagaAkcji && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
              Sprawdź <ChevronRight className="h-3 w-3" />
            </span>
          )}
          {!n.readAt && !wymagaAkcji && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary-600" aria-label="nieprzeczytane" />
          )}
        </div>
      </div>
    </div>
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
  const listaRef = useRef<HTMLUListElement>(null);
  // Jeden znacznik czasu na render: gdyby każdy wiersz wołał `new Date()`,
  // lista otwarta o 23:59:59 mogłaby mieć dwie różne granice „Dziś".
  const teraz = new Date();

  const unread = notifs.filter((n) => !n.readAt).length;

  // Otwarcie panelu zawsze pokazuje GÓRĘ listy, czyli najnowsze powiadomienie.
  // Przeglądarka potrafi zapamiętać poprzednią pozycję przewijania i wtedy
  // panel otwiera się w środku historii — z nową rzeczą schowaną nad krawędzią.
  useEffect(() => {
    if (open && listaRef.current) listaRef.current.scrollTop = 0;
  }, [open, notifs.length]);

  /** Sprawa zamknięta odpowiedzią z panelu. Zdejmujemy powiadomienie ze zbioru
   *  otwartych zamiast przeładowywać całą listę: pozycja przestaje krzyczeć
   *  „Sprawdź", zostaje jako zwykły wpis w historii, a panel nie mruga. */
  const odswiezPoOdpowiedzi = (idPowiadomienia: string) => {
    setOtwarte((prev) => {
      if (!prev) return prev;
      const kopia = new Set(prev);
      kopia.delete(idPowiadomienia);
      return kopia;
    });
  };

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

      {/* WYSOKOŚĆ: `svh`, nie `vh`. Na iOS `vh` liczy się od WIĘKSZEGO okna
          (tego z ukrytym paskiem przeglądarki), więc 80vh potrafi być wyższe
          niż to, co realnie widać — panel schodził pod dolną nawigację razem
          z ostatnim powiadomieniem. `svh` to najmniejsze okno, czyli takie,
          które mieści się ZAWSZE. `vh` zostaje jako zapas dla starszych
          przeglądarek. */}
      {open && (
        <div className="fixed inset-x-3 top-14 z-[1010] flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl supports-[height:1svh]:max-h-[72svh] sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink">Powiadomienia</p>
            {notifs.length > 0 && (
              <span className="text-xs text-slate-400">{notifs.length} ostatnich</span>
            )}
          </div>

          {notifs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">Brak powiadomień</p>
              <p className="mt-1 text-xs text-slate-300">Damy znać, gdy coś się wydarzy w Twoich grach.</p>
            </div>
          ) : (
            /* `min-h-0` — TO JEST przyczyna, dla której listy nie dało się
               przewinąć. Element `flex-1` z własnym przewijaniem domyślnie NIE
               kurczy się poniżej wysokości swojej treści, więc rozpychał panel
               od środka: `overflow-hidden` obcinało dół (ostatnie powiadomienie
               znikało pod paskiem), a wewnętrzne przewijanie nigdy się nie
               włączało — palec przewijał stronę pod spodem. Ta sama pułapka co
               `min-w-0` przy `truncate`, opisana w AGENTS.md.

               `overscroll-contain` zostaje: pilnuje, żeby dojechanie do końca
               listy nie przenosiło przewijania na stronę pod spodem. */
            <ul
              ref={listaRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {notifs.map((n, i) => {
                // Dopóki stanu nie znamy (`otwarte === null`), zachowujemy się
                // jak dotąd: typ decyduje. Gdy znamy — decyduje sprawa.
                const wymagaAkcji = WYMAGA_AKCJI.has(n.type)
                  && (otwarte === null || otwarte.has(n.id));
                const grupa = grupaDnia(n.createdAt, teraz);
                const nowaGrupa = i === 0 || grupaDnia(notifs[i - 1].createdAt, teraz) !== grupa;
                const cel = celPowiadomienia(n);
                const tlo = !n.readAt
                  ? (wymagaAkcji ? 'bg-blue-50/60' : 'bg-primary-50/30')
                  : wymagaAkcji ? 'bg-blue-50/30' : 'bg-white';

                return (
                  <li key={n.id}>
                    {nowaGrupa && (
                      <p className="sticky top-0 z-10 bg-slate-50/95 px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 backdrop-blur">
                        {grupa}
                      </p>
                    )}
                    {cel ? (
                      <Link
                        href={cel}
                        onClick={() => setOpen(false)}
                        className={`block border-b border-slate-50 px-4 py-3 transition-colors hover:bg-slate-50 ${tlo}`}
                      >
                        <TrescPowiadomienia n={n} wymagaAkcji={wymagaAkcji} grupa={grupa} />
                        {/* Odpowiedź WEWNĄTRZ odnośnika, nie obok: cała pozycja
                            panelu jest klikalna, a przycisk obok niej byłby
                            drugim celem w tej samej linii. `OdpowiedzJednymKlikiem`
                            zatrzymuje zdarzenie, więc kliknięcie „Gram" nie
                            przenosi na mecz. */}
                        {n.eventId && ODPOWIEM_STAD.has(n.type) && wymagaAkcji && (
                          <span className="mt-2 flex justify-end">
                            <OdpowiedzJednymKlikiem
                              eventId={n.eventId}
                              wariant="panel"
                              onOdpowiedziano={() => odswiezPoOdpowiedzi(n.id)}
                            />
                          </span>
                        )}
                      </Link>
                    ) : (
                      <div className={`border-b border-slate-50 px-4 py-3 ${tlo}`}>
                        <TrescPowiadomienia n={n} wymagaAkcji={wymagaAkcji} grupa={grupa} />
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
