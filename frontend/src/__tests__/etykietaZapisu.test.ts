import { describe, it, expect } from 'vitest';
import { etykietaZapisu } from '@/lib/time';

// Zegar wstrzykiwany, nie zamrażany globalnie — te testy mają przetrwać
// przełom roku i zmianę czasu bez dotykania konfiguracji.
const TERAZ = new Date(2026, 7, 18, 12, 0); // wt, 18 sierpnia 2026, 12:00

describe('etykietaZapisu', () => {
  it('dzisiaj pokazuje godzinę', () => {
    expect(etykietaZapisu(new Date(2026, 7, 18, 18, 42).toISOString(), TERAZ)).toBe('dziś 18:42');
  });

  it('wczoraj liczy się po dniu kalendarzowym, nie po 24 godzinach', () => {
    // 23:50 poprzedniego dnia oglądane o 12:00 to „wczoraj", mimo że minęło
    // tylko 12 godzin.
    expect(etykietaZapisu(new Date(2026, 7, 17, 23, 50).toISOString(), TERAZ)).toBe('wczoraj 23:50');
  });

  it('w ciągu tygodnia pokazuje dzień tygodnia z godziną', () => {
    // 15 sierpnia 2026 to sobota.
    expect(etykietaZapisu(new Date(2026, 7, 15, 14, 32).toISOString(), TERAZ)).toBe('sob 14:32');
  });

  it('starsze niż tydzień pokazuje samą datę — godzina przestaje coś znaczyć', () => {
    expect(etykietaZapisu(new Date(2026, 6, 30, 14, 32).toISOString(), TERAZ)).toBe('30 lip');
  });

  it('dopełnia zerem jednocyfrową godzinę i minutę', () => {
    expect(etykietaZapisu(new Date(2026, 7, 18, 9, 5).toISOString(), TERAZ)).toBe('dziś 09:05');
  });

  it('brak daty i śmieci nie renderują nic zamiast "Invalid Date"', () => {
    expect(etykietaZapisu(undefined, TERAZ)).toBe('');
    expect(etykietaZapisu(null, TERAZ)).toBe('');
    expect(etykietaZapisu('', TERAZ)).toBe('');
    expect(etykietaZapisu('nie-data', TERAZ)).toBe('');
  });
});
