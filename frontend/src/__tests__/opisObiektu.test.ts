import { describe, it, expect } from 'vitest';
import { zdanieORozegranychMeczach } from '@/content/opisObiektu';

// F3 SEO/GEO (roadmapa poz. 21): ślad rozegranych meczów na stronie obiektu.
// Odmiana przez liczbę ma trzy niezależne miejsca (czasownik, liczebnik,
// przymiotnik) — łatwo o rozjazd, stąd test na kilku reprezentatywnych liczbach,
// w tym pułapkę 12-14 (patrz lib/plural.ts).

describe('zdanieORozegranychMeczach', () => {
  it('zwraca null przy zerze — brak danych nie jest faktem do pokazania', () => {
    expect(zdanieORozegranychMeczach(0)).toBeNull();
  });

  it('liczba pojedyncza dla jednego meczu', () => {
    expect(zdanieORozegranychMeczach(1)).toBe(
      'Na tym obiekcie odbył się już 1 mecz zorganizowany przez Bojo.',
    );
  });

  it('forma "few" dla 2-4', () => {
    expect(zdanieORozegranychMeczach(3)).toBe(
      'Na tym obiekcie odbyły się już 3 mecze zorganizowane przez Bojo.',
    );
  });

  it('forma "many" dla 5+', () => {
    expect(zdanieORozegranychMeczach(5)).toBe(
      'Na tym obiekcie odbyło się już 5 meczów zorganizowanych przez Bojo.',
    );
  });

  it('wyjątek 12-14 bierze formę "many" mimo końcówki 2-4', () => {
    expect(zdanieORozegranychMeczach(13)).toBe(
      'Na tym obiekcie odbyło się już 13 meczów zorganizowanych przez Bojo.',
    );
  });

  it('22 wraca do formy "few" (końcówka 2, poza wyjątkiem 12-14)', () => {
    expect(zdanieORozegranychMeczach(22)).toBe(
      'Na tym obiekcie odbyły się już 22 mecze zorganizowane przez Bojo.',
    );
  });

  // Fosa F4 (docs/seo-geo-strategia.md, rozdział 8): sama liczba nie mówi,
  // czy na obiekcie GRA SIĘ dziś, czy grało się rok temu. `ostatniaData`
  // dokłada świeżość — opcjonalnie, więc wszystkie testy wyżej (bez tego
  // argumentu) muszą dalej przechodzić bez zmian.
  it('bez ostatniej daty — dokładnie to samo zdanie co dotąd', () => {
    expect(zdanieORozegranychMeczach(5)).toBe(
      'Na tym obiekcie odbyło się już 5 meczów zorganizowanych przez Bojo.',
    );
  });

  it('z ostatnią datą dokłada świeżość po polsku', () => {
    expect(zdanieORozegranychMeczach(1, '2026-08-12')).toBe(
      'Na tym obiekcie odbył się już 1 mecz zorganizowany przez Bojo, ostatni 12 sierpnia 2026.',
    );
  });

  it('null jako ostatnia data zachowuje się jak brak argumentu', () => {
    expect(zdanieORozegranychMeczach(3, null)).toBe(
      'Na tym obiekcie odbyły się już 3 mecze zorganizowane przez Bojo.',
    );
  });
});
