import { describe, it, expect } from 'vitest';
import { opisNadajeSie, opisTurnieju } from '@/lib/turniejOpis';

const bazowy = {
  sport: 'piłka nożna',
  max_druzyn: 16,
  wpisowe_grosz: 5000,
  data_startu: '2026-09-16',
  godzina_startu: '10:00:00',
  miejsce_nazwa: 'Boisko Orlik Rataje',
  miasto: 'Poznań',
  opis: null as string | null,
};

describe('opisNadajeSie', () => {
  // POWÓD: na produkcji podgląd linku na WhatsAppie pokazywał
  // „[TUR] SPRAWDŹ: plakietka „Na żywo"…", czyli wewnętrzną notatkę z seedu,
  // jako pierwszą rzecz, jaką dwudziestu kapitanów czytało o turnieju.
  it('odrzuca notatki seedowe po znaczniku w nawiasie', () => {
    expect(opisNadajeSie('[TUR] SPRAWDŹ: drabinka po półfinałach')).toBe(false);
    expect(opisNadajeSie('[REG] cokolwiek')).toBe(false);
  });

  it('odrzuca notatkę zaczynającą się od SPRAWDŹ bez znacznika', () => {
    expect(opisNadajeSie('SPRAWDŹ: czy tabela liczy walkower')).toBe(false);
  });

  it('przepuszcza opis pisany przez człowieka', () => {
    expect(opisNadajeSie('Gramy na sztucznej, buty korkotrampki.')).toBe(true);
  });

  it('pusty i biały znak to brak opisu', () => {
    expect(opisNadajeSie('   ')).toBe(false);
    expect(opisNadajeSie(null)).toBe(false);
  });
});

describe('opisTurnieju', () => {
  it('buduje opis z danych, nie z pola tekstowego', () => {
    const o = opisTurnieju(bazowy);
    // Wielką literą i „do 16 drużyn", nie „16 drużyn": sama liczba czytała
    // się jak liczba JUŻ ZAPISANYCH i przeczyła obrazkowi obok, który mówi
    // „4 drużyny z 16" (audyt 4).
    expect(o).toContain('Piłka nożna, do 16 drużyn');
    expect(o).toContain('wpisowe 50 zł od drużyny');
    expect(o).toContain('Boisko Orlik Rataje');
    expect(o).toContain('10:00');
  });

  it('bez wpisowego mówi to wprost, nie milczy', () => {
    expect(opisTurnieju({ ...bazowy, wpisowe_grosz: 0 })).toContain('bez wpisowego');
  });

  it('odmienia drużyny po polsku, w dopełniaczu po „do"', () => {
    expect(opisTurnieju({ ...bazowy, max_druzyn: 1 })).toContain('do 1 drużyny');
    expect(opisTurnieju({ ...bazowy, max_druzyn: 4 })).toContain('do 4 drużyn');
    expect(opisTurnieju({ ...bazowy, max_druzyn: 16 })).toContain('do 16 drużyn');
  });

  it('brak miejsca mówi o sobie, zamiast milczeć', () => {
    const o = opisTurnieju({ ...bazowy, miejsce_nazwa: null, miasto: null });
    expect(o).toContain('miejsce jeszcze nieustalone');
  });

  it('notatka seedowa NIE trafia do opisu linku', () => {
    const o = opisTurnieju({ ...bazowy, opis: '[TUR] SPRAWDŹ: mecz na żywo' });
    expect(o).not.toContain('SPRAWDŹ');
    expect(o).not.toContain('[TUR]');
  });

  it('opis od człowieka dochodzi jako drugie zdanie, nie zamiast danych', () => {
    const o = opisTurnieju({ ...bazowy, opis: 'Buty korkotrampki.' });
    expect(o.indexOf('piłka nożna')).toBeLessThan(o.indexOf('Buty korkotrampki'));
  });

  it('nie zostawia wiszącej kropki', () => {
    const o = opisTurnieju({ ...bazowy, miejsce_nazwa: null, miasto: null });
    expect(o).not.toMatch(/\.\s*\.$/);
    expect(o.endsWith('.')).toBe(true);
  });
});
