import { describe, it, expect } from 'vitest';
import {
  filtryZAdresu, filtryDoAdresu, FILTRY_DOMYSLNE, type FiltryListy,
} from '@/lib/filtryListy';

describe('filtry listy meczów w adresie', () => {
  it('nietknięte filtry dają PUSTY adres', () => {
    // Adres z kompletem parametrów przy domyślnych filtrach byłby nie do
    // wysłania komukolwiek, a przy okazji zamrażałby wartości domyślne
    // w linkach na zawsze.
    expect(filtryDoAdresu(FILTRY_DOMYSLNE)).toBe('');
  });

  it('jest odwracalne — adres → filtry → ten sam adres', () => {
    const f: FiltryListy = {
      sports: ['piłka nożna', 'siatkówka'],
      dateFilter: 'trzy-dni',
      radiusKm: 5,
      minFreeSpots: 4,
      sortBy: 'odleglosc',
      query: 'rataje',
    };
    const adres = filtryDoAdresu(f);
    expect(filtryZAdresu(adres)).toEqual(f);
    expect(filtryDoAdresu(filtryZAdresu(adres))).toBe(adres);
  });

  it('własny termin „do:" przechodzi przez adres bez zmiany', () => {
    const adres = filtryDoAdresu({ ...FILTRY_DOMYSLNE, dateFilter: 'do:2026-09-30' });
    expect(adres).toBe('?kiedy=do%3A2026-09-30');
    expect(filtryZAdresu(adres).dateFilter).toBe('do:2026-09-30');
  });

  it('NAZWY PARAMETRÓW SĄ WSPÓLNE Z `/mapa`', () => {
    // `sport` (powtarzalny) i `km` znaczą na obu ekranach to samo — jeden
    // adres nie ma prawa opisywać dwóch różnych rzeczy.
    const adres = filtryDoAdresu({ ...FILTRY_DOMYSLNE, sports: ['piłka nożna'], radiusKm: 25 });
    expect(adres).toContain('sport=');
    expect(adres).toContain('km=25');
  });

  it('domyślne „co najmniej 1 wolne miejsce" NIE ląduje w adresie', () => {
    expect(filtryDoAdresu({ ...FILTRY_DOMYSLNE, minFreeSpots: 1 })).toBe('');
    // …ale zejście do zera już tak, bo to świadome poszerzenie.
    expect(filtryDoAdresu({ ...FILTRY_DOMYSLNE, minFreeSpots: 0 })).toBe('?miejsca=0');
  });

  it('pusty i biały query nie brudzi adresu', () => {
    expect(filtryDoAdresu({ ...FILTRY_DOMYSLNE, query: '   ' })).toBe('');
  });
});

describe('śmieć w adresie wraca do wartości domyślnej, nie do pustej listy', () => {
  // Adres trafia do ludzi i do wyszukiwarek. Obcięty albo ręcznie skrócony
  // link nie ma prawa pokazać „brak meczów" zamiast listy.
  it('nieznane „kiedy" to „wszystkie terminy"', () => {
    expect(filtryZAdresu('?kiedy=nonsens').dateFilter).toBe('wszystkie');
    expect(filtryZAdresu('?kiedy=do:nie-data').dateFilter).toBe('wszystkie');
  });

  it('promień spoza skali odpada zamiast wyciąć wszystko', () => {
    expect(filtryZAdresu('?km=0').radiusKm).toBeNull();
    expect(filtryZAdresu('?km=500').radiusKm).toBeNull();
    expect(filtryZAdresu('?km=abc').radiusKm).toBeNull();
    expect(filtryZAdresu('?km=25').radiusKm).toBe(25);
  });

  it('nieznane sortowanie wraca na „najbliższy termin"', () => {
    expect(filtryZAdresu('?sort=cokolwiek').sortBy).toBe('termin');
    expect(filtryZAdresu('?sort=miejsca').sortBy).toBe('miejsca');
  });

  it('miejsca spoza zakresu wracają na jedynkę, nie na zero', () => {
    // Zero znaczy „pokaż też komplety" — to świadome poszerzenie filtra
    // i nie może wziąć się z literówki w adresie.
    expect(filtryZAdresu('?miejsca=-3').minFreeSpots).toBe(1);
    expect(filtryZAdresu('?miejsca=999').minFreeSpots).toBe(1);
    expect(filtryZAdresu('?miejsca=0').minFreeSpots).toBe(0);
  });

  it('pusty adres daje komplet wartości domyślnych', () => {
    expect(filtryZAdresu('')).toEqual(FILTRY_DOMYSLNE);
  });
});
