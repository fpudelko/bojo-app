import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  nazwaAlertu, opisAlertu, znajdzPodobnyAlert, maAktywnyAlert,
  logowanieDlaAlertu, zamiarAlertuZAdresu,
} from '@/lib/alerts';
import type { GameAlert } from '@/types';

const alert = (n: Partial<GameAlert> = {}): GameAlert => ({
  id: n.id ?? 'a1',
  userId: 'u1',
  daysOfWeek: [],
  lat: 51.1079,
  lng: 17.0385,
  radiusKm: 25,
  isActive: true,
  createdAt: '2026-09-15T10:00:00Z',
  kanalEmail: true,
  ...n,
});

describe('nazwa alertu — lista bez nazw jest nie do przeczytania', () => {
  it('składa sport, miejsce i promień', () => {
    expect(nazwaAlertu(alert({ sport: 'piłka nożna', cityLabel: 'Wrocław' })))
      .toBe('Piłka nożna · Wrocław 25 km');
  });

  it('bez sportu mówi „Wszystkie sporty", a nie zostawia pustki', () => {
    expect(nazwaAlertu(alert({ cityLabel: 'Poznań', radiusKm: 10 })))
      .toBe('Wszystkie sporty · Poznań 10 km');
  });

  it('bez etykiety miejsca nie pokazuje gołych współrzędnych', () => {
    // `cityLabel` bywa puste, gdy punkt wziął się z pinezki „moja lokalizacja".
    // Wiersz „Piłka nożna · 51.1079 25 km" byłby gorszy niż brak wiersza.
    expect(nazwaAlertu(alert({ sport: 'siatkówka', cityLabel: undefined })))
      .toBe('Siatkówka · Moja okolica 25 km');
    expect(nazwaAlertu(alert({ sport: 'siatkówka', cityLabel: '   ' })))
      .toBe('Siatkówka · Moja okolica 25 km');
  });
});

describe('opis alertu — druga linijka wiersza', () => {
  it('bez daty końca mówi „bezterminowo"', () => {
    expect(opisAlertu(alert())).toBe('bezterminowo · dzwonek i mail');
  });

  it('wyłączony mail widać w opisie, bo to realna różnica w doręczeniu', () => {
    expect(opisAlertu(alert({ kanalEmail: false }))).toBe('bezterminowo · tylko dzwonek');
  });

  it('data końca pokazuje się po polsku', () => {
    const iso = new Date(2026, 8, 30, 23, 59, 59).toISOString();
    expect(opisAlertu(alert({ expiresAt: iso }))).toBe('do 30.09.2026 · dzwonek i mail');
  });
});

describe('bliźniak — dwa takie same alerty to dwa maile o jednym meczu', () => {
  // `notify-game-alert` filtruje WSZYSTKIE aktywne alerty i nie deduplikuje po
  // użytkowniku. Przy jednym slocie problem nie istniał; odkąd alertów może
  // być wiele, powstaje przy trzecim nieuważnym dotknięciu „Powiadom o takich
  // meczach". Te asercje pilnują progu, przy którym pytamy.
  const wroclaw = { lat: 51.1079, lng: 17.0385 };

  it('ten sam sport i ten sam punkt to bliźniak', () => {
    const istniejace = [alert({ sport: 'piłka nożna', cityLabel: 'Wrocław' })];
    const znaleziony = znajdzPodobnyAlert(istniejace, { sport: 'piłka nożna', ...wroclaw, radiusKm: 25 });
    expect(znaleziony?.id).toBe('a1');
  });

  it('inny sport w tym samym miejscu to NIE bliźniak', () => {
    const istniejace = [alert({ sport: 'piłka nożna' })];
    expect(znajdzPodobnyAlert(istniejace, { sport: 'siatkówka', ...wroclaw, radiusKm: 25 })).toBeNull();
  });

  it('„wszystkie sporty" nie zlewa się z konkretnym sportem', () => {
    // Alert bez sportu łapie WIĘCEJ niż alert na piłkę, więc to dwie różne
    // rzeczy — pytanie „masz już taki" byłoby tu nieprawdą.
    const istniejace = [alert({ sport: undefined })];
    expect(znajdzPodobnyAlert(istniejace, { sport: 'piłka nożna', ...wroclaw, radiusKm: 25 })).toBeNull();
  });

  it('próg skaluje się z promieniem — przy 25 km trzy kilometry to to samo miejsce', () => {
    const istniejace = [alert({ sport: 'piłka nożna', radiusKm: 25 })];
    // ~3 km na północ od punktu alertu.
    const blisko = { lat: 51.135, lng: 17.0385 };
    expect(znajdzPodobnyAlert(istniejace, { sport: 'piłka nożna', ...blisko, radiusKm: 25 })?.id).toBe('a1');
  });

  it('…ale przy 2 km te same trzy kilometry to już inne miejsce', () => {
    const istniejace = [alert({ sport: 'piłka nożna', radiusKm: 2 })];
    const blisko = { lat: 51.135, lng: 17.0385 };
    expect(znajdzPodobnyAlert(istniejace, { sport: 'piłka nożna', ...blisko, radiusKm: 2 })).toBeNull();
  });

  it('EDYTOWANY alert nie jest bliźniakiem samego siebie', () => {
    // Bez `pomijajId` zapisanie zmiany w istniejącym alercie pytałoby
    // „masz już taki" — wskazując na ten, który się właśnie edytuje.
    const istniejace = [alert({ id: 'a1', sport: 'piłka nożna' })];
    expect(znajdzPodobnyAlert(istniejace, { sport: 'piłka nożna', ...wroclaw, radiusKm: 25 }, 'a1')).toBeNull();
  });
});

