import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { zapamietajPowrot, odbierzPowrot, bezpiecznyCel, kanonicznyOrigin } from '@/lib/powrotPoLogowaniu';

beforeEach(() => { sessionStorage.clear(); vi.useRealTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('bezpiecznyCel', () => {
  it('przepuszcza ścieżki względne', () => {
    expect(bezpiecznyCel('/gracz/przejmij/abc')).toBe(true);
  });

  // Bez tego zapamiętany cel byłby otwartym przekierowaniem: `//zlo.example`
  // przeglądarka czyta jako adres z innym hostem, mimo wiodącego ukośnika.
  it('odrzuca adresy prowadzące poza witrynę', () => {
    expect(bezpiecznyCel('//zlo.example/phishing')).toBe(false);
    expect(bezpiecznyCel('https://zlo.example')).toBe(false);
    expect(bezpiecznyCel('')).toBe(false);
    expect(bezpiecznyCel(undefined)).toBe(false);
  });
});

describe('zapamietajPowrot / odbierzPowrot', () => {
  it('oddaje zapamiętany cel', () => {
    zapamietajPowrot('/gracz/przejmij/xyz');
    expect(odbierzPowrot()).toBe('/gracz/przejmij/xyz');
  });

  // Kasujemy przy odbiorze, żeby nieudany skok nie rzucał użytkownikiem
  // w bok przy każdym kolejnym wejściu na stronę główną.
  it('oddaje cel tylko raz', () => {
    zapamietajPowrot('/wydarzenia/1');
    expect(odbierzPowrot()).toBe('/wydarzenia/1');
    expect(odbierzPowrot()).toBeNull();
  });

  it('nie zapamiętuje celu spoza witryny', () => {
    zapamietajPowrot('https://zlo.example');
    expect(odbierzPowrot()).toBeNull();
  });

  it('zapomina cel starszy niż kwadrans', () => {
    zapamietajPowrot('/grupy');
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(odbierzPowrot()).toBeNull();
  });

  it('znosi uszkodzoną zawartość pamięci', () => {
    sessionStorage.setItem('bojo:powrot-po-logowaniu', 'to nie jest JSON');
    expect(odbierzPowrot()).toBeNull();
  });
});

describe('kanonicznyOrigin', () => {
  it('ucina www — domeną kanoniczną jest bojo.pl', () => {
    expect(kanonicznyOrigin('https://www.bojo.pl')).toBe('https://bojo.pl');
    expect(kanonicznyOrigin('http://www.bojo.pl')).toBe('http://bojo.pl');
  });

  it('nie rusza adresów bez www', () => {
    expect(kanonicznyOrigin('https://bojo.pl')).toBe('https://bojo.pl');
    expect(kanonicznyOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    expect(kanonicznyOrigin('https://bojo-app.vercel.app')).toBe('https://bojo-app.vercel.app');
  });

  // „www" w środku nazwy to nie prefiks hosta.
  it('nie ucina www z wnętrza nazwy', () => {
    expect(kanonicznyOrigin('https://wwwbojo.pl')).toBe('https://wwwbojo.pl');
  });
});
