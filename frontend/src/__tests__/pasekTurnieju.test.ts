import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
import { trescPaska, kluczUkrycia, type TurniejNaPasku } from '@/lib/pasekTurnieju';

const baza: TurniejNaPasku = {
  id: 't1', nazwa: 'Gramy dla Marysi', miasto: 'Luboń', status: 'trwa',
  dataStartu: '2026-11-28', godzinaStartu: '10:00',
  mojaDruzynaId: null, mojaDruzynaNazwa: null,
  naZywo: null, nastepnyAt: null, nastepnyBoisko: null, nastepnyRywal: null,
};

describe('pasek „trwa turniej” (migracja 198)', () => {
  it('bez turniejów nie ma paska', () => {
    expect(trescPaska([])).toBeNull();
  });

  it('obcy: nazwa, miasto, wynik na żywo i wejście „Znajdź swoją drużynę”', () => {
    const t = trescPaska([{ ...baza, naZywo: 'Orły 2:1 Sokoły' }])!;
    expect(t.naglowek).toBe('Trwa turniej Gramy dla Marysi · Luboń');
    expect(t.szczegol).toBe('Na żywo: Orły 2:1 Sokoły');
    expect(t.link).toBe('/turnieje/t1');
    expect(t.linkZnajdz).toBe('/turnieje/t1/jestem');
  });

  it('turniej, który dopiero dziś startuje, mówi „Dziś” i godzinę', () => {
    const t = trescPaska([{ ...baza, status: 'zamkniete_zapisy' }])!;
    expect(t.naglowek).toBe('Dziś turniej Gramy dla Marysi · Luboń, start 10:00');
  });

  it('zawodnik: jego drużyna, następny mecz w czasie polskim, bez „Znajdź”', () => {
    const t = trescPaska([{
      ...baza, mojaDruzynaId: 'd1', mojaDruzynaNazwa: 'Orły',
      // 13:20 UTC = 14:20 w Warszawie (listopad, CET)
      nastepnyAt: '2026-11-28T13:20:00+00:00', nastepnyBoisko: 'Boisko 2', nastepnyRywal: 'Sokoły',
      naZywo: 'Inne 0:0 Mecz',
    }])!;
    expect(t.naglowek).toBe('Twoja drużyna: Orły · Gramy dla Marysi');
    expect(t.szczegol).toBe('Następny mecz z Sokoły: 14:20, Boisko 2');
    expect(t.link).toBe('/turnieje/t1/druzyna/d1');
    expect(t.linkZnajdz).toBeNull();
  });

  it('kilka naraz: pierwszy z listy i „+N inne”; ukryty krzyżykiem przepuszcza następny', () => {
    const lista = [baza, { ...baza, id: 't2', nazwa: 'Puchar Wiosny' }, { ...baza, id: 't3' }];
    expect(trescPaska(lista)!.ileInnych).toBe(2);
    const poUkryciu = trescPaska(lista, new Set(['t1']))!;
    expect(poUkryciu.naglowek).toContain('Puchar Wiosny');
    expect(poUkryciu.ileInnych).toBe(1);
  });

  it('ukrycie jest na jeden dzień, per turniej', () => {
    expect(kluczUkrycia('t1', '2026-11-28')).not.toBe(kluczUkrycia('t1', '2026-11-29'));
    expect(kluczUkrycia('t1', '2026-11-28')).not.toBe(kluczUkrycia('t2', '2026-11-28'));
  });
});
