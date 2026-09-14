'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Bell, BellOff, Mail, MapPin, Smartphone, Check } from 'lucide-react';
import {
  getMyAlert, saveAlert, deleteMyAlert,
  wygasaZKiedy, kiedyZWygasniecia, PROMIEN_DOMYSLNY, type AlertInput,
} from '@/lib/alerts';
import { pozycjaBezPytania } from '@/lib/geo';
import { useAuth } from '@/lib/auth';
import { sportLabel } from '@/lib/sports';
import { SHOW_SMS_FEATURES } from '@/lib/features';
import { stanPush, wlaczPush, type StanPush } from '@/lib/push';
import ToggleRow from '@/components/ui/ToggleRow';
import WyborKiedy from '@/components/ui/WyborKiedy';
import PrzyciskMojaLokalizacja from '@/components/ui/PrzyciskMojaLokalizacja';
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
  defaultSport?: string;
  defaultRadiusKm?: number;
  defaultLat?: number;
  defaultLng?: number;
  defaultLabel?: string;
}

/**
 * Okno alertu o nowych meczach.
 *
 * DWA PYTANIA, NIE SIEDEM — 2026-09-14, zgłoszone wprost: „jak klikam
 * «powiadom mnie o takich meczach», to filtry już są, zostaje tylko kwestia
 * czy mailowo, czy SMS, czy notyfikacja i w jakim czasie. Resztę wywal,
 * w sensie filtry".
 *
 * Okno pytało wcześniej o sport, miejsce, promień, dni tygodnia i porę dnia —
 * czyli o to samo, co człowiek przed chwilą ustawił w filtrach, tyle że
 * drugi raz i w innych kontrolkach. Wejście do alertu prowadzi WPROST
 * z wyników tych filtrów (`domyslneZFiltrow`), więc odpowiedź już jest;
 * pytanie o nią jeszcze raz to nie „upewnienie się", tylko praca do wykonania
 * ponownie. Dziś filtry są POKAZANE (wiersz podsumowania, do przeczytania),
 * a wypełnia się wyłącznie:
 *
 *   1. **Kiedy** — jak długo powiadamiać (`expires_at`),
 *   2. **Czym dać znać** — mail, push, SMS.
 *
 * Kolumny `days_of_week`, `godzina_od`/`godzina_do` (migracja `149`) zostają
 * w bazie i w funkcji brzegowej nietknięte — okno po prostu przestało o nie
 * pytać. Gdyby wróciły, wrócą jako część FILTRÓW, wspólne dla listy i alertu,
 * a nie jako druga, osobna kopia pytania o termin.
 *
 * ALERT JEST DOMYŚLNIE BEZTERMINOWY (decyzja właściciela) — brak wyboru
 * w „Kiedy" znaczy właśnie to. Warunek jest jeden: musi dać się wyłączyć
 * z samej wiadomości, bez logowania. Stąd `wylacz_token` i trasa
 * `/alert/wylacz/[token]`.
 */
export default function AlertSetupDialog({
  onClose, onSaved, defaultSport, defaultRadiusKm, defaultLat, defaultLng, defaultLabel,
}: Props) {
  const { user } = useAuth();

  const [existing, setExisting] = useState<GameAlert | null>(null);
  const [sport] = useState(defaultSport ?? '');
  const [miejsce,  setMiejsce]  = useState<Miejscowosc | null>(
    defaultLat != null && defaultLng != null
      ? { nazwa: defaultLabel || 'Moja lokalizacja', kontekst: '', lat: defaultLat, lng: defaultLng }
      : null,
  );
  const [promienKm, setPromienKm] = useState(defaultRadiusKm ?? PROMIEN_DOMYSLNY);

  const [kiedy, setKiedy] = useState<DateFilter>('wszystkie');
  const [kanalEmail, setKanalEmail] = useState(true);
  const [push, setPush] = useState<StanPush | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => { stanPush().then(setPush).catch(() => setPush('nieobslugiwane')); }, []);

  // Istniejący alert wygrywa z wartościami przyniesionymi z filtrów — to jego
  // edycja, nie zakładanie nowego. Gdy alertu nie ma i nikt nie podał miejsca,
  // bierzemy pozycję, ale WYŁĄCZNIE przy już udzielonej zgodzie
  // (`pozycjaBezPytania`): samo otwarcie okna nie jest powodem, żeby
  // przeglądarka wyskoczyła z systemową prośbą o lokalizację.
  useEffect(() => {
    let zywe = true;
    (async () => {
      const a = user ? await getMyAlert().catch(() => null) : null;
      if (!zywe) return;
      if (a) {
        setExisting(a);
        setMiejsce({ nazwa: a.cityLabel || 'Wybrane miejsce', kontekst: '', lat: a.lat, lng: a.lng });
        setPromienKm(a.radiusKm);
        setKiedy(kiedyZWygasniecia(a.expiresAt));
        setKanalEmail(a.kanalEmail);
        return;
      }
      if (defaultLat != null) return;
      const poz = await pozycjaBezPytania();
      if (!zywe || !poz) return;
      setMiejsce({ nazwa: 'Moja lokalizacja', kontekst: '', lat: poz.lat, lng: poz.lng });
    })();
    return () => { zywe = false; };
    // `defaultLat` czytane raz, przy otwarciu — okno nie przestawia się w locie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSave = async () => {
    if (!user || !miejsce) return;
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
      const zapisany = await saveAlert(user.id, input);
      setExisting(zapisany);
      setSaved(true);
      onSaved?.(zapisany);
      setTimeout(onClose, 1200);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setDeleting(true);
    await deleteMyAlert(existing.id);
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
            <h2 className="text-base font-bold text-ink">
              {existing ? 'Twój alert na gierki' : 'Powiadom mnie o nowych meczach'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Zamknij" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* ── CZEGO SZUKAMY ── do PRZECZYTANIA, nie do wypełnienia. Wartości
              przychodzą z filtrów (`domyslneZFiltrow`), więc okno pokazuje je
              zamiast pytać o nie drugi raz. Wiersz zostaje, bo alert bez tego
              byłby obietnicą bez treści: nie wiadomo, czego ma pilnować. */}
          {!brakMiejsca && (
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {sport ? sportLabel(sport) : 'Dowolny sport'} · {miejsce.nazwa}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  W promieniu {promienKm} km · z Twoich filtrów
                </p>
              </div>
            </div>
          )}

          {brakMiejsca && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Nie wiemy jeszcze, gdzie szukać
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                Alert wyłapuje mecze po odległości od konkretnego punktu, więc
                bez niego nie ma od czego liczyć. Użyj swojej lokalizacji albo
                zamknij to okno i wskaż miejscowość w filtrach.
              </p>
              <PrzyciskMojaLokalizacja
                className="mt-3"
                etykieta="Użyj mojej lokalizacji"
                onPozycja={(lat, lng) =>
                  setMiejsce({ nazwa: 'Moja lokalizacja', kontekst: '', lat, lng })}
              />
            </div>
          )}

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
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || brakMiejsca}
              title={brakMiejsca ? 'Najpierw wskaż miejsce — alert szuka meczów w promieniu od niego' : undefined}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 py-3.5 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              {existing ? 'Zaktualizuj alert' : 'Zapisz alert'}
            </button>
          )}

          {existing && !saved && (
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