describe('maAktywnyAlert', () => {
  it('wyłączone alerty nie zapalają ikony w pasku', () => {
    expect(maAktywnyAlert([alert({ isActive: false })])).toBe(false);
    expect(maAktywnyAlert([alert({ isActive: false }), alert({ id: 'a2' })])).toBe(true);
    expect(maAktywnyAlert([])).toBe(false);
  });
});

describe('zapis nowego alertu NIE gasi poprzednich', () => {
  // To jest sedno zmiany z 2026-09-15 i najłatwiejsza rzecz do cofnięcia przez
  // nieuwagę: jedna linijka `update({ is_active: false })` przed `insert`
  // wracała do stanu „jeden alert na konto", w którym założenie alertu na
  // siatkówkę po cichu kasowało ten na piłkę. Test czyta źródło, bo sprawdzana
  // rzecz to NIEOBECNOŚĆ zapytania — atrapa Supabase pokazałaby tylko to,
  // co sama udaje. Ten sam wzorzec co `maskiZrzutow.test.ts`.
  const zrodlo = readFileSync(join(process.cwd(), 'src/lib/alerts.ts'), 'utf8');
  const saveAlertCialo = zrodlo.slice(
    zrodlo.indexOf('export async function saveAlert'),
    zrodlo.indexOf('export async function zaktualizujAlert'),
  );

  it('`saveAlert` nie zawiera masowego wyłączania cudzych wierszy', () => {
    expect(saveAlertCialo).not.toContain('is_active: false');
    expect(saveAlertCialo).not.toContain("eq('is_active', true)");
  });

  it('edycja idzie osobną funkcją, nie „skasuj i wstaw"', () => {
    // `id` wskazuje `notifications.alert_id`, a `wylacz_token` siedzi w już
    // wysłanych mailach — nowy wiersz przy każdej edycji unieważniałby
    // wszystkie linki „nie chcę więcej" z dotychczasowej korespondencji.
    expect(zrodlo).toContain('export async function zaktualizujAlert');
    expect(zrodlo).toContain('zaktualizujJedenWiersz');
  });
});

describe('zamiar alertu przeżywa logowanie', () => {
  it('adres logowania niesie filtry i powód', () => {
    const cel = logowanieDlaAlertu('/wydarzenia?sport=pi%C5%82ka+no%C5%BCna&kiedy=dzisiaj');
    expect(cel).toContain('powod=alert');
    const next = decodeURIComponent(new URLSearchParams(cel.split('?')[1]).get('next')!);
    expect(next).toContain('sport=');
    expect(next).toContain('kiedy=dzisiaj');
    expect(next).toContain('alert=1');
  });

  it('działa też dla adresu bez żadnych filtrów', () => {
    const cel = logowanieDlaAlertu('/mapa');
    expect(decodeURIComponent(cel.split('next=')[1])).toBe('/mapa?alert=1');
  });

  it('odczyt zdejmuje znacznik, żeby okno nie wracało przy odświeżeniu', () => {
    // Bez zdjęcia `alert=1` powrót przyciskiem „wstecz" albo odświeżenie
    // otwierałyby okno w kółko, długo po tym, jak ktoś je zamknął.
    const { otworz, adres } = zamiarAlertuZAdresu('/wydarzenia?sport=x&alert=1');
    expect(otworz).toBe(true);
    expect(adres).toBe('/wydarzenia?sport=x');
  });

  it('bez znacznika nic się nie otwiera, a adres zostaje nietknięty', () => {
    const { otworz, adres } = zamiarAlertuZAdresu('/wydarzenia?sport=x');
    expect(otworz).toBe(false);
    expect(adres).toBe('/wydarzenia?sport=x');
  });

  it('sam znacznik zostawia czystą ścieżkę, bez wiszącego znaku zapytania', () => {
    expect(zamiarAlertuZAdresu('/mapa?alert=1').adres).toBe('/mapa');
  });
});
