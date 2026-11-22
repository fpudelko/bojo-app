import { describe, it, expect } from 'vitest';
import { adresEkranu, ukladyNaZmiane, przerwaTeraz, czyUkladEkranu, adresDoPodpisu, UKLADY_EKRANU } from '@/lib/ekranTurnieju';

// Ekran turnieju na halę: adres z układem i motywem, układy „Na zmianę”
// i przerwa w toku. Czyste funkcje, bo ekran sprawdza się dopiero w hali.
describe('adresEkranu', () => {
  it('domyślny układ i ciemny motyw nie trafiają do adresu', () => {
    expect(adresEkranu('gramy-dla-marysi')).toBe('/turnieje/gramy-dla-marysi/ekran');
    expect(adresEkranu('x', { uklad: 'wszystko', motyw: 'ciemny' })).toBe('/turnieje/x/ekran');
  });
  it('układ i jasny motyw w adresie', () => {
    expect(adresEkranu('x', { uklad: 'tabele', motyw: 'jasny' })).toBe('/turnieje/x/ekran?uklad=tabele&motyw=jasny');
  });
});

describe('ukladyNaZmiane', () => {
  it('pomija układy bez treści', () => {
    expect(ukladyNaZmiane({ maMecz: true, maTabele: false, maTerminarz: true, maOgloszenie: false })).toEqual(['wynik', 'terminarz']);
  });
  it('z pustym turniejem zostaje „Wszystko”, nie pusta rotacja', () => {
    expect(ukladyNaZmiane({ maMecz: false, maTabele: false, maTerminarz: false, maOgloszenie: false })).toEqual(['wszystko']);
  });
});

describe('przerwaTeraz', () => {
  const przerwy = [{ odAt: '2026-11-28T10:44:00Z', doAt: '2026-11-28T12:00:00Z', nazwa: 'Licytacje' }];
  it('zwraca przerwę trwającą teraz, poza nią null', () => {
    expect(przerwaTeraz(przerwy, new Date('2026-11-28T11:00:00Z'))?.nazwa).toBe('Licytacje');
    expect(przerwaTeraz(przerwy, new Date('2026-11-28T12:00:00Z'))).toBeNull();
  });
});

describe('pozostałe', () => {
  it('rozpoznaje układy i przycina adres do podpisu', () => {
    expect(czyUkladEkranu('ogloszenie')).toBe(true);
    expect(czyUkladEkranu('cokolwiek')).toBe(false);
    expect(adresDoPodpisu('https://zrzutka.pl/marysia/')).toBe('zrzutka.pl/marysia');
    expect(new Set(UKLADY_EKRANU.map((u) => u.klucz)).size).toBe(UKLADY_EKRANU.length);
  });
});

describe('podgladUkladu', () => {
  it('każdy układ poza „Na zmianę” ma miniaturę w obu motywach w public/', async () => {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { podgladUkladu } = await import('@/lib/ekranTurnieju');
    for (const u of UKLADY_EKRANU.map((x) => x.klucz).filter((k) => k !== 'zmiana')) {
      for (const m of ['ciemny', 'jasny'] as const) {
        const sciezka = join(process.cwd(), 'public', podgladUkladu(u as Exclude<typeof u, 'zmiana'>, m));
        expect(existsSync(sciezka), sciezka).toBe(true);
      }
    }
  });
});
