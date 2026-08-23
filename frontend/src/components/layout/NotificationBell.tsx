'use client';

import { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import {
  Bell, CalendarPlus, CalendarX, Check, ChevronRight, MessageCircle, Settings,
  TicketCheck, UserPlus, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  getMyNotifications, markRead, toNotif, otwarteSprawy, WYMAGA_AKCJI, TYPY_WIADOMOSCI, celPowiadomienia,
} from '@/lib/notifications';
import { useAuth } from '@/lib/auth';
import { ustawPlakietke } from '@/lib/plakietkaAplikacji';
import OdpowiedzJednymKlikiem from '@/components/events/OdpowiedzJednymKlikiem';
import type { AppNotification } from '@/types';

/** Typy powiadomień, na które da się odpowiedzieć „Gram/Nie gram" wprost
 *  z panelu, bez wchodzenia na mecz. Świadomie WĄSKA lista: to pytania o mój
 *  udział. `prosba_o_dolaczenie` (ktoś chce dołączyć do MOJEGO meczu) ani
 *  `reserve_claim_offered` (oferta miejsca z rezerwy, ma własny przepływ
 *  z terminem ważności) tu nie należą — obie znaczą co innego niż „grasz?". */
const ODPOWIEM_STAD = new Set(['pytanie_o_udzial', 'zaproszenie_na_mecz']);

/**
 * Ile powiadomień wczytujemy do panelu.
 *
 * Było 10 i to była zła liczba: przy ekipie grającej co tydzień dziesięć
 * pozycji kończy się na przedwczoraj, więc „nie widzę tego, co przyszło rano"
 * było prawdą — reszta po prostu nie istniała w panelu. Lista i tak się
 * przewija, więc jedynym kosztem większej liczby jest ciut większa odpowiedź
 * z bazy, a zyskiem historia, do której da się wrócić.
 *
 * 50, nie „wszystkie": panel to podręczna lista ostatnich zdarzeń, a nie
 * archiwum. Przy pięćdziesięciu pozycjach przewijanie zaczyna być gorsze od
 * wejścia w mecz i sprawdzenia na miejscu.
 */
const ILE_POWIADOMIEN = 50;

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
  wiadomosc_w_meczu:           { Ikona: MessageCircle, klasa: 'bg-pink-50 text-pink-600',       rodzaj: 'Wiadomość' },
  wiadomosc_w_grupie:          { Ikona: MessageCircle, klasa: 'bg-pink-50 text-pink-600',       rodzaj: 'Wiadomość' },
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

/** Zawartość jednego z dwóch paneli (wiadomości / reszta) — wydzielona, żeby
 *  nie duplikować grupowania po dniach i klikalnego wiersza w dwóch miejscach. */
function PanelPowiadomien({
  lista, otwarte, teraz, listaRef, naZamknij, odswiezPoOdpowiedzi,
  tytul, PustaIkona, pustyTytul, pustyOpis,
}: {
  lista: AppNotification[];
  otwarte: Set<string> | null;
  teraz: Date;
  listaRef: React.RefObject<HTMLUListElement>;
  naZamknij: () => void;
  odswiezPoOdpowiedzi: (id: string) => void;
  tytul: string;
  PustaIkona: LucideIcon;
  pustyTytul: string;
  pustyOpis: string;
}) {
  return (
    // WYSOKOŚĆ: `svh`, nie `vh`. Na iOS `vh` liczy się od WIĘKSZEGO okna
    // (tego z ukrytym paskiem przeglądarki), więc 80vh potrafi być wyższe
    // niż to, co realnie widać — panel schodził pod dolną nawigację razem
    // z ostatnim powiadomieniem. `svh` to najmniejsze okno, czyli takie,
    // które mieści się ZAWSZE. `vh` zostaje jako zapas dla starszych
    // przeglądarek.
    <div className="fixed inset-x-3 top-14 z-[1010] flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl supports-[height:1svh]:max-h-[72svh] sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-ink">{tytul}</p>
        {/* „N ostatnich" mówiło o liczbie, której nikt nie potrzebuje —
            widać ją na liście. W tym samym rogu mieszka teraz wejście
            w ustawienia powiadomień: to najbardziej naturalne miejsce, żeby
            ich szukać (jestem w powiadomieniach i chcę zmienić, co
            dostaję), a nie profil, do którego trzeba wiedzieć, żeby zajrzeć.
            W profilu ustawienia zostają — to dwie drogi do tego samego. */}
        <Link
          href="/profil#powiadomienia"
          onClick={naZamknij}
          aria-label="Ustawienia powiadomień"
          title="Ustawienia powiadomień"
          className="-mr-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>

      {lista.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <PustaIkona className="mx-auto mb-2 h-8 w-8 text-slate-200" />
          <p className="text-sm text-slate-400">{pustyTytul}</p>
          <p className="mt-1 text-xs text-slate-300">{pustyOpis}</p>
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
          {lista.map((n, i) => {
            // Dopóki stanu nie znamy (`otwarte === null`), zachowujemy się
            // jak dotąd: typ decyduje. Gdy znamy — decyduje sprawa.
            const wymagaAkcji = WYMAGA_AKCJI.has(n.type)
              && (otwarte === null || otwarte.has(n.id));
            const grupa = grupaDnia(n.createdAt, teraz);
            const nowaGrupa = i === 0 || grupaDnia(lista[i - 1].createdAt, teraz) !== grupa;
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
                    onClick={naZamknij}
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
  // Który z dwóch paneli jest otwarty — nigdy oba naraz, więc jeden stan
  // zamiast dwóch niezależnych `open`.
  const [otwartyPanel, setOtwartyPanel] = useState<'dzwonek' | 'wiadomosci' | null>(null);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  // `null` = jeszcze nie wiemy (albo zapytanie padło). Wtedy zostaje
  // dotychczasowy wygląd — lepiej pokazać „Sprawdź" o jeden raz za dużo niż
  // wygasić prośbę, która naprawdę czeka.
  const [otwarte, setOtwarte] = useState<Set<string> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const listaDzwonekRef = useRef<HTMLUListElement>(null);
  const listaWiadomosciRef = useRef<HTMLUListElement>(null);
  // Jeden znacznik czasu na render: gdyby każdy wiersz wołał `new Date()`,
  // lista otwarta o 23:59:59 mogłaby mieć dwie różne granice „Dziś".
  const teraz = new Date();

  // Powiadomienia o WIADOMOŚCIACH wypadają z dzwonka — mają własne miejsce
  // w nawigacji (zakładka „Rozmowy" z chmurką). Dzwonek zostaje wyłącznie dla
  // rzeczy wymagających działania; bez tego filtru „ktoś napisał" ginęłoby
  // w tej samej liście co „prośba o dołączenie", a licznik nieprzeczytanych
  // byłby trzeci z rzędu dla tej samej rzeczy.
  const reszta = notifs.filter((n) => !TYPY_WIADOMOSCI.has(n.type));
  const unreadReszta = reszta.filter((n) => !n.readAt).length;
  const nieprzeczytaneRazem = notifs.filter((n) => !n.readAt).length;

  // Otwarcie panelu zawsze pokazuje GÓRĘ listy, czyli najnowsze powiadomienie.
  // Przeglądarka potrafi zapamiętać poprzednią pozycję przewijania i wtedy
  // panel otwiera się w środku historii — z nową rzeczą schowaną nad krawędzią.
  useEffect(() => {
    if (otwartyPanel === 'dzwonek' && listaDzwonekRef.current) listaDzwonekRef.current.scrollTop = 0;
    if (otwartyPanel === 'wiadomosci' && listaWiadomosciRef.current) listaWiadomosciRef.current.scrollTop = 0;
  }, [otwartyPanel, notifs.length]);

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
    getMyNotifications(ILE_POWIADOMIEN).then(setNotifs).catch(() => {});

    const ch = supabase
      .channel(`notifs-${user.id}-${instancja}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifs((prev) => [toNotif(payload.new), ...prev]),
      )
      .on(
        // Odświeżenie w oknie ciszy (migracja 122): druga wiadomość w tej
        // samej rozmowie w ciągu godziny nie dostaje NOWEGO wiersza, tylko
        // podmienia treść istniejącego (limit push/liczby wierszy zostaje).
        // Bez tej subskrypcji panel „Wiadomości" pokazywałby zamrożoną
        // pierwszą wiadomość z godziny, dopóki ktoś nie przeładuje strony.
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifs((prev) => {
          const zaktualizowane = toNotif(payload.new);
          const istniejace = prev.find((n) => n.id === zaktualizowane.id);
          if (!istniejace) return prev;
          // `created_at` bez zmiany = to `markRead` (albo inna zmiana bez
          // nowej treści) odbite echem z bazy — podmieniamy w miejscu, żeby
          // nie przeskakiwało na górę listy przy zwykłym oznaczeniu jako
          // przeczytane.
          if (istniejace.createdAt === zaktualizowane.createdAt) {
            return prev.map((n) => (n.id === zaktualizowane.id ? zaktualizowane : n));
          }
          return [zaktualizowane, ...prev.filter((n) => n.id !== zaktualizowane.id)];
        }),
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
    const odswiez = () => { getMyNotifications(ILE_POWIADOMIEN).then(setNotifs).catch(() => {}); };
    window.addEventListener('bojo:powiadomienia-odswiez', odswiez);
    return () => window.removeEventListener('bojo:powiadomienia-odswiez', odswiez);
  }, [user]);

  // Kliknięcie w powiadomienie PUSH (poza aplikacją) ląduje na stronie
  // z `?przeczytaj=<id>` doklejonym przez service worker (`public/sw.js`) —
  // bez tego wiersz w dzwonku zostawał nieprzeczytany, mimo że telefon
  // właśnie pokazał (i użytkownik otworzył) dokładnie tę treść. Panel
  // otwarty w aplikacji i tak oznacza wszystko jako przeczytane od razu
  // (patrz `handleToggle`), więc to dotyczy WYŁĄCZNIE ścieżki push.
  // Czytane z `window.location`, nie `useSearchParams()` — ten hak wywala
  // produkcyjny build na trasach prerenderowanych (patrz AGENTS.md).
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const id = sp.get('przeczytaj');
    if (!id) return;
    markRead([id]).catch(() => {});
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)));
    sp.delete('przeczytaj');
    const qs = sp.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    // Tylko przy montażu — parametr obsługuje się raz, zanim cokolwiek go usunie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Stan spraw dociągamy przy KAŻDYM otwarciu panelu, nie raz przy montażu:
  // organizator akceptuje prośbę na stronie meczu i wraca do dzwonka: wpis ma
  // wtedy zniknąć ze „Sprawdź", a nic go o tej akceptacji nie powiadomi.
  // Żaden typ z `TYPY_WIADOMOSCI` nie jest w `WYMAGA_AKCJI`, więc panel
  // wiadomości nigdy nie potrzebuje tego stanu — liczenie go od razu z całej
  // listy `notifs` (nie tylko `reszta`) jest tańsze niż filtrowanie dwa razy.
  useEffect(() => {
    if (!user || !otwartyPanel) return;
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
  }, [user, otwartyPanel, notifs.length]);

  // Liczba na IKONIE APLIKACJI (`lib/plakietkaAplikacji.ts`). Dzwonek jest
  // jedynym miejscem w aplikacji, które zna komplet nieprzeczytanych, więc
  // stąd ją ustawiamy — na każdą zmianę stanu, także po oznaczeniu jako
  // przeczytane (plakietka, która nie gaśnie, przestaje cokolwiek znaczyć).
  //
  // WSZYSTKIE nieprzeczytane, nie tylko te z dzwonka: na ikonie jest miejsce
  // na jedną liczbę, a rozróżnienie „wiadomość / reszta" niesie w aplikacji
  // kolor (różowa chmurka, czerwony dzwonek — patrz AGENTS.md), czego ikona
  // systemowa nie odda. Ta sama definicja co w `public/sw.js` i w funkcji
  // brzegowej `send-push` — obie liczą wiersze `notifications` bez `read_at`.
  // Powiadomienia o wiadomościach gasi wejście na `/rozmowy`
  // (`oznaczWiadomosciPrzeczytane`), bo panel chmurki w nagłówku już nie
  // istnieje.
  //
  // Sufit `ILE_POWIADOMIEN` z definicji ogranicza tę liczbę — przy 50
  // nieprzeczytanych plakietka i tak dawno przestała być licznikiem, a stała
  // się kropką z cyframi.
  //
  // Dzwonek jest zamontowany DWA razy (nagłówek mobilny i desktopowy), więc
  // ten efekt wykonuje się dwa razy z tą samą wartością. To jest bez skutków:
  // ustawienie plakietki jest idempotentne.
  useEffect(() => {
    ustawPlakietke(user ? nieprzeczytaneRazem : 0);
  }, [user, nieprzeczytaneRazem]);

  // Close on outside click
  useEffect(() => {
    if (!otwartyPanel) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOtwartyPanel(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [otwartyPanel]);

  /** Otwiera/zamyka panel dzwonka i oznacza jego powiadomienia jako
   *  przeczytane. Panel wiadomości odszedł razem z ikoną w nagłówku —
   *  `panel` zostaje parametrem, bo `otwartyPanel` niesie ten sam typ i wolę
   *  jedno miejsce do rozszerzenia niż dwie ścieżki do zsynchronizowania. */
  const handleToggle = async (panel: 'dzwonek' | 'wiadomosci') => {
    const opening = otwartyPanel !== panel;
    setOtwartyPanel(opening ? panel : null);
    if (!opening) return;
    const ids = reszta.filter((n) => !n.readAt).map((n) => n.id);
    if (ids.length === 0) return;
    await markRead(ids);
    const zbior = new Set(ids);
    setNotifs((prev) => prev.map((n) => (zbior.has(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)));
  };

  if (!user) return null;

  return (
    <div className="flex items-center" ref={ref}>
      {/* IKONA WIADOMOŚCI ZNIKŁA Z NAGŁÓWKA (2026-08-23).
          Migracja `119` rozdzieliła jeden dzwonek na dwa — chmurkę dla
          wiadomości i dzwonek dla reszty — bo w dolnym pasku „wszystkie pięć
          miejsc było zajętych", a wiadomości musiały być widoczne wszędzie.
          Od czasu, gdy Rozmowy dostały własną zakładkę z chmurką, to samo
          nieprzeczytane było liczone w DWÓCH miejscach naraz: ikona w nagłówku
          pokazywała „7", a plakietka na zakładce swoje. Dwa liczniki tej samej
          rzeczy nie dają dwa razy więcej informacji — dają pytanie, który
          z nich jest prawdziwy.

          Zostaje DZWONEK, i to jest cała jego rola: rzeczy WYMAGAJĄCE DZIAŁANIA
          (prośby o dołączenie, oferty miejsca z rezerwy, rozliczenia — patrz
          `WYMAGA_AKCJI` w `lib/notifications.ts`). Wiadomości mają swoje
          miejsce w nawigacji. */}

      <div className="relative">
        <button
          onClick={() => handleToggle('dzwonek')}
          aria-label={`Powiadomienia${unreadReszta > 0 ? ` · ${unreadReszta} nowych` : ''}`}
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadReszta > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unreadReszta > 9 ? '9+' : unreadReszta}
            </span>
          )}
        </button>

        {otwartyPanel === 'dzwonek' && (
          <PanelPowiadomien
            lista={reszta}
            otwarte={otwarte}
            teraz={teraz}
            listaRef={listaDzwonekRef}
            naZamknij={() => setOtwartyPanel(null)}
            odswiezPoOdpowiedzi={odswiezPoOdpowiedzi}
            tytul="Powiadomienia"
            PustaIkona={Bell}
            pustyTytul="Brak powiadomień"
            pustyOpis="Damy znać, gdy coś się wydarzy w Twoich grach."
          />
        )}
      </div>
    </div>
  );
}
