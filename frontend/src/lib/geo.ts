// Shared browser geolocation helper with specific, actionable error messages.

export type GeoErrorKind = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout';

export type GeoOutcome =
  | { ok: true;  lat: number; lng: number }
  | { ok: false; kind: GeoErrorKind };

export function geoErrorMessage(kind: GeoErrorKind): string {
  switch (kind) {
    case 'unsupported':
      return 'Twoja przeglądarka nie obsługuje lokalizacji. Wpisz miasto lub adres ręcznie.';
    case 'insecure':
      return 'Lokalizacja działa tylko na połączeniu HTTPS. Wpisz miasto lub adres ręcznie.';
    case 'denied':
      return 'Brak zgody na lokalizację. Zezwól w ustawieniach przeglądarki (ikona kłódki przy adresie) albo wpisz miasto ręcznie.';
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
        if (err.code === err.PERMISSION_DENIED)        resolve({ ok: false, kind: 'denied' });
        else if (err.code === err.POSITION_UNAVAILABLE) resolve({ ok: false, kind: 'unavailable' });
        else if (err.code === err.TIMEOUT)              resolve({ ok: false, kind: 'timeout' });
        else                                            resolve({ ok: false, kind: 'unavailable' });
      },
      // Low accuracy is faster & enough for "near me"; allow a cached fix up to 5 min.
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300_000 },
    );
  });
}
