'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Bell, BellOff, Mail, Smartphone, Check } from 'lucide-react';
import {
  getMojeAlerty, saveAlert, zaktualizujAlert, deleteMyAlert, nazwaAlertu,
  znajdzPodobnyAlert, wygasaZKiedy, kiedyZWygasniecia, PROMIEN_DOMYSLNY,
  type AlertInput,
} from '@/lib/alerts';
import { pozycjaBezPytania } from '@/lib/geo';
import { useAuth } from '@/lib/auth';
import { FOCUS_SPORTS, sportEmoji, sportLabel } from '@/lib/sports';
import { SHOW_SMS_FEATURES } from '@/lib/features';
import { stanPush, wlaczPush, type StanPush } from '@/lib/push';
import SportChip from '@/components/ui/SportChip';
import ToggleRow from '@/components/ui/ToggleRow';
import WyborKiedy from '@/components/ui/WyborKiedy';
import WyborMiejscowosci from '@/components/map/WyborMiejscowosci';
import type { DateFilter } from '@/lib/eventFilters';
import type { Miejscowosc } from '@/lib/miejscowosci';
import type { GameAlert } from '@/types';
import { WARSTWA } from '@/lib/warstwy';

/** Co powiedzieć o pushu w zależności od tego, co ta przeglądarka w ogóle umie.
 *  Stany biorą się z `stanPush()` — ten sam mechanizm co przełącznik w profilu. */
const OPIS_PUSHA: Record<StanPush, string> = {
  wlaczone:           'Powiadomienia na telefon są włączone.',
  wylaczone:          'Możesz włączyć powiadomienia na telefon.',
  zablokowane:        'Powiadomienia są zablokowane w ustawieniach przeglądarki — odblokuj je tam, wtedy wrócimy do tego pytania.',
  'wymaga-instalacji': 'Na iPhonie powiadomienia działają dopiero po dodaniu Bojo do ekranu głównego: Udostępnij → „Dodaj do ekranu początkowego".',
  nieobslugiwane:     'Ta przeglądarka nie obsługuje powiadomień. Zostaje mail i dzwonek w aplikacji.',
};

interface Props {
  onClose: () => void;
  onSaved?: (alert: GameAlert) => void;
  /** Podany = EDYCJA tego alertu (ten sam wiersz, to samo `id` i token).
   *  Pusty = nowy alert; wtedy pola startują z `default*` niżej. */
  alert?: GameAlert;
  /** Czy `default*` przyszły z filtrów listy — decyduje o jednej linijce nad
   *  polami. Bez niej nikt nie wie, skąd wzięły się wypełnione wartości. */
  zFiltrow?: boolean;
  defaultSport?: string;
  defaultRadiusKm?: number;
  defaultLat?: number;
  defaultLng?: number;
  defaultLabel?: string;
}

