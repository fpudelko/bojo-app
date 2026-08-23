'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Lock, ChevronDown, X, Users, Check, Repeat, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import UnifiedLocationPicker from '@/components/map/UnifiedLocationPicker';
import type { LocationResult } from '@/components/map/UnifiedLocationPicker';
import { useAuth, displayName } from '@/lib/auth';
import { isPelneImie } from '@/lib/profileName';
import { zbudujPodsumowanie } from '@/lib/eventSummary';
import PodsumowanieMeczu from './PodsumowanieMeczu';
import { createEvent } from '@/lib/events';
import { getField } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import { FOCUS_SPORTS, FOCUS_SPORT_BY_SLUG, sportLabel, sportEmoji, GK_SPORTS } from '@/lib/sports';
import { validateStep1, validateStep2, validateStep, validatePayments, validateGoalkeepers, isPast } from '@/lib/eventWizard';
import { SHOW_RECURRING } from '@/lib/features';
import { HideBottomNav } from '@/lib/bottomNavVisibility';
import { WARSTWA } from '@/lib/warstwy';
import { defaultEventTitle } from '@/lib/eventTitle';
import {
  loadEventDraft, saveEventDraft, clearEventDraft, draftAgeLabel,
} from '@/lib/eventDraft';
import { wczytajOstatnieBoisko, zapiszOstatnieBoisko, type OstatnieBoisko } from '@/lib/lastVenue';
import WybierzGrupeDialog from '@/components/events/WybierzGrupeDialog';
import RecurringSettingsDialog from '@/components/events/RecurringSettingsDialog';
import EventPaymentFields from '@/components/events/EventPaymentFields';
import EventVisibilityFields from '@/components/events/EventVisibilityFields';
import EventTitleDescriptionField from '@/components/events/EventTitleDescriptionField';
import { MiejscaWSkladzie, UstawieniaRezerwy, UstawieniaBramkarzy } from '@/components/events/EventCapacityFields';
import OpcjaMeczu from '@/components/events/OpcjaMeczu';
import EventDateTimeField, { addMinutes } from '@/components/events/EventDateTimeField';
import { createRecurringEvent, dayOfWeekFromDate, dayOfWeekLabelFromDate } from '@/lib/recurring';
import type { Group } from '@/types';
import type { Visibility, PaymentMethod, SportsCardProvider } from '@/types';
import { withCount } from '@/lib/plural';

// NAZWY MÓWIĄ, O CO PYTAMY — i to nie jest kosmetyka.
//
// Poprzedni krok trzeci nazywał się „Opcje". To najgorsza możliwa nazwa dla
// ekranu, na którym siedzi najbardziej brzemienna decyzja w całej aplikacji:
// KTO TEN MECZ ZOBACZY. „Opcje" znaczy „możesz pominąć" — więc ludzie pomijali,
// a widoczność zostawała na wartości domyślnej, o której nikt świadomie nie
// zdecydował. Dziś krok nazywa się tym, co rozstrzyga, a widoczność stoi
// w nim PIERWSZA, tuż przy wyborze ekipy, z którym tworzy jedną myśl.
//
// Krok pierwszy pyta o TERMIN, nie o miejsce: data i godzina to dwa dotknięcia
// i jedyne rzeczy, które organizator ma w głowie, otwierając kreator. Wybór
// lokalizacji — mapa, szukanie, katalog — jest najdroższą interakcją w całym
// kreatorze i stał dotąd na samym wejściu, przed jakimkolwiek rozpędem.
const STEP_TITLES = ['Kiedy', 'Gdzie', 'Dla kogo'] as const;

// Który krok pokazać, gdy walidacja na submit znajdzie błąd w polu spoza
// bieżącego kroku (np. brak lokalizacji albo zły numer BLIK, gdy organizator
// stoi już na kroku 3). Bez tego steppera scrollIntoView nie miał do czego
// skoczyć — błąd renderował się tylko wewnątrz aktywnego kroku.
//
// Mapa NIE nadążyła za zamianą kroków (termin przed lokalizacją) — wskazywała
// krok 1 dla lokalizacji i krok 2 dla daty, czyli dokładnie odwrotnie, więc
// stepper skakał na ekran BEZ podświetlonego pola. Dziś: termin, koszt
// i bramkarze to krok 1, lokalizacja krok 2.
const STEP_OF_FIELD: Record<string, number> = {
  date: 1, blikPhone: 1, cardDiscount: 1, goalkeepers: 1, location: 2,
};
function stepForErrors(errs: Record<string, string>): number {
  return Math.min(3, ...Object.keys(errs).map((k) => STEP_OF_FIELD[k] ?? 3));
}

/** Tomorrow as YYYY-MM-DD — the default match date; "today" usually means a rush. */
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const SPORTS = FOCUS_SPORTS;

const EMPTY_LOCATION: LocationResult = { venue: null, lat: null, lng: null, address: '' };

function NewEventForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, updateDisplayName } = useAuth();

  const [step, setStep] = useState(1);

  const [sport, setSport] = useState('piłka nożna');
  const [location, setLocation] = useState<LocationResult>(EMPTY_LOCATION);
  // Wybrane boisko odpadło, bo nie obsługuje nowo wybranego sportu — komunikat
  // znika, gdy organizator wskaże miejsce ponownie.
  const [sportZmienilMiejsce, setSportZmienilMiejsce] = useState(false);
  // Nazwa dla pinezki spoza katalogu. Bez niej mecz brał za nazwę pierwszy
  // segment adresu z Nominatim, a gdy reverse geocoding padł — same
  // współrzędne, czyli mecz „52.40123".
  const [nazwaWlasnaMiejsca, setNazwaWlasnaMiejsca] = useState('');

  const [date, setDate] = useState(tomorrowStr);
  const [time, setTime] = useState('18:00');
  // Match length instead of a free end-time picker — one obvious control,
  // the end time is derived from it.
  const [durationMin, setDurationMin] = useState(90);
  const [czasWlasny, setCzasWlasny] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(14);  // domyślny sport to piłka nożna
  const [maxPlayersTouched, setMaxPlayersTouched] = useState(false);
  // Próg „gra się odbędzie" (migracja 097). `null` = organizator go nie
  // ustawił — bez tego pola panel „Czy gramy?” nigdy się nie renderuje.
  const [minPlayers, setMinPlayers] = useState<number | null>(null);
  // `null`, nie `true`: patrz komentarz przy `validateGoalkeepers()`. Włączone
  // domyślnie rozbijało pulę miejsc na role bez wiedzy organizatora.
  // `false`, nie `null`. Stan „jeszcze nie zdecydowano” istniał, bo dawniej
  // rozróżnianie bramkarzy było domyślnie WŁĄCZONE po cichu — i organizator,
  // który tego nie zauważył, dostawał mecz z pulą rozbitą na role. Dziś to
  // widoczny przełącznik, domyślnie wyłączony, więc wyłączenie JEST decyzją
  // i nie ma czego wymuszać osobnym błędem.
  const [goalkeepersEnabled, setGoalkeepersEnabled] = useState<boolean | null>(false);
  const [reserveClaimMinutes, setReserveClaimMinutes] = useState(180);
  // DOMYŚLNIE WYŁĄCZONA — świadoma zmiana zachowania dla NOWYCH meczów.
  // Dotąd każdy mecz prowadził rezerwę, bo nie było jak jej nie prowadzić.
  // Mecz na zamkniętą ekipę albo halę opłaconą z góry rezerwy nie potrzebuje,
  // a „zapisałem się na listę" wymagało od organizatora tłumaczenia. Istniejące
  // mecze zachowują rezerwę (`reserve_enabled` DEFAULT true w migracji `123`).
  const [reserveEnabled, setReserveEnabled] = useState(false);
  // Tryb miejsc dla bramkarzy (migracja `077`). Wartość ma znaczenie tylko
  // wtedy, gdy `goalkeepersEnabled` jest włączone.
  const [slotyZarezerwowane, setSlotyZarezerwowane] = useState(true);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringNotifyDaysBefore, setRecurringNotifyDaysBefore] = useState(3);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [requireApproval, setRequireApproval] = useState(false);
  const [organizerParticipates, setOrganizerParticipates] = useState(true);
  const [organizerRole, setOrganizerRole] = useState<'field' | 'gk'>('field');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Szkic — patrz efekty niżej (po ?group=/?fieldId=). `hydrated` jest stanem,
  // nie refem: dzięki temu odtworzenie i przełączenie na "gotowe do zapisu"
  // trafiają do tego samego renderu (React batchuje setState w efekcie), więc
  // efekt zapisujący nie zdąży nadpisać świeżo wczytanego szkicu domyślnymi
  // wartościami z pierwszego, jeszcze nieodtworzonego renderu.
  const [hydrated, setHydrated] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Efekt zapisujący szkic (patrz niżej) odpala się też przy pierwszym
  // renderze po hydratacji — bez tego guarda zapisywał czyste wartości
  // domyślne, zanim użytkownik cokolwiek zmienił, i kolejne wejście na tę
  // stronę pokazywało baner "Wróciliśmy do Twojego szkicu" mimo braku
  // realnej edycji.
  const isFirstSave = useRef(true);

  const [costPln, setCostPln] = useState('');

  // „Mecz płatny" nie jest osobnym polem w bazie — koszt większy od zera JEST

  // tą informacją. Stan przełącznika trzymamy jednak osobno, bo między

  // włączeniem a wpisaniem kwoty jest moment, w którym pole stoi puste,

  // a sekcja ma już być otwarta. Odtworzenie szkicu czyta z kwoty.

  const [platny, setPlatny] = useState(false);

  // Okno „tak zobaczą to gracze" przed publikacją. Mecz jest widoczny
  // natychmiast po utworzeniu i od razu idzie linkiem do ekipy — a formularz
  // pokazuje POLA, nie WYNIK. Ostatni ekran pokazuje wynik.
  const [podgladOtwarty, setPodgladOtwarty] = useState(false);
  // Tryb wpisywania kosztu. W bazie i tak ląduje kwota od osoby — to tylko
  // wybór, którą liczbę organizator ma pod ręką. Domyślnie "za obiekt", bo
  // organizator zwykle najpierw zna cenę wynajmu, nie cenę per os.
  const [kosztZaObiekt, setKosztZaObiekt] = useState(true);
  const [kosztObiektuPln, setKosztObiektuPln] = useState('');
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<PaymentMethod[]>([]);
  const [blikPhone, setBlikPhone] = useState('');
  const [cardDiscountEnabled, setCardDiscountEnabled] = useState(false);
  const [cardDiscountPln, setCardDiscountPln] = useState('');
  const [acceptedSportsCards, setAcceptedSportsCards] = useState<SportsCardProvider[]>([]);
  const [sportsCardOtherName, setSportsCardOtherName] = useState('');
  // Opis jest za przełącznikiem (domyślnie wyłączony) — pole tekstowe samo
  // w sobie sugerowało, że trzeba je wypełnić.
  const [descriptionEnabled, setDescriptionEnabled] = useState(false);

  // Cena od osoby jest pochodną kosztu obiektu i liczby miejsc. Licząc to
  // tylko w onChange inputu (jak poprzednio) cena zostawała nieaktualna, gdy
  // organizator poprawił skład PO wpisaniu kwoty — a to teraz domyślna
  // ścieżka wpisywania (kosztZaObiekt = true).
  useEffect(() => {
    if (!kosztZaObiekt) return;
    const calosc = parseFloat(kosztObiektuPln || '0');
    setCostPln(calosc > 0 && maxPlayers > 0
      ? (Math.round((calosc / maxPlayers) * 100) / 100).toFixed(2)
      : '');
  }, [kosztZaObiekt, kosztObiektuPln, maxPlayers]);

  // Płatny mecz bez ANI JEDNEJ metody płatności przechodził walidację:
  // `validatePayments` sprawdza tylko numer BLIK i wysokość zniżki, a chipsy
  // startują puste. Gracz widział cenę i nie wiedział, jak ją uregulować.
  // Gotówka jest sensownym domyślnym wyborem — i jednorazowym: `useRef`
  // pilnuje, żeby świadome odznaczenie wszystkiego nie zostało nadpisane.
  const domyslnaMetodaUstawiona = useRef(false);
  useEffect(() => {
    if (domyslnaMetodaUstawiona.current) return;
    if (!(parseFloat(costPln || '0') > 0)) return;
    domyslnaMetodaUstawiona.current = true;
    setAcceptedPaymentMethods((cur) => (cur.length ? cur : ['gotowka']));
  }, [costPln]);

  // Attach the new event to a group when arriving via ?group=
  const groupId = searchParams.get('group') || undefined;
  const preFieldId = searchParams.get('fieldId');
  // Preselect sport when arriving from /[sport]/[miasto] via ?sport=<slug>.
  const preSport = searchParams.get('sport');
  const [groupName, setGroupName] = useState<string | null>(null);
  const [groupMemberCount, setGroupMemberCount] = useState<number | undefined>(undefined);
  // Ekipa meczu — wejście `?group=` tylko ją preselekcjonuje; od kroku 3 da się
  // ją wybrać albo zdjąć ręcznie, więc to musi być stan, nie sam parametr URL.
  const [grupaId, setGrupaId] = useState<string | undefined>(groupId);
  const [wyborGrupyOtwarty, setWyborGrupyOtwarty] = useState(false);
  useEffect(() => {
    if (!groupId) return;
    import('@/lib/groups').then(({ getGroup }) =>
      getGroup(groupId).then((g) => {
        if (!g) return;
        setGroupName(g.name);
        setGroupMemberCount(g.memberCount);
        if (g.sport) setSport(g.sport);
        // Prefill the group's home venue (unless a field was passed explicitly).
        if (g.fieldId && !preFieldId) {
          getField(g.fieldId)
            .then((f) => setLocation((cur) => cur.venue || cur.lat !== null ? cur : { venue: f, lat: f.lat, lng: f.lng, address: f.address }))
            .catch(() => {});
        }
      }).catch(() => {}),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Pre-select field from URL ?fieldId=
  useEffect(() => {
    if (!preFieldId || location.venue) return;
    getField(preFieldId)
      .then((f) => setLocation({ venue: f, lat: f.lat, lng: f.lng, address: f.address }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preFieldId]);

  // Preselect sport from URL ?sport=<slug> (arriving from /[sport]/[miasto]).
  // `selectSport` is defined further down in this component but the effect
  // callback only runs after render commits, once the closure is populated.
  useEffect(() => {
    if (!preSport) return;
    const db = FOCUS_SPORT_BY_SLUG[preSport];
    if (db) selectSport(db);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSport]);

  // Nazwa ekipy dla wyboru, który nie przyszedł z `?group=` — czyli po
  // odtworzeniu szkicu albo po wskazaniu ekipy w dialogu, gdy strona zdążyła
  // się przeładować. Bez tego wiersz w kroku 3 pokazywałby sam placeholder.
  useEffect(() => {
    if (!grupaId || groupName) return;
    import('@/lib/groups').then(({ getGroup }) =>
      getGroup(grupaId).then((g) => { if (g) { setGroupName(g.name); setGroupMemberCount(g.memberCount); } }).catch(() => {}),
    );
  }, [grupaId, groupName]);

  // Ostatnio użyte boisko — PROPOZYCJA, nie autowybór. Miejsce meczu wstawione
  // po cichu to najgorsza pomyłka do przeoczenia, więc kosztuje jedno
  // dotknięcie. Nie pokazujemy przy wejściu z `?group=`/`?fieldId=` — te mają
  // własny prefill i konkurowałyby o to samo pole.
  const [propozycjaBoiska, setPropozycjaBoiska] = useState<OstatnieBoisko | null>(null);
  useEffect(() => {
    if (groupId || preFieldId) return;
    setPropozycjaBoiska(wczytajOstatnieBoisko());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uzyjPropozycji = () => {
    if (!propozycjaBoiska) return;
    // Dociągamy pełny wiersz boiska, żeby karta pod mapą miała komplet danych
    // (tak samo jak prefill z `?fieldId=`). Gdy się nie uda, zostają
    // współrzędne i adres — mecz nadal da się utworzyć.
    getField(propozycjaBoiska.id)
      .then((f) => setLocation({ venue: f, lat: f.lat, lng: f.lng, address: f.address }))
      .catch(() => setLocation({
        venue: null,
        lat: propozycjaBoiska.lat,
        lng: propozycjaBoiska.lng,
        address: propozycjaBoiska.address,
      }));
    setPropozycjaBoiska(null);
  };

  // Odtwarzanie szkicu — raz, przy montowaniu. Pomijamy całkowicie przy
  // wejściu z ?group= albo ?fieldId=: te parametry mają własne efekty prefill
  // wyżej, a kolizja dwóch źródeł prawdy o lokalizacji byłaby nie do
  // przewidzenia. Wejście z linku obiektu/grupy to świadomy start od nowa.
  useEffect(() => {
    if (!groupId && !preFieldId) {
      const draft = loadEventDraft();
      if (draft) {
        const v = draft.values;
        setSport(v.sport);
        setLocation(v.location);
        setNazwaWlasnaMiejsca(v.nazwaWlasnaMiejsca ?? '');
        // Szkic sprzed 11h nie może wracać z datą, która blokuje krok 2.
        setDate(isPast(v.date, v.time) ? tomorrowStr() : v.date);
        setTime(v.time);
        setDurationMin(v.durationMin);
        setCzasWlasny(v.czasWlasny);
        setMaxPlayers(v.maxPlayers);
        setMaxPlayersTouched(v.maxPlayersTouched);
        setMinPlayers(v.minPlayers ?? null);
        setGoalkeepersEnabled(v.goalkeepersEnabled);
        setSlotyZarezerwowane(v.slotyZarezerwowane ?? true);
        setReserveClaimMinutes(v.reserveClaimMinutes);
        setReserveEnabled(v.reserveEnabled ?? false);
        setTitle(v.title);
        setDescription(v.description);
        setDescriptionEnabled(v.descriptionEnabled);
        setVisibility(v.visibility);
        setRequireApproval(v.requireApproval);
        setOrganizerParticipates(v.organizerParticipates);
        setOrganizerRole(v.organizerRole);
        setCostPln(v.costPln);
        // Przełącznik „Mecz płatny” wynika z zapisanej kwoty — nie ma własnego
        // pola w szkicu, więc nie może się z nią rozjechać.
        setPlatny(parseFloat(v.costPln || '0') > 0);
        setKosztZaObiekt(v.kosztZaObiekt);
        setKosztObiektuPln(v.kosztObiektuPln);
        setAcceptedPaymentMethods(v.acceptedPaymentMethods);
        // Szkic płatnego meczu niesie już decyzję organizatora o metodach —
        // także tę, żeby nie wybrać żadnej. Domyślna „Gotówka" nie ma prawa
        // jej nadpisać po odtworzeniu.
        if (parseFloat(v.costPln || '0') > 0) domyslnaMetodaUstawiona.current = true;
        setBlikPhone(v.blikPhone);
        setCardDiscountEnabled(v.cardDiscountEnabled);
        setCardDiscountPln(v.cardDiscountPln);
        setAcceptedSportsCards(v.acceptedSportsCards);
        setSportsCardOtherName(v.sportsCardOtherName);
        // Nazwę ekipy dociąga efekt po `grupaId` — w szkicu trzymamy samo id,
        // żeby nie zapisywać danych, które mogły się w międzyczasie zmienić.
        setGrupaId(v.grupaId);
        setStep(draft.step);
        setDraftRestoredAt(draft.ts);
      }
    }
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zapis szkicu — dopiero PO próbie odtworzenia (inaczej domyślny stan
  // początkowy nadpisałby zapisany szkic w pierwszym renderze) i nigdy
  // w trakcie wysyłania formularza.
  useEffect(() => {
    if (!hydrated || submitting) return;
    if (isFirstSave.current) { isFirstSave.current = false; return; }
    saveEventDraft(step, {
      sport, location, nazwaWlasnaMiejsca,
      date, time, durationMin, czasWlasny, maxPlayers, maxPlayersTouched, minPlayers,
      goalkeepersEnabled, slotyZarezerwowane, reserveClaimMinutes, reserveEnabled, title, description, descriptionEnabled, visibility,
      requireApproval, organizerParticipates, organizerRole, costPln, kosztZaObiekt, kosztObiektuPln,
      acceptedPaymentMethods, blikPhone, cardDiscountEnabled, cardDiscountPln, acceptedSportsCards,
      sportsCardOtherName, grupaId,
    });
  }, [
    hydrated, submitting, step, sport, location, nazwaWlasnaMiejsca,
    date, time, durationMin, czasWlasny, maxPlayers,
    maxPlayersTouched, minPlayers, goalkeepersEnabled, slotyZarezerwowane, reserveClaimMinutes, reserveEnabled, title, description, descriptionEnabled,
    visibility, requireApproval, organizerParticipates, organizerRole, costPln, kosztZaObiekt,
    kosztObiektuPln, acceptedPaymentMethods, blikPhone, cardDiscountEnabled, cardDiscountPln,
    acceptedSportsCards, sportsCardOtherName, grupaId,
  ]);

  /** "Zacznij od nowa" — czyści szkic i wraca formularz do stanu początkowego. */
  const resetWizard = () => {
    clearEventDraft();
    setStep(1);
    setSport('piłka nożna');
    setLocation(EMPTY_LOCATION);
    setNazwaWlasnaMiejsca('');
    setSportZmienilMiejsce(false);
    setDate(tomorrowStr());
    setTime('18:00');
    setDurationMin(90);
    setCzasWlasny(false);
    setMaxPlayers(14);
    setMaxPlayersTouched(false);
    setMinPlayers(null);
    setGoalkeepersEnabled(null);
    setSlotyZarezerwowane(true);
    setReserveClaimMinutes(180);
    setRecurringEnabled(false);
    setRecurringNotifyDaysBefore(3);
    setTitle('');
    setDescription('');
    setDescriptionEnabled(false);
    setVisibility('public');
    setRequireApproval(false);
    setOrganizerParticipates(true);
    setOrganizerRole('field');
    setCostPln('');
    setKosztZaObiekt(true);
    setKosztObiektuPln('');
    setAcceptedPaymentMethods([]);
    setBlikPhone('');
    setCardDiscountEnabled(false);
    setCardDiscountPln('');
    setAcceptedSportsCards([]);
    setSportsCardOtherName('');
    // Regresja O-12: bez resetu tego refa płatny mecz po „Zacznij od nowa"
    // przestawał auto-wybierać „Gotówka" jako domyślną metodę płatności.
    domyslnaMetodaUstawiona.current = false;
    // Wejście z `?group=` zostaje — „Zacznij od nowa" czyści szkic, a nie
    // kontekst, z którego organizator tu przyszedł.
    setGrupaId(groupId);
    if (!groupId) setGroupName(null);
    setFieldErrors({});
    setError(null);
    setDraftRestoredAt(null);
  };

  if (!loading && !user) {
    // Cel powrotu liczymy w handlerze, nie w renderze: musi zawierać ZAPYTANIE
    // (`?fieldId=`, `?group=`), a nie samą ścieżkę. Bez tego wejście „Zorganizuj
    // tu mecz" ze strony boiska i „Stwórz mecz w grupie" wracały po zalogowaniu
    // na goły /wydarzenia/nowe — bez boiska i bez grupy, czyli do formularza,
    // który wyglądał jak zaczęty od zera.
    const przejdzDoLogowania = () => {
      const cel = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/logowanie?next=${encodeURIComponent(cel)}`;
    };
    return (
      <div className="min-h-screen flex flex-col bg-canvas">
        <Header showMobileWordmark />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            Zorganizuj mecz
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Wybierz boisko, ustaw termin i wrzuć link na grupę.
          </p>

          <ul className="mt-5 grid gap-2 text-sm text-slate-700">
            <li className="flex items-start gap-2"><span aria-hidden="true">✓</span> Lista zapisów aktualizuje się na żywo</li>
            <li className="flex items-start gap-2"><span aria-hidden="true">✓</span> Skład, rezerwa i podział kosztów liczą się same</li>
            <li className="flex items-start gap-2"><span aria-hidden="true">✓</span> Otwórz mecz publicznie, a zobaczą go gracze z okolicy</li>
          </ul>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                <Lock className="w-4 h-4 text-primary-700" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-ink">Zaloguj się, żeby opublikować mecz</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Google, e-mail albo link bez hasła.
                </p>
              </div>
            </div>
            <Button
              size="lg"
              className="w-full mt-4"
              onClick={przejdzDoLogowania}
            >
              Zaloguj się i kontynuuj
            </Button>
          </div>

          {/* Preview kreatora — prawdziwe etykiety i emoji sportów zamiast
              generycznych szarych belek, żeby faktycznie było widać, co jest
              pod blurem. */}
          <div className="relative mt-8 rounded-2xl border border-slate-200 bg-white overflow-hidden select-none pointer-events-none" aria-hidden="true">
            <div className="p-5 space-y-4 blur-[1.5px] opacity-90">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Sport</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FOCUS_SPORTS.map((s, i) => (
                    <div
                      key={s}
                      className={[
                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium',
                        i === 0
                          ? 'border-primary-700 bg-primary-700 text-white'
                          : 'border-slate-200 text-slate-600',
                      ].join(' ')}
                    >
                      <span>{sportEmoji(s)}</span>
                      <span>{sportLabel(s)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Lokalizacja</p>
                <div className="relative h-28 overflow-hidden rounded-xl bg-gradient-to-br from-primary-50 via-slate-50 to-primary-50">
                  <div
                    className="absolute inset-0 text-slate-400 opacity-40"
                    style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '14px 14px' }}
                  />
                  <MapPin className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary-700" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">Data meczu</div>
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">18:00</div>
              </div>

              <div className="flex h-11 items-center justify-center rounded-xl bg-primary-700 text-sm font-semibold text-white">
                Dalej →
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/40 to-white/90" />
            <p className="absolute bottom-3 inset-x-0 text-center text-xs text-slate-500 font-medium">
              ↑ tak wygląda kreator po zalogowaniu
            </p>
          </div>
        </main>
      </div>
    );
  }

  /**
   * Enter w polu tekstowym wysyła formularz — przeglądarka robi to sama, gdy
   * formularz ma przycisk `type="submit"`. Na kroku 3 są pola „Tytuł" i „Opis"
   * ORAZ „Opublikuj mecz", więc Enter po wpisaniu tytułu publikował mecz
   * natychmiast, bez pytania. Z perspektywy organizatora wyglądało to tak,
   * jakby kreator sam przeskoczył dalej.
   *
   * Blokujemy tylko pola jednoliniowe: w `<textarea>` Enter ma robić nową
   * linię, a przyciski muszą działać z klawiatury (dostępność).
   */
  const blokujEnter = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'submit') {
      e.preventDefault();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) return;
    // Druga linia obrony: publikuje wyłącznie krok 3. Gdyby jakakolwiek inna
    // droga wywołała submit, mecz nie powstanie przypadkiem.
    if (step !== 3) return;

    const errs: Record<string, string> = {
      ...validateStep1(location),
      ...validateStep2(date, time),
      ...validatePayments({ costPln, acceptedPaymentMethods, blikPhone, cardDiscountEnabled, cardDiscountPln }),
      ...validateGoalkeepers({ sportMaBramkarza: GK_SPORTS.includes(sport), goalkeepersEnabled }),
    };
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setPodgladOtwarty(false);
      setStep(stepForErrors(errs));
      // scroll to first error
      setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    const endTime = addMinutes(time, durationMin);

    // Nazwa własna wpisana przez organizatora bije pierwszy segment adresu
    // z Nominatim — ten bywa numerem domu albo (gdy reverse geocoding padł)
    // parą współrzędnych.
    const fieldName = location.venue
      ? location.venue.name
      : (nazwaWlasnaMiejsca.trim()
        || location.address.split(',')[0].trim()
        || 'Nieznana lokalizacja');
    const hasCost = parseFloat(costPln || '0') > 0;

    setSubmitting(true);
    setError(null);
    try {
      const id = await createEvent(
        {
          sport,
          fieldId: location.venue?.id,
          fieldName,
          lat: location.lat ?? undefined,
          lng: location.lng ?? undefined,
          customLocationName: location.venue ? undefined : fieldName,
          customAddress: location.venue ? undefined : location.address || undefined,
          title: title || undefined,
          description: descriptionEnabled && description.trim() ? description : undefined,
          date,
          time,
          endTime: endTime ?? undefined,
          maxPlayers,
          minPlayers: minPlayers ?? undefined,
          maxGoalkeepers: 2,
          goalkeepersEnabled: GK_SPORTS.includes(sport) ? (goalkeepersEnabled ?? false) : false,
          goalkeeperSlotsReserved: slotyZarezerwowane,
          reserveClaimMinutes,
          reserveEnabled,
          visibility,
          requireSmsConfirmation: false,
          // No "advanced" section: paid match tracks payments and shows the
          // status to players; attendance is always on. One decision fewer.
          teamMode: 'brak',
          trackPayments: hasCost,
          showPaymentStatus: hasCost,
          trackResults: true,
          confirmationDeadlineH: 24,
          costGrosze: Math.round(parseFloat(costPln || '0') * 100),
          acceptedPaymentMethods: hasCost ? acceptedPaymentMethods : [],
          blikPhone: hasCost && acceptedPaymentMethods.includes('blik') ? blikPhone : undefined,
          acceptedSportsCards: hasCost && cardDiscountEnabled ? acceptedSportsCards : [],
          sportsCardDiscountGrosze: hasCost && cardDiscountEnabled && cardDiscountPln
            ? Math.round(parseFloat(cardDiscountPln) * 100)
            : null,
          sportsCardOtherName: hasCost && cardDiscountEnabled && acceptedSportsCards.includes('inne')
            ? sportsCardOtherName
            : undefined,
          requireApproval,
          groupId: grupaId,
        },
        user.id,
        displayName(user),
        organizerParticipates,
        organizerParticipates && GK_SPORTS.includes(sport) && !!goalkeepersEnabled && organizerRole === 'gk',
      );
      // Zapis PRZED czyszczeniem szkicu — po `clearEventDraft()` nie ma już
      // czego zapamiętać. Tylko boiska z katalogu: pinezka postawiona ręcznie
      // nie ma `id`, więc nie dałoby się jej później odtworzyć.
      if (location.venue) {
        zapiszOstatnieBoisko({
          id: location.venue.id,
          name: location.venue.name,
          lat: location.venue.lat,
          lng: location.venue.lng,
          address: location.venue.address,
        });
      }

      // Szablon cykliczny to dodatek do meczu jednorazowego, nie odwrotnie —
      // gdy zawiedzie, organizator i tak dostaje działający mecz, po prostu
      // bez linku do panelu serii niżej.
      let cyklicznyId: string | null = null;
      if (recurringEnabled) {
        try {
          cyklicznyId = await createRecurringEvent(
            {
              sport,
              fieldId: location.venue?.id,
              fieldName,
              lat: location.lat ?? undefined,
              lng: location.lng ?? undefined,
              title: title || undefined,
              description: descriptionEnabled && description.trim() ? description : undefined,
              dayOfWeek: dayOfWeekFromDate(date),
              eventTime: time,
              endTime: endTime ?? undefined,
              maxPlayers,
              visibility,
              notifyDaysBefore: recurringNotifyDaysBefore,
            },
            user.id,
            displayName(user),
          );
        } catch {
          // Cichy fallback — patrz komentarz wyżej.
        }
      }

      clearEventDraft();
      // `?utworzono=1` włącza na stronie meczu panel „Mecz gotowy — wyślij link".
      // `?cykliczne=<id>` (gdy powstał szablon) dokłada tam link do panelu serii.
      // Strona sama zdejmuje te parametry z adresu zaraz po odczycie, więc nie
      // trafią do linku, który organizator za chwilę wyśle ekipie.
      router.push(`/wydarzenia/${id}?utworzono=1${cyklicznyId ? `&cykliczne=${cyklicznyId}` : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć wydarzenia');
      setPodgladOtwarty(false);
      setSubmitting(false);
    }
  };

  // Domyślny skład per sport — tyle, ile realnie schodzi na amatorskim meczu
  // w Polsce, żeby stepper był poprawką, a nie obowiązkowym krokiem.
  // Stosowane tylko dopóki organizator sam nie ruszy licznika.
  const SPORT_PLAYERS: Record<string, number> = {
    'piłka nożna': 14,          // 7v7 — format orlika
    futsal: 10,                 // 5v5
    siatkówka: 12,              // 6v6
    'siatkówka plażowa': 4,     // 2v2
    koszykówka: 10,             // 5v5
    'piłka ręczna': 14,         // 7v7
  };
  const sportDefaultPlayers = (s: string) => SPORT_PLAYERS[s] ?? 10;
  const selectSport = (s: string) => {
    setSport(s);
    if (!maxPlayersTouched) setMaxPlayers(sportDefaultPlayers(s));
    if (location.venue && !location.venue.sport.includes(s)) {
      // Kasowanie wybranego boiska po cichu wyglądało jak zgubienie danych:
      // organizator wracał na krok 1 i zastawał pustą mapę bez wyjaśnienia.
      setLocation(EMPTY_LOCATION);
      setSportZmienilMiejsce(true);
    }
  };

  const inputCls =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  /**
   * Handles both "Dalej" and clicking a step number directly. Going back is
   * always allowed without validation. Going forward validates every step
   * between the current one and the target, stopping (and showing the same
   * inline error as today) at the first one that blocks — so jumping from
   * step 1 straight to step 3 behaves exactly like clicking "Dalej" twice.
   */
  const attemptGoToStep = (target: number) => {
    if (target === step) return;

    if (target < step) {
      setFieldErrors({});
      setStep(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    for (let s = step; s < target; s++) {
      const errs = validateStep(s, {
        location, date, time, costPln, acceptedPaymentMethods, blikPhone, cardDiscountEnabled, cardDiscountPln,
        sportMaBramkarza: GK_SPORTS.includes(sport), goalkeepersEnabled,
      });
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        setStep(s);
        setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        return;
      }
    }
    setFieldErrors({});
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <HideBottomNav />
      <Header showMobileWordmark />

      {/* Step indicator — sticky under the header. Numbers are clickable:
          jumping ahead runs the same validation as "Dalej" and stops on the
          first step that blocks. */}
      {/* top-12 na mobile: Header dla zalogowanych jest tam h-12, nie h-16 —
          bez tego zostawałaby 16px szpara nad wskaźnikiem kroków. */}
      <div className="sticky top-12 z-[900] border-b border-slate-200 bg-canvas dark:border-slate-700 md:top-16">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2.5">
          {[1, 2, 3].map((n) => {
            const done = n < step;
            const current = n === step;
            return (
              <button
                key={n}
                type="button"
                onClick={() => attemptGoToStep(n)}
                aria-current={current ? 'step' : undefined}
                aria-label={`Krok ${n}: ${STEP_TITLES[n - 1]}`}
                className={clsx(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2',
                  (current || done) && 'bg-primary-700 text-white',
                  current && 'ring-4 ring-primary-100 dark:ring-primary-900',
                  !current && !done && 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400',
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
              </button>
            );
          })}
          <span className="ml-1 truncate text-sm font-medium text-slate-500 dark:text-slate-400">
            {STEP_TITLES[step - 1]}
          </span>
        </div>
      </div>

      {/* pb-0: pasek akcji jest sticky bottom-0 i sam dodaje swój padding
          (linia niżej z env(safe-area-inset-bottom)) — dawny `py-8` zostawiał
          pod nim dodatkowe 32 px pustego tła. */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-8 pb-0">
        {/* Pasek z grupą znika na kroku 3 — tam stoi pełny wybór grupy
            („Mecz w ramach grupy" z przyciskiem Zmień), więc pasek mówił
            dokładnie to samo dwa razy, jeden pod drugim. Na krokach 1–2 zostaje:
            tam nic innego o grupie nie informuje. */}
        {groupName && step < 3 && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm text-primary-800">
            <Users className="w-4 h-4 shrink-0" />
            Mecz w grupie <span className="font-semibold">{groupName}</span>
          </div>
        )}

        {draftRestoredAt && !bannerDismissed && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <p className="min-w-0 flex-1">
                Wróciliśmy do Twojego szkicu ({draftAgeLabel(draftRestoredAt)}).
              </p>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                aria-label="Zamknij"
                className="shrink-0 rounded-lg p-1 text-amber-700 hover:bg-amber-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={resetWizard}
              className="mt-2 inline-flex items-center rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              Zacznij od nowa
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={blokujEnter} className="space-y-5">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {/* Sport — one scrollable row of chips plus a compact dropdown,
                  so "Dalej" stays above the fold on a phone. */}
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-2 overflow-x-auto pb-1 -mb-1 [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {SPORTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => selectSport(s)}
                      className={[
                        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                        sport === s
                          ? 'bg-primary-700 text-white border-primary-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-primary-400',
                      ].join(' ')}
                    >
                      <span>{sportEmoji(s)}</span>
                      <span>{sportLabel(s)}</span>
                    </button>
                  ))}
                </div>
                {/* Native select disguised as a small button — opens the system
                    picker, useful when the wanted sport is scrolled out of view. */}
                <div className="relative shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                  <select
                    value={sport}
                    onChange={(e) => selectSport(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Wybierz sport"
                  >
                    {SPORTS.map((s) => (
                      <option key={s} value={s}>{sportEmoji(s)} {sportLabel(s)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date / time + Recurring tile */}
              <EventDateTimeField
                date={date}
                setDate={(v) => { setDate(v); setFieldErrors((f) => ({ ...f, date: '' })); }}
                time={time}
                setTime={setTime}
                durationMin={durationMin}
                setDurationMin={setDurationMin}
                czasWlasny={czasWlasny}
                setCzasWlasny={setCzasWlasny}
                dateError={fieldErrors.date}
                inputCls={inputCls}
                extraSlot={SHOW_RECURRING ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (recurringEnabled) { setRecurringEnabled(false); return; }
                      setRecurringModalOpen(true);
                    }}
                    className={[
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                      recurringEnabled ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400',
                    ].join(' ')}
                  >
                    <Repeat className={`h-5 w-5 shrink-0 ${recurringEnabled ? 'text-primary-700' : 'text-slate-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">Wydarzenie cykliczne</span>
                      <span className="block text-xs text-slate-500">
                        {recurringEnabled
                          ? `Co tydzień, przypomnienie ${withCount(recurringNotifyDaysBefore, 'dzień', 'dni', 'dni')} wcześniej`
                          : 'Powtarzaj ten mecz co tydzień'}
                      </span>
                    </span>
                    {recurringEnabled ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setRecurringModalOpen(true); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setRecurringModalOpen(true); } }}
                        aria-label="Edytuj ustawienia cyklicznego wydarzenia"
                        className="shrink-0 rounded-lg p-1.5 text-primary-700 hover:bg-primary-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-primary-700">Włącz</span>
                    )}
                  </button>
                ) : undefined}
              />

              {/* LICZBA MIEJSC — przy terminie, nie przy ustawieniach.
                  „Ilu nas gra" to trzecia rzecz, którą organizator ma w głowie
                  otwierając kreator, zaraz po tym co i kiedy. Trzymanie jej
                  krok dalej, wśród reguł rezerwy i metod płatności, kazało
                  przewinąć przez pytania, których większość meczów nie ma. */}
              <MiejscaWSkladzie
                maxPlayers={maxPlayers}
                onMaxPlayersChange={(v) => { setMaxPlayersTouched(true); setMaxPlayers(v); }}
                minPlayers={minPlayers}
                onMinPlayersChange={setMinPlayers}
                reserveEnabled={reserveEnabled}
              />

              {/* TRZY PRZEŁĄCZNIKI, WSZYSTKIE DOMYŚLNIE WYŁĄCZONE.
                  Krok pierwszy niósł wcześniej kilkanaście kontrolek naraz —
                  czas na decyzję z rezerwy, koszt, metody płatności, tryby
                  miejsc dla bramkarzy — z których typowy mecz nie potrzebuje
                  ani jednej. Teraz każda grupa ustawień pojawia się DOPIERO po
                  włączeniu tego, czego dotyczy, a podpis mówi, co się stanie,
                  zanim ktokolwiek włączy. */}
              <div className="space-y-3">
                <OpcjaMeczu
                  tytul="Lista rezerwowa"
                  podpis="Przy komplecie kolejni chętni czekają w kolejce i wchodzą, gdy ktoś się wypisze."
                  wlaczona={reserveEnabled}
                  naZmiane={setReserveEnabled}
                >
                  <UstawieniaRezerwy
                    reserveClaimMinutes={reserveClaimMinutes}
                    setReserveClaimMinutes={setReserveClaimMinutes}
                  />
                </OpcjaMeczu>

                <OpcjaMeczu
                  tytul="Mecz płatny"
                  podpis="Podasz koszt i sposób zapłaty — Bojo policzy, ile wychodzi od osoby."
                  wlaczona={platny}
                  naZmiane={(v) => {
                    setPlatny(v);
                    // Wyłączenie CZYŚCI kwotę, nie tylko ją chowa. Ukryta cena
                    // pojechałaby do bazy razem z meczem oznaczonym jako
                    // darmowy — a to jest dokładnie ten błąd, który wychodzi
                    // dopiero przy rozliczeniu.
                    if (!v) { setCostPln(''); setAcceptedPaymentMethods([]); }
                  }}
                >
                  <div className="space-y-4">
                    {/* Koszt. W bazie trzymamy ZAWSZE kwotę od osoby — tak liczy
                        `priceForParticipant()` i tak wygląda rozliczenie na meczu.
                        Ale organizator zna zwykle drugą liczbę: ile kosztuje wynajem
                        obiektu. Przeliczamy więc przy wpisywaniu, zamiast kazać mu
                        dzielić w głowie i zaokrąglać. */}
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="text-sm font-medium text-slate-700">
                          {kosztZaObiekt ? 'Koszt wynajmu obiektu (zł)' : 'Koszt od osoby (zł)'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setKosztZaObiekt((v) => !v)}
                          className="shrink-0 text-xs font-medium text-primary-700 underline hover:text-primary-800"
                        >
                          {kosztZaObiekt ? 'wpisz od osoby' : 'wpisz za cały obiekt'}
                        </button>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={kosztZaObiekt ? kosztObiektuPln : costPln}
                        onChange={(e) => (kosztZaObiekt ? setKosztObiektuPln(e.target.value) : setCostPln(e.target.value))}
                        placeholder="0 = za darmo"
                        className={inputCls}
                      />
                      {parseFloat(costPln || '0') > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {kosztZaObiekt
                            ? <>Przy {maxPlayers} miejscach wychodzi <span className="font-semibold">{costPln} zł od osoby</span>.</>
                            : <>Przy komplecie ({maxPlayers} os.) to <span className="font-semibold">{(parseFloat(costPln) * maxPlayers).toFixed(2)} zł</span> za cały obiekt.</>}
                        </p>
                      )}
                    </div>
                    <EventPaymentFields
                      costPln={costPln}
                      acceptedPaymentMethods={acceptedPaymentMethods}
                      setAcceptedPaymentMethods={setAcceptedPaymentMethods}
                      blikPhone={blikPhone}
                      setBlikPhone={setBlikPhone}
                      fieldErrors={fieldErrors}
                      setFieldErrors={setFieldErrors}
                      cardDiscountEnabled={cardDiscountEnabled}
                      setCardDiscountEnabled={setCardDiscountEnabled}
                      cardDiscountPln={cardDiscountPln}
                      setCardDiscountPln={setCardDiscountPln}
                      acceptedSportsCards={acceptedSportsCards}
                      setAcceptedSportsCards={setAcceptedSportsCards}
                      sportsCardOtherName={sportsCardOtherName}
                      setSportsCardOtherName={setSportsCardOtherName}
                      inputCls={inputCls}
                    />
                  </div>
                </OpcjaMeczu>

                {GK_SPORTS.includes(sport) && (
                  <OpcjaMeczu
                    tytul="Bramkarze osobno"
                    podpis="Skład rozbije się na bramkarzy i zawodników z pola."
                    wlaczona={goalkeepersEnabled === true}
                    naZmiane={(v) => setGoalkeepersEnabled(v)}
                  >
                    <UstawieniaBramkarzy
                      sport={sport}
                      maxPlayers={maxPlayers}
                      goalkeepersEnabled={goalkeepersEnabled}
                      setGoalkeepersEnabled={setGoalkeepersEnabled}
                      slotyZarezerwowane={slotyZarezerwowane}
                      setSlotyZarezerwowane={setSlotyZarezerwowane}
                      blad={fieldErrors.goalkeepers}
                    />
                  </OpcjaMeczu>
                )}
              </div>

              {/* Organizer participates */}
              <div className="py-2 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Biorę udział</p>
                    <p className="text-xs text-slate-500">Zapisz mnie jako uczestnika tej gry</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOrganizerParticipates((v) => !v)}
                    className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', organizerParticipates ? 'bg-primary-600' : 'bg-slate-200'].join(' ')}
                    role="switch"
                    aria-checked={organizerParticipates}
                  >
                    <span className={['pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', organizerParticipates ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
                  </button>
                </div>
                {organizerParticipates && GK_SPORTS.includes(sport) && goalkeepersEnabled && (
                  <div className="mt-2 flex gap-2">
                    {([['field', 'Zawodnik z pola'], ['gk', '🧤 Bramkarz']] as const).map(([role, label]) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setOrganizerRole(role)}
                        className={[
                          'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                          organizerRole === role
                            ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <>
              {/* Unified location picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lokalizacja
                </label>
                {fieldErrors.location && (
                  <p data-field-error className="mb-2 text-xs font-medium text-red-600 flex items-center gap-1">
                    <span aria-hidden>⚠</span> {fieldErrors.location}
                  </p>
                )}
                {sportZmienilMiejsce && (
                  <p className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    Poprzednie boisko nie obsługuje sportu {sportLabel(sport)} — wybierz miejsce ponownie.
                  </p>
                )}
                <p className="text-xs text-slate-500 mb-2">
                  Kliknij boisko na mapie, wyszukaj adres lub kliknij dowolne miejsce.
                </p>

                {/* Ostatnio używane boisko — jedno dotknięcie zamiast szukania
                    po mapie. Znika, gdy miejsce jest już wybrane. */}
                {propozycjaBoiska && !location.venue && location.lat === null && (
                  <button
                    type="button"
                    onClick={uzyjPropozycji}
                    className="mb-2 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm transition-colors hover:border-primary-300 hover:bg-primary-50"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-slate-600">
                      Ostatnio: <span className="font-medium text-ink">{propozycjaBoiska.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-primary-700">Użyj</span>
                  </button>
                )}

                <div className="h-64 sm:h-80 rounded-xl overflow-hidden border border-slate-200">
                  <UnifiedLocationPicker
                    sport={sport}
                    value={location}
                    onChange={(v) => {
                      setLocation(v);
                      setFieldErrors((f) => ({ ...f, location: '' }));
                      setSportZmienilMiejsce(false);
                    }}
                  />
                </div>

                {/* Selected location summary */}
                {location.venue && (
                  <div className="mt-2 flex gap-3 items-center bg-slate-50 rounded-lg p-2">
                    {venueThumbnail(location.venue.lat, location.venue.lng, 160, 100) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={venueThumbnail(location.venue.lat, location.venue.lng, 160, 100)!}
                        alt={location.venue.name}
                        className="w-20 h-14 object-cover rounded-md shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{location.venue.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> {location.venue.address}
                      </p>
                      {location.venue.surface && (
                        <p className="text-xs text-slate-400">{surfaceLabel(location.venue.surface)}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocation(EMPTY_LOCATION)}
                      className="ml-auto text-slate-300 hover:text-slate-500"
                      aria-label="Wyczyść lokalizację"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {!location.venue && location.lat !== null && (
                  <>
                    <p className="mt-2 text-xs text-green-700 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {location.address || `${location.lat?.toFixed(5)}, ${location.lng?.toFixed(5)}`}
                      <button
                        type="button"
                        onClick={() => setLocation(EMPTY_LOCATION)}
                        className="ml-1 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </p>
                    {/* Pinezka spoza katalogu nie ma nazwy własnej: mecz brał
                        pierwszy segment adresu z Nominatim, a gdy reverse
                        geocoding padł — same współrzędne. Pole pokazuje się
                        wyłącznie na tej ścieżce i jest opcjonalne. */}
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Nazwa miejsca <span className="font-normal text-slate-400">(opcjonalnie)</span>
                      </label>
                      <input
                        type="text"
                        value={nazwaWlasnaMiejsca}
                        onChange={(e) => setNazwaWlasnaMiejsca(e.target.value)}
                        placeholder="np. Boisko przy szkole"
                        maxLength={100}
                        className={inputCls}
                      />
                    </div>
                  </>
                )}
              </div>

            </>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <>
              {/* Visibility — public / private */}
              <EventVisibilityFields
                visibility={visibility}
                setVisibility={setVisibility}
                requireApproval={requireApproval}
                setRequireApproval={setRequireApproval}
                grupaNazwa={groupName ?? undefined}
                liczbaCzlonkowGrupy={groupMemberCount}
              />

              {/* Grupa — osobny wiersz, NIE trzecia karta widoczności:
                  przypisanie do grupy jest ortogonalne do public/private
                  (mecz grupy bywa publiczny). Wejście `?group=` ustawia to
                  samo pole, więc oba źródła się nie biją. */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Mecz w ramach grupy <span className="font-normal text-slate-400">— opcjonalnie</span>
                </label>
                {grupaId ? (
                  <div className="flex items-center gap-2 rounded-xl border border-primary-500 bg-primary-50 px-3 py-2.5">
                    <Users className="h-4 w-4 shrink-0 text-primary-700" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {groupName ?? 'Wybrana grupa'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWyborGrupyOtwarty(true)}
                      className="shrink-0 text-xs font-semibold text-primary-700 hover:text-primary-800"
                    >
                      Zmień
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGrupaId(undefined); setGroupName(null); }}
                      className="shrink-0 text-slate-400 hover:text-slate-600"
                      aria-label="Nie przypisuj do grupy"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setWyborGrupyOtwarty(true)}
                    className="flex w-full items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-left text-sm transition-colors hover:border-slate-400"
                  >
                    <Users className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="flex-1 text-slate-500">Wybierz grupę</span>
                    <span className="shrink-0 text-slate-400" aria-hidden="true">›</span>
                  </button>
                )}
                <p className="mt-1.5 text-xs text-slate-500">
                  Mecz trafi do historii grupy i zobaczą go wszyscy jej członkowie.
                </p>
              </div>

              {/* Title + description */}
              <EventTitleDescriptionField
                title={title}
                setTitle={setTitle}
                placeholderTitle={defaultEventTitle(sport, maxPlayers)}
                description={description}
                setDescription={setDescription}
                descriptionEnabled={descriptionEnabled}
                setDescriptionEnabled={setDescriptionEnabled}
                inputCls={inputCls}
              />

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

            </>
          )}

          {/* Sticky action bar — replaces the old two-line, per-step button
              pairs. "Wróć" (left) never validates; "Dalej"/"Opublikuj" (right,
              flex-1) run the same attemptGoToStep validation as clicking a
              step number. */}
          <div
            className="sticky bottom-0 z-30 -mx-4 mt-2 border-t border-slate-200 bg-canvas px-4 pt-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] dark:border-slate-700"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-3">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="shrink-0"
                  onClick={() => attemptGoToStep(step - 1)}
                >
                  ← Wróć
                </Button>
              )}
              {/* Oba przyciski mają `type="button"` i WŁASNY `key`.
                  Powód, dla którego to nie jest kosmetyka:

                  Kliknięcie to zdarzenie dyskretne, więc React renderuje
                  synchronicznie JESZCZE PRZED wykonaniem przez przeglądarkę
                  domyślnej akcji kliknięcia. Gdy oba przyciski stały w tym
                  samym miejscu drzewa, React nie tworzył nowego elementu —
                  podmieniał atrybuty istniejącego, w tym `type` z `button`
                  na `submit`. Przeglądarka wykonywała potem domyślną akcję
                  na tym samym węźle, który w międzyczasie stał się przyciskiem
                  zatwierdzającym, i wysyłała formularz. Efekt: „Dalej" z kroku 2
                  pokazywało krok 3 i natychmiast publikowało mecz.

                  Osobne `key` zmusza React do wymiany węzła, a `type="button"`
                  odbiera przeglądarce powód, żeby cokolwiek wysyłać. Mecz
                  powstaje wyłącznie przez jawne wywołanie `handleSubmit`. */}
              {step < 3 ? (
                <Button key="dalej" type="button" size="lg" className="flex-1" onClick={() => attemptGoToStep(step + 1)}>
                  Dalej →
                </Button>
              ) : (
                <Button
                  key="opublikuj"
                  type="button"
                  size="lg"
                  isLoading={submitting}
                  className="flex-1"
                  onClick={() => setPodgladOtwarty(true)}
                >
                  Opublikuj mecz →
                </Button>
              )}
            </div>
          </div>

        </form>

        {/* PODGLĄD PRZED PUBLIKACJĄ — „tak zobaczą to gracze".
            Mecz jest widoczny natychmiast po utworzeniu i od razu idzie linkiem
            do ekipy, więc pomyłka w godzinie albo w widoczności rozchodzi się
            szybciej, niż da się ją poprawić. Formularz pokazuje POLA; ten ekran
            pokazuje WYNIK — to samo podsumowanie, ale w roli ostatniego
            sprawdzenia, nie kolejnej sekcji do przewinięcia.

            Poza <form>: każdy `<button>` wewnątrz formularza bez `type` jest
            przyciskiem wysyłającym, a to jest ta sama pułapka, która kiedyś
            publikowała mecz Enterem po wpisaniu tytułu. */}
        {podgladOtwarty && (
          <div
            className={`fixed inset-0 flex items-end justify-center bg-black/50 sm:items-center ${WARSTWA.modal} p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}
            role="dialog"
            aria-modal="true"
            aria-label="Tak zobaczą mecz gracze"
          >
            <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800">
              <h2 className="font-display text-lg font-bold text-ink">Tak zobaczą to gracze</h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Sprawdź termin i widoczność — po opublikowaniu mecz od razu jest widoczny.
              </p>

              <div className="mt-4">
                <PodsumowanieMeczu
                  wiersze={zbudujPodsumowanie({
                    sport,
                    title,
                    miejsceNazwa: location.venue?.name ?? (nazwaWlasnaMiejsca.trim() || null),
                    miejsceAdres: location.venue?.address ?? location.address ?? null,
                    date,
                    time,
                    durationMin,
                    maxPlayers,
                    minPlayers,
                    goalkeepersEnabled: GK_SPORTS.includes(sport) && !!goalkeepersEnabled,
                    maxGoalkeepers: 2,
                    organizerParticipates,
                    costPln,
                    acceptedPaymentMethods,
                    cardDiscountEnabled,
                    cardDiscountPln,
                    acceptedSportsCards,
                    visibility,
                    requireApproval,
                  })}
                  naKrok={(krok) => { setPodgladOtwarty(false); attemptGoToStep(krok); }}
                  nazwaOrganizatora={displayName(user)}
                  brakujeNazwy={!isPelneImie(displayName(user))}
                  onZmienNazwe={updateDisplayName}
                />
              </div>

              <div className="mt-5 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPodgladOtwarty(false)}
                >
                  Popraw
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  isLoading={submitting}
                  onClick={() => handleSubmit()}
                >
                  Publikuję
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Poza <form>: dialog ma własne przyciski, a każdy `<button>` wewnątrz
          formularza to kolejna okazja do przypadkowej publikacji meczu
          (patrz komentarz przy „Dalej"/„Opublikuj"). */}
      {wyborGrupyOtwarty && user && (
        <WybierzGrupeDialog
          userId={user.id}
          wybranaId={grupaId}
          onClose={() => setWyborGrupyOtwarty(false)}
          onWybierz={(g: Group | null) => {
            setGrupaId(g?.id);
            setGroupName(g?.name ?? null);
            setGroupMemberCount(g?.memberCount);
            setWyborGrupyOtwarty(false);
          }}
        />
      )}
      {recurringModalOpen && (
        <RecurringSettingsDialog
          dayOfWeekLabel={date ? dayOfWeekLabelFromDate(date) : null}
          notifyDaysBefore={recurringNotifyDaysBefore}
          onSave={(n) => { setRecurringNotifyDaysBefore(n); setRecurringEnabled(true); setRecurringModalOpen(false); }}
          onClose={() => setRecurringModalOpen(false)}
        />
      )}
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense>
      <NewEventForm />
    </Suspense>
  );
}
