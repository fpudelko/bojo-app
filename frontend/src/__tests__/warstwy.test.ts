import { describe, it, expect } from 'vitest';
import { WARSTWA } from '@/lib/warstwy';
import config from '../../tailwind.config';

// Klasy z `lib/warstwy.ts` są składane w komponentach ze zmiennej, a Tailwind
// wykrywa nazwy klas skanując pliki po tekście. Gdy `content` nie obejmuje
// `src/lib`, klasa NIE POWSTAJE w CSS — bez błędu, bez ostrzeżenia. Element
// zostaje wtedy bez z-indexu i modal ląduje pod paskiem „Dołącz" (`z-30`).
// Dokładnie to wydarzyło się na produkcji.
describe('skala warstw a konfiguracja Tailwinda', () => {
  it('każda warstwa jest na safelist — nie zależy od skanowania plików', () => {
    const safelist = (config.safelist ?? []) as string[];
    for (const klasa of Object.values(WARSTWA)) {
      expect(safelist, `brak ${klasa} na safelist w tailwind.config.ts`).toContain(klasa);
    }
  });

  it('content obejmuje src/lib', () => {
    const content = config.content as string[];
    expect(content.some((wzor) => wzor.includes('src/lib'))).toBe(true);
  });

  it('kolejność warstw: mapa < nawigacja < modal < toast', () => {
    const liczba = (klasa: string) => Number(klasa.match(/\[(\d+)\]/)![1]);
    expect(liczba(WARSTWA.nakladkaMapy)).toBeLessThan(liczba(WARSTWA.nawigacjaDolna));
    expect(liczba(WARSTWA.nawigacjaDolna)).toBeLessThan(liczba(WARSTWA.modal));
    expect(liczba(WARSTWA.modal)).toBeLessThanOrEqual(liczba(WARSTWA.modalPanel));
    expect(liczba(WARSTWA.modalPanel)).toBeLessThan(liczba(WARSTWA.toast));
  });
});
