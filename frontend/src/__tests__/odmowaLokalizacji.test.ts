import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCurrentLocation, geoErrorMessage, type GeoErrorKind } from '@/lib/geo';

/**
 * Odmowa lokalizacji ma trzy różne przyczyny i trzy różne drogi wyjścia.
 *
 * Zgłoszone z telefonu: „ciągle nie działa, jak chce się udostępnić
 * lokalizację" — przycisk oddawał jeden komunikat („ikona kłódki przy
 * adresie") na wszystko, więc przy blokadzie na poziomie TELEFONU instrukcja
 * prowadziła w miejsce, w którym wszystko było już ustawione na „tak".
 */

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

function bladGeo(code: number) {
  return { code, PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT };
}

/** Podstawia `navigator.geolocation` oddający zawsze ten sam błąd. */
function geolokalizacjaOdmawia(code: number) {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (_ok: unknown, err: (e: unknown) => void) => err(bladGeo(code)),
    },
  });
}

/** Podstawia Permissions API; `null` = przeglądarka bez niego (Safari < 16). */
function uprawnieniaMowia(state: 'granted' | 'denied' | 'prompt' | 'rzuca' | null) {
  if (state === null) {
    // @ts-expect-error — celowo usuwamy API, którego stare przeglądarki nie mają
    delete globalThis.navigator.permissions;
    return;
  }
  Object.defineProperty(globalThis.navigator, 'permissions', {
    configurable: true,
    value: {
      query: state === 'rzuca'
        ? () => Promise.reject(new Error('TypeError: geolocation'))
        : () => Promise.resolve({ state }),
    },
  });
}

const oryginalneUprawnienia = Object.getOwnPropertyDescriptor(globalThis.navigator, 'permissions');

describe('rozpoznanie przyczyny odmowy lokalizacji', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.window, 'isSecureContext', { configurable: true, value: true });
  });

  afterEach(() => {
    if (oryginalneUprawnienia) {
      Object.defineProperty(globalThis.navigator, 'permissions', oryginalneUprawnienia);
    }
    vi.restoreAllMocks();
  });

  it('blokada zapamiętana przez przeglądarkę to zwykłe „denied"', async () => {
    geolokalizacjaOdmawia(PERMISSION_DENIED);
    uprawnieniaMowia('denied');
    expect(await getCurrentLocation()).toEqual({ ok: false, kind: 'denied' });
  });

  it('zgoda dla strony + odmowa pozycji znaczy blokadę POZA przeglądarką', async () => {
    // Android: przeglądarka bez uprawnienia do lokalizacji w ustawieniach
    // telefonu. Strona ma „granted", a pozycja i tak nie przychodzi.
    geolokalizacjaOdmawia(PERMISSION_DENIED);
    uprawnieniaMowia('granted');
    expect(await getCurrentLocation()).toEqual({ ok: false, kind: 'denied-system' });
  });

  it('stan „prompt" znaczy zamknięte pytanie, nie blokadę', async () => {
    geolokalizacjaOdmawia(PERMISSION_DENIED);
    uprawnieniaMowia('prompt');
    expect(await getCurrentLocation()).toEqual({ ok: false, kind: 'denied-dismissed' });
  });

  it('bez Permissions API nie zgadujemy — „nieznane"', async () => {
    geolokalizacjaOdmawia(PERMISSION_DENIED);
    uprawnieniaMowia(null);
    expect(await getCurrentLocation()).toEqual({ ok: false, kind: 'denied-nieznane' });
  });

  it('wyjątek z Permissions API też daje „nieznane", nie wywraca przycisku', async () => {
    geolokalizacjaOdmawia(PERMISSION_DENIED);
    uprawnieniaMowia('rzuca');
    expect(await getCurrentLocation()).toEqual({ ok: false, kind: 'denied-nieznane' });
  });

  it('inne błędy nie pytają o uprawnienia i zostają sobą', async () => {
    uprawnieniaMowia('granted');
    geolokalizacjaOdmawia(POSITION_UNAVAILABLE);
    expect(await getCurrentLocation()).toEqual({ ok: false, kind: 'unavailable' });
    geolokalizacjaOdmawia(TIMEOUT);
    expect(await getCurrentLocation()).toEqual({ ok: false, kind: 'timeout' });
  });
});

describe('komunikaty o odmowie', () => {
  const wszystkie: GeoErrorKind[] = [
    'unsupported', 'insecure', 'denied', 'denied-system',
    'denied-dismissed', 'denied-nieznane', 'unavailable', 'timeout',
  ];

  it('każdy rodzaj ma własny, niepusty komunikat', () => {
    const teksty = wszystkie.map(geoErrorMessage);
    expect(teksty.every((t) => t.length > 0)).toBe(true);
    expect(new Set(teksty).size).toBe(wszystkie.length);
  });

  it('każdy komunikat zostawia drogę ręczną — wpisanie miasta', () => {
    for (const kind of wszystkie) {
      expect(geoErrorMessage(kind).toLowerCase()).toContain('miasto');
    }
  });

  it('blokada systemowa NIE odsyła do ustawień strony w przeglądarce', () => {
    // Sedno zgłoszenia: tam wszystko jest już na „tak", więc ta rada
    // zapętlała człowieka, który chciał udostępnić lokalizację.
    const tekst = geoErrorMessage('denied-system');
    expect(tekst).not.toMatch(/kłódk/i);
    expect(tekst).toMatch(/ustawieni\w+ telefonu/i);
  });

  it('blokada w przeglądarce odsyła do ustawień strony, nie telefonu', () => {
    expect(geoErrorMessage('denied')).toMatch(/ustawieni\w+ strony/i);
  });

  it('zamknięte pytanie namawia na ponowne naciśnięcie', () => {
    expect(geoErrorMessage('denied-dismissed')).toMatch(/jeszcze raz|ponown/i);
  });
});
