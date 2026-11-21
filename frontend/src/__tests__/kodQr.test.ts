import { describe, it, expect } from 'vitest';
import { macierzQr, sciezkaQr } from '@/lib/kodQr';

// Kod QR na ekranie turnieju (2026-11-21). Nie dekodujemy kodu w teście,
// sprawdzamy to, co psuje skanowanie: kwadratową macierz i trzy wzorce
// pozycjonujące w rogach (bez nich telefon w ogóle nie rozpozna kodu).
describe('macierzQr', () => {
  const m = macierzQr('https://bojo.pl/turnieje/gramy-dla-marysi-28-11-2026');

  it('jest kwadratowa i ma rozmiar wersji QR (21 + 4k)', () => {
    expect(m.every((w) => w.length === m.length)).toBe(true);
    expect((m.length - 21) % 4).toBe(0);
  });

  it('ma wzorce pozycjonujące w trzech rogach', () => {
    const n = m.length;
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      // Ramka 7x7: pełny górny wiersz, środek 3x3 ciemny, pierścień jasny.
      expect(m[r].slice(c, c + 7).every(Boolean)).toBe(true);
      expect(m[r + 3][c + 3]).toBe(true);
      expect(m[r + 1][c + 1]).toBe(false);
    }
  });

  it('dłuższy adres daje większy kod, a ścieżka rysuje każdy ciemny moduł', () => {
    expect(macierzQr('https://bojo.pl/turnieje/' + 'x'.repeat(120)).length).toBeGreaterThan(m.length);
    const ciemne = m.flat().filter(Boolean).length;
    expect(sciezkaQr(m).match(/M/g)).toHaveLength(ciemne);
  });
});
