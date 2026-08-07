import { describe, it, expect } from 'vitest';
import { distanceKm } from '@/lib/geo';

// Punkty odniesienia
const POZNAN = { lat: 52.4064, lng: 16.9252 };
const WARSZAWA = { lat: 52.2297, lng: 21.0122 };
const GRUNWALDZKA = { lat: 52.4020, lng: 16.8900 };

describe('distanceKm', () => {
  it('ten sam punkt to zero', () => {
    expect(distanceKm(POZNAN.lat, POZNAN.lng, POZNAN.lat, POZNAN.lng)).toBe(0);
  });

  it('Poznań–Warszawa to około 279 km', () => {
    const d = distanceKm(POZNAN.lat, POZNAN.lng, WARSZAWA.lat, WARSZAWA.lng);
    expect(d).toBeGreaterThan(277);
    expect(d).toBeLessThan(281);
  });

  it('jest symetryczna', () => {
    const ab = distanceKm(POZNAN.lat, POZNAN.lng, WARSZAWA.lat, WARSZAWA.lng);
    const ba = distanceKm(WARSZAWA.lat, WARSZAWA.lng, POZNAN.lat, POZNAN.lng);
    expect(ab).toBeCloseTo(ba, 9);
  });

  it('krótki dystans w mieście liczy się w kilometrach, nie metrach', () => {
    // Centrum Poznania do Grunwaldzkiej — kilka kilometrów, nie kilka tysięcy.
    const d = distanceKm(POZNAN.lat, POZNAN.lng, GRUNWALDZKA.lat, GRUNWALDZKA.lng);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(5);
  });

  it('sortowanie po odległości ustawia bliższy punkt pierwszy', () => {
    const doGrunwaldzkiej = distanceKm(POZNAN.lat, POZNAN.lng, GRUNWALDZKA.lat, GRUNWALDZKA.lng);
    const doWarszawy = distanceKm(POZNAN.lat, POZNAN.lng, WARSZAWA.lat, WARSZAWA.lng);
    expect(doGrunwaldzkiej).toBeLessThan(doWarszawy);
  });
});
