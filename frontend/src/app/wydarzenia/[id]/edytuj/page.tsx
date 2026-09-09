'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Lock, ArrowLeft, MapPin, ChevronDown, ChevronUp, X } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import ToggleRow from '@/components/ui/ToggleRow';
import UnifiedLocationPicker from '@/components/map/UnifiedLocationPicker';
import type { LocationResult } from '@/components/map/UnifiedLocationPicker';
import EventDateTimeField, { addMinutes } from '@/components/events/EventDateTimeField';
import EventCapacityFields from '@/components/events/EventCapacityFields';
import EventTitleDescriptionField from '@/components/events/EventTitleDescriptionField';
import EventVisibilityFields from '@/components/events/EventVisibilityFields';
import EventPaymentFields from '@/components/events/EventPaymentFields';
import RemindersSection from '@/components/events/RemindersSection';
import { SHOW_SMS_FEATURES } from '@/lib/features';
import { useAuth, displayName } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { getEvent, updateEvent } from '@/lib/events';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import {
  policzZmiany, komuDojdzie, konsekwencjeZapisu, czyPowiadamia,
  type DaneDoPorownania,
} from '@/lib/zmianyMeczu';
import { eventUrl, udostepnijZmiane } from '@/lib/eventShare';
import { getMyDelegatePermissions } from '@/lib/eventDelegates';
import {
  getSeriesEvents, updateSeriesEvents, updateSeriesTemplate,
  terminyWZakresie, patchDlaPozostalych, type ZakresEdycji,
} from '@/lib/series';
import ZakresEdycjiSerii from '@/components/events/ZakresEdycjiSerii';
import { getField } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import { defaultEventTitle } from '@/lib/eventTitle';
import { validatePayments } from '@/lib/eventWizard';
import { nazwaZAdresu } from '@/lib/utils';
import { FOCUS_SPORTS, sportLabel, sportEmoji, GK_SPORTS } from '@/lib/sports';
import type { Visibility, TeamMode, PaymentMethod, SportsCardProvider, EventCreate, EventItem, EventParticipant } from '@/types';