/**
 * Okno alertu o nowych meczach.
 *
 * FILTRY SĄ W OKNIE — WRÓCIŁY PO JEDNEJ PRÓBIE BEZ NICH (2026-09-14).
 *
 * Przez pół dnia okno ich nie miało. Rozumowanie brzmiało: wejście prowadzi
 * wprost z wyników filtrów (`domyslneZFiltrow`), więc odpowiedź już jest,
 * a pytanie o nią drugi raz to praca do wykonania ponownie. Zostały dwa
 * pytania (jak długo, czym) i wiersz podsumowania do przeczytania.
 *
 * ROZUMOWANIE BYŁO BŁĘDNE, bo pomijało jeden przypadek: alert da się otworzyć,
 * ZANIM cokolwiek zostało ustawione w filtrach. Wtedy nie ma skąd wziąć
 * punktu, a jedyną drogą zostawała lokalizacja urządzenia — która w
 * przeglądarce wbudowanej w inną aplikację (zgłoszone ze zrzutu z GitHuba)
 * bywa po prostu zablokowana. Okno kończyło się wtedy ślepo: „nie wiemy,
 * gdzie szukać", przycisk, który nic nie daje, i wyszarzony zapis.
 *
 * Wniosek jest ogólniejszy niż ten jeden ekran: **wartość z innego ekranu może
 * być WYPEŁNIENIEM pola, ale nie może być jedynym sposobem jego ustawienia.**
 * Pole miejscowości przyjmuje nazwę albo kod pocztowy z klawiatury i działa
 * wszędzie; pinezka jest skrótem, nie jedyną drogą.
 *
 * Okno pyta więc dziś o cztery rzeczy, ale trzy z nich przychodzą już
 * wypełnione z filtrów, gdy tamte były ustawione:
 *
 *   1. **Sport** — `SportChip`, ten sam co w arkuszu filtrów,
 *   2. **Gdzie** — `WyborMiejscowosci`: pole z pinezką plus suwak promienia,
 *   3. **Jak długo powiadamiać** — `WyborKiedy` (`expires_at`),
 *   4. **Czym dać znać** — mail, push, SMS.
 *
 * Co z tej rundy ZOSTAJE: dni tygodnia i pora dnia (`days_of_week`,
 * `godzina_od`/`godzina_do`, migracja `149`) nie wracają do okna. Te dwa
 * naprawdę były pytaniem o termin zadanym drugi raz, obok „Kiedy" w filtrach,
 * i nikt nie wiedział, które z nich czyta. Kolumny zostają w bazie i w funkcji
 * brzegowej nietknięte.
 *
 * ALERT JEST DOMYŚLNIE BEZTERMINOWY (decyzja właściciela) — brak wyboru
 * w „Kiedy" znaczy właśnie to. Warunek jest jeden: musi dać się wyłączyć
 * z samej wiadomości, bez logowania. Stąd `wylacz_token` i trasa
 * `/alert/wylacz/[token]`.
 */
