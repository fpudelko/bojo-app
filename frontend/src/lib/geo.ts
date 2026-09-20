// Shared browser geolocation helper with specific, actionable error messages.

export type GeoErrorKind =
  | 'unsupported'
  | 'insecure'
  | 'denied'            // strona zablokowana W przeglądarce
  | 'denied-system'     // przeglądarka chce, blokuje system/telefon
  | 'denied-dismissed'  // pytanie zamknięte bez odpowiedzi — ponowienie ma sens
  | 'denied-nieznane'   // odmowa, ale nie da się ustalić która
  | 'unavailable'
  | 'timeout';

export type GeoOutcome =
  | { ok: true;  lat: number; lng: number }
  | { ok: false; kind: GeoErrorKind };

/**
 * Komunikat mówi, GDZIE to odblokować — a to zależy od tego, kto odmówił.
 *
 * Wcześniej każda odmowa dostawała jedno zdanie o „ikonie kłódki przy adresie".
 * Zgłoszone z telefonu: człowiek CHCE udostępnić lokalizację, naciska przycisk
 * i dostaje instrukcję prowadzącą w miejsce, którego w jego przeglądarce nie ma
 * albo które niczego nie zmieni. Bo `PERMISSION_DENIED` znaczy trzy różne rzeczy:
 *
 * - strona zablokowana w przeglądarce → ustawienia strony,
 * - przeglądarka bez uprawnienia od systemu (Android: Ustawienia → Aplikacje →
 *   przeglądarka → Uprawnienia; iOS: Ustawienia → Prywatność → Usługi
 *   lokalizacji) → tam ustawienia strony nie pomogą W OGÓLE,
 * - pytanie zamknięte bez odpowiedzi → wystarczy nacisnąć drugi raz.
 *
 * Rozróżnia je `rodzajOdmowy()` niżej, pytając Permissions API PO odmowie.
 */
export function geoErrorMessage(kind: GeoErrorKind): string {
  switch (kind) {
    case 'unsupported':
      return 'Twoja przeglądarka nie obsługuje lokalizacji. Wpisz miasto lub adres ręcznie.';
    case 'insecure':
      return 'Lokalizacja działa tylko na połączeniu HTTPS. Wpisz miasto lub adres ręcznie.';
    case 'denied':
      return 'Ta strona ma zablokowaną lokalizację w przeglądarce. Odblokuj ją w ustawieniach strony (ikona po lewej stronie adresu) albo wpisz miasto ręcznie.';
    case 'denied-system':
      return 'To nie przeglądarka blokuje, lokalizacji nie ma zgody na poziomie telefonu. Daj przeglądarce dostęp do lokalizacji w ustawieniach telefonu (Android: Ustawienia → Aplikacje → przeglądarka → Uprawnienia; iPhone: Ustawienia → Prywatność → Usługi lokalizacji). Albo wpisz miasto ręcznie.';
    case 'denied-dismissed':
      return 'Pytanie o lokalizację zostało zamknięte bez odpowiedzi. Naciśnij jeszcze raz i wybierz „Zezwól", albo wpisz miasto ręcznie.';
    case 'denied-nieznane':
      return 'Brak zgody na lokalizację. Sprawdź dwa miejsca: ustawienia tej strony w przeglądarce ORAZ dostęp przeglądarki do lokalizacji w ustawieniach telefonu. Albo po prostu wpisz miasto ręcznie.';
    case 'unavailable':
      return 'Nie udało się ustalić pozycji. Sprawdź czy lokalizacja w telefonie jest włączona, albo wpisz miasto ręcznie.';
    case 'timeout':
      return 'Pobieranie lokalizacji trwało zbyt długo. Spróbuj ponownie lub wpisz miasto ręcznie.';
  }
}

/**
 * Odległość po powierzchni Ziemi (wzór haversine), w kilometrach.
 *
 * Wyciągnięte z app/admin/przeglad/page.tsx, gdzie żyło jako prywatne
 * `haversineM` — sortowanie "najbliżej mnie" na /wydarzenia potrzebuje tego
 * samego rachunku, a dwie kopie tego samego wzoru to dwie okazje do rozjazdu.
 */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // promień Ziemi w km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Resolve current position. Never rejects — returns a discriminated outcome
 * so callers can branch without try/catch.
 */