const SPORTS = FOCUS_SPORTS;
const EMPTY_LOCATION: LocationResult = { venue: null, lat: null, lng: null, address: '' };

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useAdmin();

  const [pageLoading, setPageLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

  // Okna potwierdzeń zamiast systemowego `confirm()` — ten sam hak, co na
  // stronie meczu. Renderuje się na samym końcu komponentu.
  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();

  // STAN WYJŚCIOWY, do policzenia różnicy przy zapisie. Oba pola pochodzą
  // z TEGO SAMEGO `getEvent(id)`, które strona i tak woła — zero dodatkowych
  // zapytań. `mecz` trzymamy w całości, bo wiadomość na czat („Zmiana: …")
  // potrzebuje nazwy, sportu i godzin, nie tylko porównywanych pól.
  const [mecz, setMecz] = useState<EventItem | null>(null);
  const [uczestnicy, setUczestnicy] = useState<EventParticipant[]>([]);

  /**
   * PAYLOAD SPRZED EDYCJI, w całości — do odpowiedzi na jedno pytanie:
   * „czy cokolwiek się zmieniło".
   *
   * DLACZEGO NIE WYSTARCZA `policzZmiany()`. Ta liczy różnicę na CZTERNASTU
   * polach, które da się pokazać człowiekowi („Termin: … → …"), a payload ma
   * ich koło trzydziestu: czas gry, próg minimum, tryb miejsc dla bramkarzy,
   * czas na decyzję z rezerwy, numer BLIK, zniżki kartowe, tryb drużyn…
   * Gdyby to ona decydowała o pominięciu zapisu, zmiana samego czasu gry
   * z 90 na 120 minut kończyłaby się cichym „nic się nie zmieniło" i NIE
   * ZAPISAŁABY SIĘ — czyli poprawka byłaby gorsza od problemu, który naprawia.
   *
   * Migawkę bierzemy dopiero po `pageLoading === false`, bo lokalizacja
   * dociąga się osobnym `await getField()` na końcu wczytywania — wcześniej
   * payload miałby jeszcze pustą nazwę miejsca i każdy zapis wyglądałby na
   * zmianę.
   */
  const payloadWyjsciowy = useRef<string | null>(null);

  const [sport, setSport] = useState('piłka nożna');
  const [location, setLocation] = useState<LocationResult>(EMPTY_LOCATION);
  // Nazwa dla pinezki spoza katalogu — tak jak w kreatorze (`wydarzenia/nowe`).
  const [nazwaWlasnaMiejsca, setNazwaWlasnaMiejsca] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  // Czas trwania, nie surowa godzina końca — koniec jest zawsze pochodną
  // `time + durationMin`, więc nie da się tu ustawić końca przed początkiem.
  const [durationMin, setDurationMin] = useState(90);
  const [czasWlasny, setCzasWlasny] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [minPlayers, setMinPlayers] = useState<number | null>(null);
  const [goalkeepersEnabled, setGoalkeepersEnabled] = useState(true);
  // Tryb miejsc dla bramkarzy (migracja `077`) — w edycji zawsze znamy
  // wartość z bazy, więc bez stanu „nie zdecydowano".
  const [slotyZarezerwowane, setSlotyZarezerwowane] = useState(true);
  const [reserveClaimMinutes, setReserveClaimMinutes] = useState(180);
  const [reserveEnabled, setReserveEnabled] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionEnabled, setDescriptionEnabled] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [requireApproval, setRequireApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Seria (stała gierka), do której należy ten termin — decyduje o tym, czy
  // przy zapisie pytamy o zakres zmiany.
  const [recurringEventId, setRecurringEventId] = useState<string | undefined>();
  const [seriaTerminy, setSeriaTerminy] = useState<{ id: string; date: string }[]>([]);
  const [zakresOtwarty, setZakresOtwarty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [costPln, setCostPln] = useState('');
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<PaymentMethod[]>([]);
  const [blikPhone, setBlikPhone] = useState('');
  const [cardDiscountEnabled, setCardDiscountEnabled] = useState(false);
  const [cardDiscountPln, setCardDiscountPln] = useState('');
  const [acceptedSportsCards, setAcceptedSportsCards] = useState<SportsCardProvider[]>([]);
  const [sportsCardOtherName, setSportsCardOtherName] = useState('');
  const [showPaymentStatus, setShowPaymentStatus] = useState(false);

  // Advanced settings — pola bez odpowiednika w kreatorze (który je zakłada
  // domyślnie: brak drużyn, bez SMS, wyniki włączone). Realne, dziś używane
  // ustawienia istniejących wydarzeń, więc zostają tu, nie w kreatorze.
  const [advOpen, setAdvOpen] = useState(false);
  const [requireSmsConfirmation, setRequireSmsConfirmation] = useState(false);
  const [teamMode, setTeamMode] = useState<TeamMode>('brak');
  const [trackResults, setTrackResults] = useState(false);
  const [confirmationDeadlineH, setConfirmationDeadlineH] = useState(24);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setNotAllowed(true); setPageLoading(false); return; }

    getEvent(id)
      .then(async ({ event: ev, participants }) => {
        if (ev.organizerId !== user.id && !isAdmin) {
          // Delegat z can_edit (migracja 089/090) ma te same prawa edycji co
          // organizator — RLS na `events` UPDATE już to przepuszcza, tej
          // stronie brakowało tylko sprawdzenia przed wejściem.
          const delegat = await getMyDelegatePermissions(id, user.id).catch(() => null);
          if (!delegat?.canEdit) { setNotAllowed(true); return; }
        }

        setMecz(ev);
        setUczestnicy(participants);

        setSport(ev.sport);
        setDate(ev.date);
        setRecurringEventId(ev.recurringEventId);
        if (ev.recurringEventId) {
          // Cicho — brak listy terminów oznacza tylko tyle, że nie pytamy
          // o zakres. Nie jest powodem, żeby zablokować edycję meczu.
          getSeriesEvents(ev.recurringEventId)
            .then((terminy) => setSeriaTerminy(terminy.map((t) => ({ id: t.id, date: t.date }))))
            .catch(() => {});
        }
        const evTime = ev.time?.slice(0, 5) ?? '18:00';
        setTime(evTime);
        const evEndTime = ev.endTime?.slice(0, 5);
        if (evEndTime) {
          const [sh, sm] = evTime.split(':').map(Number);
          const [eh, em] = evEndTime.split(':').map(Number);
          const diff = (eh * 60 + em) - (sh * 60 + sm);
          setDurationMin(diff > 0 ? diff : 90);
        }
        setMaxPlayers(ev.maxPlayers);
        setMinPlayers(ev.minPlayers ?? null);
        setGoalkeepersEnabled(ev.goalkeepersEnabled ?? false);
        setSlotyZarezerwowane(ev.goalkeeperSlotsReserved ?? true);
        setReserveClaimMinutes(ev.reserveClaimMinutes ?? 180);
        setReserveEnabled(ev.reserveEnabled ?? true);
        setTitle(ev.title ?? '');
        setDescription(ev.description ?? '');
        setDescriptionEnabled(!!ev.description);
        setVisibility(ev.visibility);
        setRequireApproval(ev.requireApproval);
        setRequireSmsConfirmation(ev.requireSmsConfirmation);
        setTeamMode(ev.teamMode);
        setShowPaymentStatus(ev.showPaymentStatus);
        setTrackResults(ev.trackResults);
        setConfirmationDeadlineH(ev.confirmationDeadlineH);
        if (ev.costGrosze > 0) setCostPln(String(ev.costGrosze / 100));
        setAcceptedPaymentMethods(ev.acceptedPaymentMethods ?? []);
        setBlikPhone(ev.blikPhone ?? '');
        setAcceptedSportsCards(ev.acceptedSportsCards ?? []);
        setCardDiscountEnabled((ev.acceptedSportsCards ?? []).length > 0);
        if (ev.sportsCardDiscountGrosze != null) setCardDiscountPln(String(ev.sportsCardDiscountGrosze / 100));
        setSportsCardOtherName(ev.sportsCardOtherName ?? '');
        if (ev.requireSmsConfirmation || ev.teamMode !== 'brak' || ev.trackResults) {
          setAdvOpen(true);
        }

        if (ev.fieldId) {
          try {
            const f = await getField(ev.fieldId);
            setLocation({ venue: f, lat: f.lat, lng: f.lng, address: f.address });
          } catch {
            // Field may have been removed; reconstruct minimal object for display
            setLocation({
              venue: {
                id: ev.fieldId,
                name: ev.fieldName,
                sport: [ev.sport],
                address: ev.fieldName,
                lat: ev.lat ?? 0,
                lng: ev.lng ?? 0,
                available: true,
                surface: '',
                isIndoor: false,
                isBookable: false,
                bookingType: 'none' as const,
                bookingEnabled: false,
                mapVisibility: 'organizer_only',
              },
              lat: ev.lat ?? 0,
              lng: ev.lng ?? 0,
              address: ev.fieldName,
            });
          }
        } else if (ev.lat != null && ev.lng != null) {
          setLocation({ venue: null, lat: ev.lat, lng: ev.lng, address: ev.customAddress ?? ev.fieldName });
          setNazwaWlasnaMiejsca(ev.customLocationName ?? ev.fieldName ?? '');
        }
      })
      .catch(() => setNotAllowed(true))
      .finally(() => setPageLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  /** Formularz → payload dla `updateEvent`. Wydzielone, bo ten sam payload
   *  idzie do jednego meczu i (przy serii) do pozostałych terminów. */
  const zbudujPayload = (): EventCreate => {
    const endTime = addMinutes(time, durationMin);
    // `nazwaZAdresu()`, nie surowy pierwszy segment — patrz uzasadnienie
    // w `wydarzenia/nowe/page.tsx` (ten sam błąd, ten sam błąd naprawiony
    // wspólnym helperem: „GDZIE: 19C" zamiast nazwy ulicy).
    const fieldName = location.venue
      ? location.venue.name
      : (nazwaWlasnaMiejsca.trim()
        || nazwaZAdresu(location.address)
        || 'Nieznana lokalizacja');
    const hasCost = parseFloat(costPln || '0') > 0;

    return {
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
      goalkeepersEnabled: GK_SPORTS.includes(sport) ? goalkeepersEnabled : false,
      goalkeeperSlotsReserved: slotyZarezerwowane,
      reserveClaimMinutes,
      reserveEnabled,
      visibility,
      requireApproval,
      requireSmsConfirmation,
      teamMode,
      trackPayments: hasCost,
      showPaymentStatus: hasCost ? showPaymentStatus : false,
      trackResults,
      confirmationDeadlineH,
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
    };
  };

  /** Stan wyjściowy meczu w kształcie do porównania — patrz `lib/zmianyMeczu.ts`. */
  const daneZMeczu = (ev: EventItem): DaneDoPorownania => ({
    date: ev.date,
    time: ev.time ?? '',
    miejsceNazwa: ev.fieldName ?? '',
    fieldId: ev.fieldId,
    costGrosze: ev.costGrosze ?? 0,
    maxPlayers: ev.maxPlayers,
    visibility: ev.visibility,
    requireApproval: ev.requireApproval,
    reserveEnabled: ev.reserveEnabled ?? true,
    goalkeepersEnabled: ev.goalkeepersEnabled ?? false,
    title: ev.title ?? '',
    description: ev.description ?? '',
    acceptedPaymentMethods: ev.acceptedPaymentMethods ?? [],
    acceptedSportsCards: ev.acceptedSportsCards ?? [],
  });

  /** To samo z formularza — liczone z GOTOWEGO payloadu, nie ze stanu pól,
   *  żeby porównanie widziało dokładnie to, co poleci do bazy (payload
   *  zeruje np. metody płatności przy meczu za darmo). */
  const daneZPayloadu = (p: EventCreate): DaneDoPorownania => ({
    date: p.date,
    time: p.time,
    miejsceNazwa: p.fieldName,
    fieldId: p.fieldId,
    costGrosze: p.costGrosze ?? 0,
    maxPlayers: p.maxPlayers,
    visibility: p.visibility,
    requireApproval: p.requireApproval ?? false,
    reserveEnabled: p.reserveEnabled ?? true,
    goalkeepersEnabled: p.goalkeepersEnabled ?? false,
    title: p.title ?? '',
    description: p.description ?? '',
    acceptedPaymentMethods: p.acceptedPaymentMethods ?? [],
    acceptedSportsCards: p.acceptedSportsCards ?? [],
  });

  /** Ilu ludzi zajmuje dziś miejsce w składzie — do ostrzeżenia przy
   *  zmniejszaniu liczby miejsc. Rezerwowi i obserwujący nie liczą się do
   *  limitu, więc nie liczą się i tutaj. */
  const wSkladzie = uczestnicy.filter(
    (p) => !p.isReserve && !p.pendingApproval && p.rsvp !== 'maybe',
  ).length;

  useEffect(() => {
    if (pageLoading || !mecz || payloadWyjsciowy.current !== null) return;
    payloadWyjsciowy.current = JSON.stringify(zbudujPayload());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLoading, mecz]);

  const zapisz = async (zakres: ZakresEdycji, wyslijWiadomosc = false) => {
    const payload = zbudujPayload();
    setZakresOtwarty(false);
    setSubmitting(true);
    setError(null);
    try {
      // Edytowany termin zawsze zapisuje się w całości — z własną datą.
      // actorId/actorName odblokowują wpis do dziennika aktywności
      // (event_updated, lib/events.ts) — bez nich gałąź nigdy się nie
      // wykonywała dla głównej ścieżki edycji.
      await updateEvent(id, payload, user?.id, displayName(user ?? null));

      if (zakres !== 'ten' && recurringEventId) {
        const dzis = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, lokalnie
        const objete = terminyWZakresie(seriaTerminy, id, zakres, dzis)
          .filter((t) => t.id !== id);
        // `patchDlaPozostalych` zdejmuje `date` — inaczej wszystkie terminy serii
        // wylądowałyby tego samego dnia.
        await updateSeriesEvents(objete.map((t) => t.id), patchDlaPozostalych(payload) as EventCreate);
        // Szablon też, inaczej KOLEJNE terminy wracałyby do starych ustawień.
        await updateSeriesTemplate(recurringEventId, payload);
      }

      // Wiadomość na czat PO udanym zapisie, nie przed — ta sama zasada co
      // przy odwołaniu meczu: nie ogłaszamy stanu, którego jeszcze nie ma.
      if (wyslijWiadomosc && mecz) {
        const zmiany = policzZmiany(daneZMeczu(mecz), daneZPayloadu(payload));
        // Pola SKŁADANE JAWNIE, nie przez `{ ...mecz, ...payload }`. Payload nie
        // niesie `fieldAddress` (adres obiektu z katalogu mieszka w `fields`),
        // więc rozlanie zostawiłoby adres SPRZED zmiany pod nową nazwą — czyli
        // dokładnie ten błąd, który ten PR naprawia w bazie. Adres bierzemy
        // z aktualnie wybranej lokalizacji.
        await udostepnijZmiane(
          {
            sport: payload.sport,
            title: payload.title,
            maxPlayers: payload.maxPlayers,
            date: payload.date,
            time: payload.time,
            endTime: payload.endTime,
            costGrosze: payload.costGrosze ?? 0,
            fieldName: payload.fieldName,
            fieldAddress: location.venue?.address,
            customLocationName: payload.customLocationName,
            customAddress: payload.customAddress,
          },
          zmiany,
          eventUrl(id, window.location.origin),
        );
      }

      router.push(`/wydarzenia/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian');
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.venue && location.lat === null) { setError('Wybierz boisko na mapie.'); return; }
    if (!date) { setError('Podaj datę.'); return; }
    const payErrs = validatePayments({ costPln, acceptedPaymentMethods, blikPhone, cardDiscountEnabled, cardDiscountPln });
    if (Object.keys(payErrs).length > 0) {
      setFieldErrors(payErrs);
      return;
    }
    setFieldErrors({});

    // Przy serii dłuższej niż jeden termin pytamy o zakres. Przy jednym terminie
    // wszystkie trzy odpowiedzi znaczą to samo — pytanie byłoby kliknięciem
    // bez treści.
    //
    // KOLEJNOŚĆ PYTAŃ JEST TREŚCIĄ: najpierw „ilu terminów to dotyczy", potem
    // „komu to pójdzie". Odwrotnie okno konsekwencji mówiłoby o jednym meczu,
    // a zapis obejmowałby dziesięć. (`SHOW_RECURRING` jest dziś wyłączona,
    // więc ta gałąź realnie nie chodzi — ale nie psujemy jej.)
    if (recurringEventId && seriaTerminy.length > 1) {
      setZakresOtwarty(true);
      return;
    }
    await zapiszZPytaniem('ten');
  };

  /**
   * Zapis z oknem konsekwencji.
   *
   * PO CO. Do tej pory „Zapisz zmiany" nie mówiło NIC: ani co się właściwie
   * zmieniło, ani że wyzwalacze `065`/`114` wysyłają właśnie powiadomienie
   * całemu składowi, ani że gość bez adresu nie dostanie niczego. Odwołanie
   * meczu ma takie okno od `O-38` i jest to jedyne miejsce w aplikacji, gdzie
   * organizator wie, co robi. Edycja — czyli czynność WYKONYWANA CZĘŚCIEJ —
   * nie miała go wcale.
   */
  const zapiszZPytaniem = async (zakres: ZakresEdycji) => {
    // Okno zakresu serii musi zejść, zanim wejdzie okno konsekwencji —
    // dwa okna jedno na drugim to na telefonie ekran bez wyjścia.
    setZakresOtwarty(false);
    const payload = zbudujPayload();
    const zmiany = mecz ? policzZmiany(daneZMeczu(mecz), daneZPayloadu(payload)) : [];

    // BRAK ZMIAN = BRAK ZAPISU. Dotąd pusty zapis i tak szedł UPDATE-em do
    // bazy i dopisywał wiersz do dziennika aktywności — czyli „Edytowano
    // mecz" w historii meczu, w którym nikt niczego nie zmienił.
    //
    // Decyduje CAŁY payload, nie lista `zmiany` — patrz `payloadWyjsciowy`.
    if (payloadWyjsciowy.current !== null
        && payloadWyjsciowy.current === JSON.stringify(payload)) {
      router.push(`/wydarzenia/${id}`);
      return;
    }

    const komu = komuDojdzie(uczestnicy, mecz?.organizerId ?? '');
    const wybor = await potwierdz({
      tytul: 'Zapisać zmiany?',
      // Pusta lista przy zmienionym payloadzie znaczy, że ruszone zostało
      // jedno z ustawień, których nie wypisujemy wierszem „było → jest"
      // (czas gry, próg minimum, tryb bramkarzy, czas na decyzję z rezerwy…).
      // Milczenie w tym miejscu czytałoby się jak „nic nie zmieniłem".
      opis: zmiany.length > 0
        ? zmiany.map((z) => `${z.etykieta}: ${z.przed} → ${z.po}`).join('\n')
        : 'Zmieniasz ustawienia meczu — data, miejsce i koszt zostają bez zmian.',
      konsekwencje: konsekwencjeZapisu(zmiany, komu, {
        zapisanych: wSkladzie,
        miejsc: payload.maxPlayers,
      }),
      potwierdzLabel: 'Zapisz zmiany',
      // Druga droga tylko wtedy, gdy jest o czym pisać. Przy zmianie samego
      // tytułu przycisk „wyślij wiadomość" proponowałby zawracanie ekipie
      // głowy czymś, czego nawet nie zauważy.
      akcjaDodatkowaLabel: czyPowiadamia(zmiany) ? 'Zapisz i wyślij wiadomość' : undefined,
    });
    if (wybor === 'nie') return;

    await zapisz(zakres, wybor === 'dodatkowa');
  };

  const inputCls =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  if (pageLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
        </main>
      </div>
    );
  }

  if (notAllowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-slate-500">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">Brak dostępu</p>
            <p className="text-sm mt-1">Tylko organizator może edytować wydarzenie.</p>
            <Link href={`/wydarzenia/${id}`} className="text-primary-600 text-sm underline mt-4 inline-block">
              Wróć do wydarzenia
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/wydarzenia/${id}`} aria-label="Wróć" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Edytuj wydarzenie</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sport — te same chipsy co w kreatorze */}
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-2 overflow-x-auto pb-1 -mb-1 [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SPORTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSport(s)}
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
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
                <ChevronDown className="h-4 w-4" />
              </div>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Wybierz sport"
              >
                {(SPORTS.includes(sport as typeof SPORTS[number]) ? SPORTS : [sport, ...SPORTS]).map((s) => (
                  <option key={s} value={s}>{sportEmoji(s)} {sportLabel(s)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lokalizacja — ten sam UnifiedLocationPicker co w kreatorze,
              zamiast dawnego VenuePicker (tylko mapa, bez wyszukiwarki
              i pinezek spoza katalogu). */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Lokalizacja</label>
            <p className="text-xs text-slate-500 mb-2">
              Kliknij boisko na mapie, wyszukaj adres lub kliknij dowolne miejsce.
            </p>
            <div className="h-64 sm:h-80 rounded-xl overflow-hidden border border-slate-200">
              <UnifiedLocationPicker sport={sport} value={location} onChange={setLocation} />
            </div>

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
              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nazwa miejsca <span className="text-slate-400 font-normal">(opcjonalnie)</span>
                </label>
                <input
                  type="text"
                  value={nazwaWlasnaMiejsca}
                  onChange={(e) => setNazwaWlasnaMiejsca(e.target.value)}
                  placeholder={nazwaZAdresu(location.address) || 'np. Boisko przy szkole'}
                  maxLength={80}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          <EventDateTimeField
            date={date}
            setDate={setDate}
            time={time}
            setTime={setTime}
            durationMin={durationMin}
            setDurationMin={setDurationMin}
            czasWlasny={czasWlasny}
            setCzasWlasny={setCzasWlasny}
            inputCls={inputCls}
          />

          <EventCapacityFields
            sport={sport}
            maxPlayers={maxPlayers}
            onMaxPlayersChange={setMaxPlayers}
            minPlayers={minPlayers}
            onMinPlayersChange={setMinPlayers}
            goalkeepersEnabled={goalkeepersEnabled}
            slotyZarezerwowane={slotyZarezerwowane}
            setSlotyZarezerwowane={setSlotyZarezerwowane}
            setGoalkeepersEnabled={setGoalkeepersEnabled}
            reserveEnabled={reserveEnabled}
            setReserveEnabled={setReserveEnabled}
            reserveClaimMinutes={reserveClaimMinutes}
            setReserveClaimMinutes={setReserveClaimMinutes}
            zapisanych={wSkladzie}
          />

          {/* Koszt. W bazie trzymamy ZAWSZE kwotę od osoby — etykieta mówi to
              wprost. Kreator ma tu do wyboru DWA tryby wpisywania (od osoby /
              za cały obiekt, patrz `wydarzenia/nowe/page.tsx`), bo przy
              zakładaniu meczu organizator zwykle zna cenę wynajmu, nie cenę
              od gracza. Tu, przy edycji istniejącego meczu, cena jest już
              ustalona i nikt nie przelicza jej na nowo — zostaje tylko
              wpisywanie od osoby, ale etykieta i podpis pod polem MUSZĄ
              rozstrzygać wprost, o którą kwotę chodzi. „Koszt uczestnictwa
              (PLN)" tego nie robiło — zgłoszone wprost: sprzeczne z etykietą
              kreatora („Koszt wynajmu obiektu"), organizator nie wiedział,
              czy wpisać całość, czy kwotę od osoby. */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Koszt od osoby (zł)
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={costPln}
              onChange={(e) => setCostPln(e.target.value)}
              placeholder="0 = za darmo"
              className={inputCls}
            />
            {parseFloat(costPln || '0') > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Przy komplecie ({maxPlayers} os.) to{' '}
                <span className="font-semibold">{(parseFloat(costPln) * maxPlayers).toFixed(2)} zł</span>
                {' '}za cały obiekt.
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

          {parseFloat(costPln || '0') > 0 && (
            <div className="rounded-lg border border-slate-200 px-4">
              <ToggleRow
                label="Pokaż status płatności uczestnikom"
                desc="Uczestnicy widzą, kto już zapłacił"
                checked={showPaymentStatus}
                onChange={setShowPaymentStatus}
              />
            </div>
          )}

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

          <EventVisibilityFields
            visibility={visibility}
            setVisibility={setVisibility}
            requireApproval={requireApproval}
            setRequireApproval={setRequireApproval}
          />

          {/* Advanced settings accordion — ustawienia bez odpowiednika w kreatorze */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setAdvOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Ustawienia zaawansowane
              {advOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {advOpen && (
              <div className="px-4 pb-2 border-t border-slate-100 divide-y divide-slate-100">
                {SHOW_SMS_FEATURES && (
                  <ToggleRow label="Potwierdzenie SMS" desc="Zaproszeni gracze potwierdzają przez SMS" checked={requireSmsConfirmation} onChange={setRequireSmsConfirmation} />
                )}
                {SHOW_SMS_FEATURES && requireSmsConfirmation && (
                  <div className="py-3">
                    <label className="block text-xs text-slate-600 mb-1">Termin potwierdzenia (h przed meczem)</label>
                    <input type="number" min={1} max={168} value={confirmationDeadlineH}
                      onChange={(e) => setConfirmationDeadlineH(Number(e.target.value))}
                      className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Tryb drużyn</p>
                    <p className="text-xs text-slate-500 mt-0.5">Jak są tworzone składy</p>
                  </div>
                  <select value={teamMode} onChange={(e) => setTeamMode(e.target.value as TeamMode)}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="brak">Brak</option>
                    <option value="reczne">Ręczne</option>
                    <option value="kapitanowie">Kapitanowie</option>
                    <option value="losowe">Losowe</option>
                  </select>
                </div>
                <ToggleRow label="Wyniki i statystyki" desc="Wpisuj wyniki meczu i bramki graczy" checked={trackResults} onChange={setTrackResults} />
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Link href={`/wydarzenia/${id}`} className="flex-1">
              <Button type="button" variant="outline" className="w-full" size="lg">Anuluj</Button>
            </Link>
            <Button type="submit" size="lg" isLoading={submitting} className="flex-1">
              Zapisz zmiany
            </Button>
          </div>
        </form>

        {/* Reminders — standalone section, saves independently from the main form */}
        {SHOW_SMS_FEATURES && <RemindersSection eventId={id} />}
      </main>

      {/* Poza <form>: klik w przycisk wewnątrz formularza wywołałby submit. */}
      {oknoPotwierdzenia}

      {zakresOtwarty && (
        <ZakresEdycjiSerii
          liczbaTerminow={seriaTerminy.length}
          liczbaPrzyszlych={
            terminyWZakresie(seriaTerminy, id, 'ten-i-przyszle', new Date().toLocaleDateString('sv-SE')).length
          }
          busy={submitting}
          onWybierz={zapiszZPytaniem}
          onClose={() => setZakresOtwarty(false)}
        />
      )}
    </div>
  );
}
