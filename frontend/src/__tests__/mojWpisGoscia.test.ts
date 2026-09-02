import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { zapamietajWpisGoscia, mojWpisGoscia, zapomnijWpisGoscia } from '@/lib/mojWpisGoscia';

// Pamięć o własnym zapisie gościa. Cały sens tego modułu: token, który dotąd
// znikał razem z zamknięciem okna „Utwórz profil", ma przeżyć — bo jest jedyną
// drogą, jaką gość bez konta ma do sprawdzenia i zmiany swojego zapisu.

describe('mojWpisGoscia', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('zapamiętuje i oddaje token dla właściwego meczu', () => {
    zapamietajWpisGoscia('mecz-1', 'tok-1');
    expect(mojWpisGoscia('mecz-1')).toBe('tok-1');
  });

  it('nie miesza meczów — token jednego nie wycieka do drugiego', () => {
    zapamietajWpisGoscia('mecz-1', 'tok-1');
    expect(mojWpisGoscia('mecz-2')).toBeNull();
  });

  it('brak zapisu to null, nie wyjątek', () => {
    expect(mojWpisGoscia('mecz-nieznany')).toBeNull();
  });

  it('zapomina po wypisaniu się', () => {
    zapamietajWpisGoscia('mecz-1', 'tok-1');
    zapomnijWpisGoscia('mecz-1');
    expect(mojWpisGoscia('mecz-1')).toBeNull();
  });

  // Puste argumenty zdarzają się przy niepełnym stanie komponentu — zapis
  // pustego klucza zaśmieciłby `localStorage` wpisem, którego nikt nie odczyta.
  it('pusty token albo pusty mecz nic nie zapisuje', () => {
    zapamietajWpisGoscia('', 'tok-1');
    zapamietajWpisGoscia('mecz-1', '');
    expect(window.localStorage.length).toBe(0);
    expect(mojWpisGoscia('')).toBeNull();
  });
});

// Tryb prywatny i zablokowane dane witryn: `localStorage` RZUCA wyjątkiem,
// zamiast zwracać null. To jest funkcja pomocnicza — nie ma prawa wywrócić
// strony meczu, więc każdy dostęp jest w `try/catch`. Ta sama zasada co
// w `lib/push.ts` i `lib/instalacja.ts`.
describe('mojWpisGoscia — gdy localStorage rzuca', () => {
  const oryginal = window.localStorage;

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => { throw new Error('SecurityError'); }),
        setItem: vi.fn(() => { throw new Error('SecurityError'); }),
        removeItem: vi.fn(() => { throw new Error('SecurityError'); }),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: oryginal });
  });

  it('odczyt oddaje null zamiast wyjątku', () => {
    expect(() => mojWpisGoscia('mecz-1')).not.toThrow();
    expect(mojWpisGoscia('mecz-1')).toBeNull();
  });

  it('zapis i kasowanie milczą zamiast wywracać stronę', () => {
    expect(() => zapamietajWpisGoscia('mecz-1', 'tok-1')).not.toThrow();
    expect(() => zapomnijWpisGoscia('mecz-1')).not.toThrow();
  });
});