/**
 * Która to odmowa — pytamy Permissions API JUŻ PO `PERMISSION_DENIED`.
 *
 * Stan uprawnienia dla strony w zestawieniu z faktyczną odmową mówi, kto
 * zablokował:
 *
 * - `denied`  — to przeglądarka odmówiła za stronę (blokada zapamiętana),
 * - `granted` — strona MA zgodę, a mimo to pozycja nie przyszła: blokada jest
 *   poza przeglądarką, na poziomie telefonu. To jest ten przypadek, w którym
 *   stara instrukcja („ikona kłódki") prowadziła donikąd — w ustawieniach
 *   strony wszystko jest już na „tak",
 * - `prompt`  — pytanie było pokazane i zamknięte bez odpowiedzi; blokady nie
 *   ma, więc drugie naciśnięcie przycisku po prostu zadziała.
 *
 * Brak Permissions API (Safari < 16) albo wyjątek z zapytania → `nieznane`:
 * komunikat wymienia wtedy oba miejsca, zamiast zgadywać jedno.
 */
async function rodzajOdmowy(): Promise<GeoErrorKind> {
  if (typeof navigator === 'undefined' || !('permissions' in navigator)) return 'denied-nieznane';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state === 'denied')  return 'denied';
    if (status.state === 'granted') return 'denied-system';
    return 'denied-dismissed';
  } catch {
    return 'denied-nieznane';
  }
}

export function getCurrentLocation(): Promise<GeoOutcome> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({ ok: false, kind: 'unsupported' });
      return;
    }
    // Geolocation API requires a secure context (HTTPS or localhost)
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      resolve({ ok: false, kind: 'insecure' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          // Jedyne miejsce, w którym rozstrzygnięcie wymaga jeszcze jednego
          // zapytania. `rodzajOdmowy` nigdy nie rzuca, więc `then` wystarcza.
          rodzajOdmowy().then((kind) => resolve({ ok: false, kind }));
        }
        else if (err.code === err.POSITION_UNAVAILABLE) resolve({ ok: false, kind: 'unavailable' });
        else if (err.code === err.TIMEOUT)              resolve({ ok: false, kind: 'timeout' });
        else                                            resolve({ ok: false, kind: 'unavailable' });
      },
      // Low accuracy is faster & enough for "near me"; allow a cached fix up to 5 min.
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300_000 },
    );
  });
}

/**
 * Czy przeglądarka ma JUŻ udzieloną zgodę na lokalizację — bez pytania o nią.
 * Kropka „nowe wydarzenia w pobliżu" na dolnej nawigacji (patrz
 * `BottomNav.tsx`) sprawdza to przy każdej zmianie trasy; gdyby zamiast tego
 * wołała `getCurrentLocation()` wprost, wyskakiwałaby systemowa prośba o
 * zgodę bez żadnego kontekstu, komuś kto nigdy jej nie udzielił. Zwraca
 * `false` też tam, gdzie Permissions API nie istnieje (Safari < 16) — brak
 * kropki jest bezpieczniejszym fallbackiem niż proszenie o zgodę w tle.
 */
export async function hasGeolocationPermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('permissions' in navigator)) return false;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'granted';
  } catch {
    return false;
  }
}

/**
 * Położenie gracza, ale WYŁĄCZNIE gdy zgoda jest już udzielona.
 *
 * `null` znaczy „nie wiemy i nie pytamy". Prośba o lokalizację przy samym
 * wejściu na stronę, bez kontekstu, jest odruchowo odrzucana — a odrzuconej
 * zgody nie da się cofnąć inaczej niż w ustawieniach przeglądarki, więc jedno
 * niepotrzebne pytanie psuje tę drogę na trwałe. O zgodę prosi dopiero
 * przycisk, który człowiek nacisnął sam.
 */
export async function pozycjaBezPytania(): Promise<{ lat: number; lng: number } | null> {
  if (!(await hasGeolocationPermission())) return null;
  const res = await getCurrentLocation();
  return res.ok ? { lat: res.lat, lng: res.lng } : null;
}
