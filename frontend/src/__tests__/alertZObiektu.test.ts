import { describe, it, expect } from 'vitest';
import { domyslneZObiektu } from '@/lib/alerts';
import { FOCUS_SPORTS } from '@/lib/sports';

// Czwarte wejście do alertu, dołożone 2026-09-21 na stronie obiektu — jedyne
// stojące tam, gdzie ląduje ruch z wyszukiwarki (980 z 1000 stron ze
// wyświetleniami to `/boisko/*`).
//
// Test pilnuje jednej rzeczy, której nie widać w interfejsie i która zepsułaby
// się po cichu: `field.sport` przychodzi z importu OSM i niesie wartości,
// których okno alertu nie umie pokazać na żadnym chipie.

const BOISKO = { sport: ['piłka nożna'], lat: 52.4, lng: 16.9, name: 'Orlik Rataje', city: 'Poznań' };

describe('domyslneZObiektu', () => {
  it('przepuszcza sporty, które okno alertu umie pokazać', () => {
    const d = domyslneZObiektu({ ...BOISKO, sport: ['piłka nożna', 'koszykówka'] });
    expect(d.sports).toEqual(['piłka nożna', 'koszykówka']);
    for (const s of d.sports) expect(FOCUS_SPORTS).toContain(s);
  });

  it('odsiewa sporty spoza FOCUS_SPORTS zamiast podawać je oknu', () => {
    // `wielofunkcyjne` to OSM-owe `sport=multi`, `piłka ręczna` jest dziedzictwem
    // ukrytym w filtrach. Ani jedno, ani drugie nie ma chipa w oknie alertu:
    // przekazane jako `defaultSports` dałoby zaznaczenie, którego nie widać
    // i nie da się odznaczyć.
    const d = domyslneZObiektu({ ...BOISKO, sport: ['wielofunkcyjne', 'piłka ręczna', 'siatkówka'] });
    expect(d.sports).toEqual(['siatkówka']);
  });

  it('obiekt bez rozpoznanego sportu daje alert na dowolny sport, nie pusty ekran', () => {
    // Pusta tablica znaczy w `AlertInput` „dowolny sport" i jest tu poprawnym
    // wynikiem: lepiej dostać za dużo, niż po cichu nie to.
    expect(domyslneZObiektu({ ...BOISKO, sport: ['inne'] }).sports).toEqual([]);
    expect(domyslneZObiektu({ ...BOISKO, sport: [] }).sports).toEqual([]);
  });

  it('celuje w to boisko, nie w miasto', () => {
    const d = domyslneZObiektu(BOISKO);
    expect(d.lat).toBe(BOISKO.lat);
    expect(d.lng).toBe(BOISKO.lng);
    // Promień musi być wartością ze skali suwaka, inaczej okno nie ma czego
    // pokazać przy edycji alertu.
    expect(d.radiusKm).toBeGreaterThan(0);
    expect(d.radiusKm).toBeLessThanOrEqual(10);
  });

  it('podpis niesie nazwę obiektu, żeby alert dało się rozpoznać na liście', () => {
    expect(domyslneZObiektu(BOISKO).label).toBe('Orlik Rataje, Poznań');
    // Obiekt bez miejscowości (import OSM bywa niekompletny) nie może zostawić
    // przecinka wiszącego na końcu.
    expect(domyslneZObiektu({ ...BOISKO, city: undefined }).label).toBe('Orlik Rataje');
  });
});
