import { describe, it, expect } from 'vitest';
import { filtrujGryMapy } from '@/lib/eventFilters';
import type { EventItem } from '@/types';

// Zgłoszone wprost z telefonu: w arkuszu filtrów na `/mapa` klikanie sportu
// nie ruszało licznika „Pokaż N meczy" ani o jeden mecz. Przyczyną nie było
// samo filtrowanie, tylko to, że podgląd liczył po wartościach ZASTOSOWANYCH
// zamiast po szkicu z otwartego arkusza. Funkcja poniżej jest wołana dwa razy
// — raz dla wyniku, raz dla podglądu — więc ten plik pilnuje, że ta sama
// lista z różnymi zawężeniami daje RÓŻNE wyniki.

const mecz = (nadpisz: Partial<EventItem>): EventItem => ({
  id: 'x', organizerId: 'o', organizerName: 'Org', sport: 'piłka nożna',
  fieldName: 'Orlik Sołacz', date: '2026-10-01', time: '18:00:00',
  maxPlayers: 12, participantsCount: 4, costGrosze: 1500,
  ...nadpisz,
} as EventItem);

const BEZ_ZAWEZEN = { sporty: [], tylkoWolne: false, tylkoZaDarmo: false, szukaj: '' };

const LISTA = [
  mecz({ id: 'a', sport: 'piłka nożna' }),
  mecz({ id: 'b', sport: 'futsal' }),
  mecz({ id: 'c', sport: 'koszykówka' }),
  mecz({ id: 'd', sport: 'siatkówka', costGrosze: 0 }),
  mecz({ id: 'e', sport: 'koszykówka', participantsCount: 12, maxPlayers: 12 }),
];

const id = (lista: EventItem[]) => lista.map((e) => e.id).sort().join(',');

describe('filtrujGryMapy — sport', () => {
  it('bez zawężeń oddaje całą listę', () => {
    expect(filtrujGryMapy(LISTA, BEZ_ZAWEZEN)).toHaveLength(5);
  });

  it('wybrany sport zawęża — to jest ta liczba, która nie chciała się ruszać', () => {
    const wynik = filtrujGryMapy(LISTA, { ...BEZ_ZAWEZEN, sporty: ['koszykówka'] });
    expect(id(wynik)).toBe('c,e');
  });

  it('piłka nożna łapie też futsal — w interfejsie to ten sam sport', () => {
    const wynik = filtrujGryMapy(LISTA, { ...BEZ_ZAWEZEN, sporty: ['piłka nożna'] });
    expect(id(wynik)).toBe('a,b');
  });

  it('dwa sporty sumują się, nie przecinają', () => {
    const wynik = filtrujGryMapy(LISTA, { ...BEZ_ZAWEZEN, sporty: ['koszykówka', 'siatkówka'] });
    expect(id(wynik)).toBe('c,d,e');
  });
});

describe('filtrujGryMapy — przełączniki i szukanie', () => {
  it('„wolne miejsca" odsiewa komplet', () => {
    const wynik = filtrujGryMapy(LISTA, { ...BEZ_ZAWEZEN, tylkoWolne: true });
    expect(wynik.some((e) => e.id === 'e')).toBe(false);
    expect(wynik).toHaveLength(4);
  });

  it('„za darmo" zostawia mecz bez opłaty', () => {
    const wynik = filtrujGryMapy(LISTA, { ...BEZ_ZAWEZEN, tylkoZaDarmo: true });
    expect(id(wynik)).toBe('d');
  });

  it('szukanie po nazwie boiska, bez rozróżniania wielkości liter', () => {
    const wynik = filtrujGryMapy(
      [mecz({ id: 'a', fieldName: 'Orlik Sołacz' }), mecz({ id: 'b', fieldName: 'Hala Lecha' })],
      { ...BEZ_ZAWEZEN, szukaj: '  SOŁACZ ' },
    );
    expect(id(wynik)).toBe('a');
  });

  it('zawężenia łączą się przez AND', () => {
    const wynik = filtrujGryMapy(LISTA, {
      ...BEZ_ZAWEZEN, sporty: ['koszykówka'], tylkoWolne: true,
    });
    expect(id(wynik)).toBe('c');
  });
});
