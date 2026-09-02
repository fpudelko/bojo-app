import { describe, it, expect } from 'vitest';
import {
  wybierzPobliskie, etykietaOdleglosci, PROMIEN_POBLISKICH_KM, MAKS_POBLISKICH,
} from '@/lib/pobliskieObiekty';

// Reguła doboru pobliskich obiektów — sprawdzana bez bazy, tym samym wzorcem
// co `hubKatalogu.test.ts`.
//
// To jest zachowanie, którego NIE WIDAĆ w interfejsie na obiekcie testowym:
// żeby zobaczyć różnicę, trzeba mieć w bazie kilka obiektów tego samego sportu
// w promieniu ośmiu kilometrów. Bez tych asercji błąd w sortowaniu albo
// wpuszczenie obiektu bieżącego na własną listę przeszłyby niezauważone.

const OBIEKT = { id: 'ten', lat: 52.0, lng: 21.0 };

/** ~1 km na północ od punktu odniesienia (stopień szerokości to ~111 km). */
function oKm(km: number, id: string, name = `Boisko ${id}`) {
  return { id, name, sport: ['piłka nożna'], lat: 52.0 + km / 111, lng: 21.0 };
}

describe('wybierzPobliskie', () => {
  it('nie pokazuje obiektu, na którego stronie stoimy', () => {
    // Kadr zawsze zawiera punkt środkowy, więc bez tego filtra każda strona
    // linkowałaby sama do siebie.
    const wynik = wybierzPobliskie([oKm(0, 'ten'), oKm(2, 'inny')], OBIEKT);
    expect(wynik.map((o) => o.id)).toEqual(['inny']);
  });

  it('sortuje rosnąco po odległości, nie po kolejności z bazy', () => {
    const wynik = wybierzPobliskie([oKm(5, 'c'), oKm(1, 'a'), oKm(3, 'b')], OBIEKT);
    expect(wynik.map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });

  it('odrzuca obiekty spoza promienia, które wpadły przez rogi kwadratu', () => {
    // `kadrWokol()` zwraca KWADRAT — po przekątnej sięga ~1,41 × promień.
    // Bez przycięcia po realnej odległości lista mówiłaby „w okolicy"
    // o obiekcie odległym o jedenaście kilometrów.
    const wynik = wybierzPobliskie([oKm(7, 'blisko'), oKm(11, 'daleko')], OBIEKT);
    expect(wynik.map((o) => o.id)).toEqual(['blisko']);
  });

  it('odrzuca wiersze bez współrzędnych i bez nazwy — import z OSM bywa niekompletny', () => {
    const kandydaci = [
      { id: 'bez-lat', name: 'X', sport: ['piłka nożna'], lat: null, lng: 21.0 },
      { id: 'bez-nazwy', name: null, sport: ['piłka nożna'], lat: 52.01, lng: 21.0 },
      oKm(1, 'ok'),
    ];
    expect(wybierzPobliskie(kandydaci, OBIEKT).map((o) => o.id)).toEqual(['ok']);
  });

  it('przycina listę do limitu', () => {
    const kandydaci = Array.from({ length: 20 }, (_, i) => oKm(i * 0.2 + 0.1, `o${i}`));
    expect(wybierzPobliskie(kandydaci, OBIEKT)).toHaveLength(MAKS_POBLISKICH);
  });

  it('zwraca pustą listę, gdy w okolicy nie ma nic — sekcja ma wtedy zniknąć', () => {
    expect(wybierzPobliskie([], OBIEKT)).toEqual([]);
    expect(wybierzPobliskie([oKm(50, 'daleko')], OBIEKT)).toEqual([]);
  });

  it('liczy odległość, a nie tylko przepisuje wiersz', () => {
    const [o] = wybierzPobliskie([oKm(3, 'a')], OBIEKT);
    expect(o.odlegloscKm).toBeCloseTo(3, 1);
  });

  it('promień jest zasięgiem „pojadę tam zagrać", nie zasięgiem województwa', () => {
    // Gdyby ktoś podniósł tę stałą do kilkudziesięciu kilometrów, sekcja
    // przestałaby odpowiadać na pytanie człowieka oglądającego to boisko,
    // a stałaby się kolejnym hubem katalogu.
    expect(PROMIEN_POBLISKICH_KM).toBeLessThanOrEqual(15);
  });
});

describe('etykietaOdleglosci', () => {
  it('poniżej kilometra podaje metry', () => {
    expect(etykietaOdleglosci(0.44)).toBe('440 m');
  });

  it('powyżej kilometra podaje jedno miejsce po przecinku, po polsku', () => {
    // Druga cyfra sugerowałaby precyzję, której `fields.lat/lng` nie ma —
    // to środek obiektu z importu OSM, nie punkt wejścia.
    expect(etykietaOdleglosci(2.34)).toBe('2,3 km');
  });
});
