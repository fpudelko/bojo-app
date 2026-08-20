import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));

import { RODZAJE_POWIADOMIEN, przelacz } from '@/lib/ustawieniaPowiadomien';

describe('przelacz', () => {
  it('wyłączenie dopisuje typ do listy wyłączonych', () => {
    expect(przelacz([], 'wiadomosc_w_meczu', false)).toEqual(['wiadomosc_w_meczu']);
  });

  it('włączenie usuwa typ z listy', () => {
    expect(przelacz(['wiadomosc_w_meczu', 'nowy_mecz_w_grupie'], 'wiadomosc_w_meczu', true))
      .toEqual(['nowy_mecz_w_grupie']);
  });

  it('dwukrotne wyłączenie nie dubluje wpisu', () => {
    // Bez tego dwa szybkie stuknięcia zostawiały ten sam typ dwa razy,
    // a licznik „N wyłączonych" pokazywał więcej, niż jest rodzajów.
    const raz = przelacz([], 'mecz_odwolany', false);
    expect(przelacz(raz, 'mecz_odwolany', false)).toEqual(['mecz_odwolany']);
  });

  it('włączenie czegoś, co nie było wyłączone, niczego nie psuje', () => {
    expect(przelacz(['mecz_odwolany'], 'wiadomosc_w_grupie', true)).toEqual(['mecz_odwolany']);
  });

  it('nie modyfikuje wejścia — stan Reacta zmienia się przez nową tablicę', () => {
    const przed = ['mecz_odwolany'];
    przelacz(przed, 'wiadomosc_w_meczu', false);
    expect(przed).toEqual(['mecz_odwolany']);
  });
});

describe('katalog rodzajów', () => {
  it('typy się nie powtarzają', () => {
    const typy = RODZAJE_POWIADOMIEN.map((r) => r.typ);
    expect(new Set(typy).size).toBe(typy.length);
  });

  it('rzeczy wymagające reakcji stoją na górze listy', () => {
    // Kolejność jest treścią: kto przewinie do połowy i przestanie czytać,
    // ma zobaczyć to, czego wyłączenie naprawdę boli.
    const pierwszeWazne = RODZAJE_POWIADOMIEN.findIndex((r) => r.wazne);
    const pierwszeZwykle = RODZAJE_POWIADOMIEN.findIndex((r) => !r.wazne);
    expect(pierwszeWazne).toBeLessThan(pierwszeZwykle);
  });

  it('każdy rodzaj ma opis — sama nazwa nie mówi, co się traci', () => {
    for (const r of RODZAJE_POWIADOMIEN) {
      expect(r.opis.length, r.typ).toBeGreaterThan(10);
    }
  });
});
