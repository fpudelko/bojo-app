import { describe, it, expect } from 'vitest';
import { odcisk } from '@/lib/bledy';

// Odcisk decyduje o tym, czy dwa błędy to ten sam wiersz w panelu, czy dwa.
// Za mocne grupowanie chowa różne problemy pod jednym wpisem; za słabe robi
// z panelu listę tysiąca kopii tego samego. Stąd te przypadki.
describe('odcisk błędu', () => {
  const stos = `Error: Failed to fetch
    at pobierzMecz (/_next/static/chunks/a1b2c3d4e5f6.js:12:345)
    at load (/_next/static/chunks/a1b2c3d4e5f6.js:99:12)`;

  it('ten sam błąd z tego samego miejsca ma ten sam odcisk', () => {
    expect(odcisk('Failed to fetch', stos)).toBe(odcisk('Failed to fetch', stos));
  });

  it('ten sam komunikat z INNEGO miejsca to inny błąd', () => {
    // „Failed to fetch" z pięciu różnych zapytań to pięć różnych problemów —
    // grupowanie po samym komunikacie zlepiłoby je w jeden.
    const inny = `Error: Failed to fetch
    at zapiszWynik (/_next/static/chunks/a1b2c3d4e5f6.js:44:1)`;
    expect(odcisk('Failed to fetch', stos)).not.toBe(odcisk('Failed to fetch', inny));
  });

  it('inny komunikat z tego samego miejsca to inny błąd', () => {
    expect(odcisk('Failed to fetch', stos)).not.toBe(odcisk('Timeout', stos));
  });

  it('nowy build NIE zakłada nowego wiersza', () => {
    // Nazwy paczek Next zawierają hash builda, a numery linii zmieniają się
    // po każdej zmianie w pliku. Bez ich zdjęcia panel zapełniałby się od nowa
    // po KAŻDYM wdrożeniu, a licznik wystąpień — najważniejsza liczba przy
    // awarii — resetowałby się do jedynki.
    const poDeployu = `Error: Failed to fetch
    at pobierzMecz (/_next/static/chunks/9f8e7d6c5b4a.js:15:400)
    at load (/_next/static/chunks/9f8e7d6c5b4a.js:120:8)`;
    expect(odcisk('Failed to fetch', poDeployu)).toBe(odcisk('Failed to fetch', stos));
  });

  it('radzi sobie z błędem bez stosu', () => {
    expect(() => odcisk('Coś padło')).not.toThrow();
    expect(odcisk('Coś padło')).toContain('Coś padło');
  });

  it('ucina bardzo długi komunikat', () => {
    // Bez tego jeden błąd z wklejonym całym JSON-em rozdmuchałby klucz
    // indeksu w bazie.
    const dlugi = 'x'.repeat(5000);
    expect(odcisk(dlugi).length).toBeLessThan(500);
  });
});
