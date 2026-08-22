import { describe, it, expect } from 'vitest';
import { numerBlikZWiersza } from '@/lib/blik';

// Numer BLIK przyjeżdża jako OSADZONA relacja (`select('*, event_blik(blik_phone)')`),
// a nie kolumna wiersza — od migracji `120`, która wyjęła go z `events`, bo tę
// tabelę czyta każdy. Te testy pilnują jednego: że brak numeru (bo RLS go nie
// oddało) czyta się jako „nie ma", a nie jako pusty napis albo wyjątek.
describe('numerBlikZWiersza', () => {
  it('czyta numer z relacji jeden-do-jeden (obiekt)', () => {
    expect(numerBlikZWiersza({ event_blik: { blik_phone: '500 600 700' } })).toBe('500 600 700');
  });

  it('czyta numer podany jako tablica — PostgREST oddaje oba kształty', () => {
    expect(numerBlikZWiersza({ event_blik: [{ blik_phone: '500600700' }] })).toBe('500600700');
  });

  it('brak numeru dla kogoś spoza składu to undefined, nie pusty napis', () => {
    // Tak wygląda odpowiedź dla obcego: polityka odsiewa wiersz, osadzenie
    // zostaje puste. `undefined` włącza w UI zdanie „zobaczysz, jeśli dołączysz".
    expect(numerBlikZWiersza({ event_blik: null })).toBeUndefined();
    expect(numerBlikZWiersza({ event_blik: [] })).toBeUndefined();
  });

  it('mecz bez numeru i wiersz bez osadzenia to też undefined', () => {
    expect(numerBlikZWiersza({})).toBeUndefined();
    expect(numerBlikZWiersza(null)).toBeUndefined();
    expect(numerBlikZWiersza(undefined)).toBeUndefined();
  });

  it('sam biały znak to brak numeru', () => {
    expect(numerBlikZWiersza({ event_blik: { blik_phone: '   ' } })).toBeUndefined();
  });
});