export default function AlertSetupDialog({
  onClose, onSaved, alert, zFiltrow,
  defaultSport, defaultRadiusKm, defaultLat, defaultLng, defaultLabel,
}: Props) {
  const { user } = useAuth();
  const edycja = alert != null;

  const [sport,    setSport]    = useState(alert?.sport ?? defaultSport ?? '');
  const [miejsce,  setMiejsce]  = useState<Miejscowosc | null>(() => {
    if (alert) return { nazwa: alert.cityLabel || 'Wybrane miejsce', kontekst: '', lat: alert.lat, lng: alert.lng };
    if (defaultLat != null && defaultLng != null) {
      return { nazwa: defaultLabel || 'Moja lokalizacja', kontekst: '', lat: defaultLat, lng: defaultLng };
    }
    return null;
  });
  const [promienKm, setPromienKm] = useState(alert?.radiusKm ?? defaultRadiusKm ?? PROMIEN_DOMYSLNY);

  const [kiedy, setKiedy] = useState<DateFilter>(
    alert ? kiedyZWygasniecia(alert.expiresAt) : 'wszystkie');
  const [kanalEmail, setKanalEmail] = useState(alert?.kanalEmail ?? true);
  /** Pozostałe alerty — wyłącznie do ostrzeżenia o bliźniaku przy zapisie. */
  const [inneAlerty, setInneAlerty] = useState<GameAlert[]>([]);
  const [bliźniak, setBliźniak] = useState<GameAlert | null>(null);
  const [push, setPush] = useState<StanPush | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => { stanPush().then(setPush).catch(() => setPush('nieobslugiwane')); }, []);

  // Okno NIE SZUKA JUŻ SAMO, który alert edytować — dostaje go propsem.
  // Wcześniej wołało `getMyAlert()` i nadpisywało nim wszystko, bo alert był
  // jeden; przy wielu to samo zachowanie znaczyłoby „edytuj losowy", cokolwiek
  // by człowiek kliknął. Pobieramy tu wyłącznie POZOSTAŁE alerty, żeby przy
  // zapisie ostrzec przed bliźniakiem.
  //
  // Gdy nikt nie podał miejsca (nowy alert spoza filtrów), bierzemy pozycję,
  // ale WYŁĄCZNIE przy już udzielonej zgodzie (`pozycjaBezPytania`): samo
  // otwarcie okna nie jest powodem, żeby przeglądarka wyskoczyła z systemową
  // prośbą o lokalizację.
  useEffect(() => {
    let zywe = true;
    (async () => {
      if (user) {
        const wszystkie = await getMojeAlerty().catch(() => []);
        if (zywe) setInneAlerty(wszystkie);
      }
      if (!zywe || alert || defaultLat != null) return;
      const poz = await pozycjaBezPytania();
      if (!zywe || !poz) return;
      setMiejsce({ nazwa: 'Moja lokalizacja', kontekst: '', lat: poz.lat, lng: poz.lng });
    })();
    return () => { zywe = false; };
    // `alert`/`defaultLat` czytane raz, przy otwarciu — okno nie przestawia
    // się w locie pod palcem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSave = async (mimoBliźniaka = false) => {
    if (!user || !miejsce) return;

    // OSTRZEŻENIE O BLIŹNIAKU — odkąd alertów może być wiele (2026-09-15).
    // `notify-game-alert` filtruje wszystkie aktywne alerty i NIE deduplikuje
    // po użytkowniku, więc dwa bliźniacze alerty to dwa maile o jednym meczu.
    // Przy jednym slocie problem nie istniał; teraz powstaje przy trzecim
    // nieuważnym dotknięciu „Powiadom o takich meczach".
    if (!mimoBliźniaka) {
      const podobny = znajdzPodobnyAlert(
        inneAlerty.filter((a) => a.isActive),
        { sport: sport || undefined, lat: miejsce.lat, lng: miejsce.lng, radiusKm: promienKm },
        alert?.id,
      );
      if (podobny) { setBliźniak(podobny); return; }
    }

    setSaving(true);
    try {
      const input: AlertInput = {
        sport:      sport || undefined,
        // Dni tygodnia i pora dnia zostały wyjęte z okna (patrz nagłówek
        // komponentu). Pusta tablica znaczy w `notify-game-alert` „dowolny
        // dzień", a `null`/`null` — „dowolna pora"; edycja starego alertu
        // z ustawionymi godzinami wyzeruje je świadomie, bo inaczej okno
        // pokazywałoby jedno, a baza trzymała drugie.
        daysOfWeek: [],
        lat:        miejsce.lat,
        lng:        miejsce.lng,
        radiusKm:   promienKm,
        cityLabel:  miejsce.nazwa || undefined,
        expiresAt:  wygasaZKiedy(kiedy),
        godzinaOd:  null,
        godzinaDo:  null,
        kanalEmail,
      };
      // Edycja idzie `zaktualizujAlert`, nie „skasuj i wstaw": `id` wskazuje
      // `notifications.alert_id`, a `wylacz_token` siedzi w już wysłanych
      // mailach i musi dalej działać.
      const zapisany = alert
        ? await zaktualizujAlert(alert.id, input)
        : await saveAlert(user.id, input);
      setSaved(true);
      onSaved?.(zapisany);
      setTimeout(onClose, 1200);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!alert) return;
    setDeleting(true);
    await deleteMyAlert(alert.id);
    setDeleting(false);
    onClose();
  };

  const naglowekSekcji = 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2';

  // BEZ MIEJSCA NIE DA SIĘ ZAPISAĆ — I TO MUSI BYĆ NAPISANE, 2026-09-14,
  // zgłoszone wprost („użytkownik nie wie, dlaczego nie może dodać alertu, jak
  // nie wybierze miasta"). Powód jest prawdziwy, nie formalny: alert dopasowuje
  // mecze po ODLEGŁOŚCI od punktu (`lat`/`lng` + `radius_km`), więc bez punktu
  // nie ma od czego liczyć promienia.
  //
  // Odkąd okno nie ma własnego pola miejscowości, brak punktu znaczy, że nie
  // było go też w filtrach — więc jedyne wyjście dostępne STĄD to lokalizacja
  // urządzenia. Reszta dzieje się w filtrach i okno mówi to wprost, zamiast
  // wyszarzyć przycisk bez słowa wyjaśnienia.
  const brakMiejsca = !miejsce;

  return (
    <div className={`fixed inset-0 ${WARSTWA.modal} flex items-end sm:items-center justify-center p-0 sm:p-4`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden dark:bg-slate-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-700" />
            {/* Nagłówek mówi, CO się zaraz stanie. „Twój alert na gierki"
                znaczyło jedno i drugie naraz i przy wielu alertach byłoby
                już wprost mylące. */}
            <h2 className="text-base font-bold text-ink">
              {edycja ? 'Zmieniasz alert' : 'Nowy alert'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Zamknij" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* SKĄD WZIĘŁY SIĘ WYPEŁNIONE POLA — jedna linijka, ale robi całą
              robotę przy zarzucie „wymieszanie z filtrami jest średnie".
              Bez niej człowiek widzi wypełniony formularz i nie wie, czy to
              pamięć po poprzednim alercie, czy podpowiedź; a przy edycji nie
              wie, czy zmiana pola ruszy też listę pod spodem. Mówimy oba
              fakty wprost, w miejscu, w którym powstaje pytanie. */}
          {!edycja && zFiltrow && (
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Wypełnione <strong className="font-semibold">Twoimi filtrami</strong> — możesz
              tu wszystko zmienić, nie ruszy to listy meczów.
            </p>
          )}

          {/* ── SPORT ── ten sam `SportChip` co w arkuszu filtrów. Wybór jest
              POJEDYNCZY (alert trzyma jeden sport albo dowolny), więc
              dotknięcie wybranego odznacza go i wraca do „Dowolnego sportu" —
              bez tego brak piątej ikony „Wszystkie" byłby pułapką. */}
          <div>
            <p className={naglowekSekcji}>Sport</p>
            <div className="flex flex-wrap gap-2">
              {FOCUS_SPORTS.map((s) => (
                <SportChip
                  key={s}
                  emoji={sportEmoji(s)}
                  label={sportLabel(s)}
                  selected={sport === s}
                  onClick={() => setSport((cur) => (cur === s ? '' : s))}
                />
              ))}
            </div>
            <p className="mt-2 text-sm font-medium text-ink">
              {sport === '' ? 'Dowolny sport' : sportLabel(sport)}
            </p>
          </div>

          {/* ── GDZIE ── POLE, nie sam przycisk lokalizacji. Zgłoszone wprost:
              „nie da się lokalizacji wskazać". Przez pół dnia stał tu wyłącznie
              przycisk „Użyj mojej lokalizacji", bo zakładaliśmy, że punkt
              przyjdzie z filtrów — a w przeglądarce wbudowanej w inną aplikację
              geolokalizacja bywa po prostu zablokowana i okno kończyło się
              ślepo. Pole przyjmuje nazwę albo kod pocztowy z klawiatury
              i działa wszędzie; pinezka w nim jest skrótem, nie jedyną drogą.

              Ten sam komponent co w arkuszu filtrów, więc promień chodzi po tej
              samej skali (`PROMIENIE_SUWAK_KM`) i te same kilometry znaczą
              w obu miejscach to samo. */}
          <div>
            <p className={naglowekSekcji}>
              Gdzie{' '}
              <span className="normal-case font-normal text-slate-400">(wymagane)</span>
            </p>
            <WyborMiejscowosci
              wybrana={miejsce}
              promienKm={promienKm}
              naZmiane={(m, km) => { setMiejsce(m); setPromienKm(km); }}
            />
            {brakMiejsca && (
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Alert wyłapuje mecze po odległości od wskazanego punktu, więc bez
                niego nie ma od czego liczyć. Wpisz miejscowość albo kod pocztowy —
                pinezka obok pola ustawia Twoją lokalizację, jeśli przeglądarka
                na to pozwala.
              </p>
            )}
          </div>

          {/* ── JAK DŁUGO POWIADAMIAĆ ── ten sam kształt co „Kiedy" w filtrach,
              o czym innym: tam odcinek czasu wybiera MECZE, tu długość życia
              alertu. Brak wyboru = bezterminowo, czyli stan domyślny. */}
          <div>
            <p className={naglowekSekcji}>Jak długo powiadamiać</p>
            <WyborKiedy
              wartosc={kiedy}
              naZmiane={setKiedy}
              label="Do kiedy"
              podpisWszystkich="Bezterminowo"
            />
            {kiedy === 'wszystkie' && (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Alert działa, dopóki go nie wyłączysz — każda wiadomość ma na
                dole link, który go gasi jednym kliknięciem.
              </p>
            )}
          </div>

          {/* ── CZYM DAĆ ZNAĆ ── */}
          <div>
            <p className={naglowekSekcji}>Czym dać znać</p>

            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <Check className="h-4 w-4 shrink-0 text-primary-700" aria-hidden />
              {/* Dzwonek to historia, nie kanał przerywający dzień — ta sama
                  doktryna co w `lib/ustawieniaPowiadomien.ts`, więc nie ma tu
                  przełącznika, który obiecywałby jego wyłączenie. */}
              Dzwonek w aplikacji — zawsze
            </div>

            <div className="mt-1 rounded-xl border border-slate-200 px-4 dark:border-slate-700">
              <ToggleRow
                label="Mail"
                desc="Na adres, którym się logujesz"
                checked={kanalEmail}
                onChange={setKanalEmail}
              />
            </div>

            {/* PUSH NIE MA TU WŁASNEGO PRZEŁĄCZNIKA. Jedzie automatycznie
                z wiersza w `notifications` (wyzwalacz z migracji `102`),
                a wyłącza się w ustawieniach powiadomień — per typ, dla całej
                aplikacji. Drugi przełącznik w tym oknie znaczyłby dwa miejsca
                na jedną rzecz i pierwszy rozjazd byłby kwestią czasu. Zostaje
                stan i, gdy się da, jedno kliknięcie włączenia. */}
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Powiadomienie na telefon</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {push ? OPIS_PUSHA[push] : 'Sprawdzam…'}
                </p>
                {push === 'wylaczone' && user && (
                  <button
                    type="button"
                    disabled={pushBusy}
                    onClick={async () => {
                      setPushBusy(true);
                      try { await wlaczPush(user.id); setPush(await stanPush()); }
                      catch { setPush(await stanPush()); }
                      finally { setPushBusy(false); }
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 disabled:opacity-60 dark:border-primary-800 dark:bg-primary-950"
                  >
                    {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                    Włącz powiadomienia
                  </button>
                )}
              </div>
            </div>

            {SHOW_SMS_FEATURES && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-500 dark:border-slate-700">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                SMS — wkrótce
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-2 dark:border-slate-700">
          {saved ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-50 text-green-700 font-semibold text-sm">
              <Bell className="w-4 h-4" /> Alert zapisany!
            </div>
          ) : bliźniak ? (
            /* BLIŹNIAK — pytanie zamiast przycisku, w tym samym miejscu ekranu.
               Drugie okno nad oknem byłoby tu gorsze: człowiek jest w połowie
               formularza i musi zobaczyć, że wybór dotyczy TEGO zapisu. */
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Masz już prawie taki alert
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                „{nazwaAlertu(bliźniak)}" łapie te same mecze. Dwa takie alerty
                znaczą dwa maile o jednym meczu.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-primary-700 py-2.5 text-sm font-semibold text-white"
                >
                  Zostaw ten, który mam
                </button>
                <button
                  type="button"
                  onClick={() => { setBliźniak(null); handleSave(true); }}
                  className="py-1.5 text-xs font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300"
                >
                  Mimo to dodaj drugi
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Wskaźnik, nie powtórzenie: pełne wyjaśnienie stoi przy samym
                  polu, tutaj zostaje jedno zdanie mówiące, gdzie go szukać —
                  bo to TUTAJ ktoś odkrywa, że przycisk nie działa. Sam `title`
                  nie wystarcza: na telefonie nie ma czym najechać. */}
              {brakMiejsca && (
                <p className="text-center text-xs font-medium text-amber-700 dark:text-amber-400">
                  Wybierz najpierw miejsce ↑
                </p>
              )}
              <button
                onClick={() => handleSave()}
                disabled={saving || brakMiejsca}
                title={brakMiejsca ? 'Najpierw wskaż miejsce — alert szuka meczów w promieniu od niego' : undefined}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 py-3.5 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                {edycja ? 'Zapisz zmiany' : 'Zapisz alert'}
              </button>
            </>
          )}

          {edycja && !saved && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium text-slate-400 hover:text-red-500 transition-colors"
            >
              <BellOff className="w-4 h-4" />
              {deleting ? 'Usuwam…' : 'Usuń alert'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
