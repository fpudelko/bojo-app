import { describe, it, expect } from 'vitest';
import {
  dayGroup, daysFromToday, eventDay, filterByRadius, filterByMaxPrice, filterByMinFreeSpots,
  freeSpots, groupByDay, matchesDateFilter, multiLabel, sortEvents, startKey, toggleInArray,
  type EventRow, etykietaSkladu } from '@/lib/eventFilters';
import type { EventItem } from '@/types';

/** Minimalny mecz — tylko pola, których dotyka filtrowanie i sortowanie. */
function ev(over: Partial<EventItem> & { date: string }): EventItem {
  // Domyślne najpierw, `over` na końcu — odwrotna kolejność kasowałaby
  // wartości domyślne polami, których wywołujący wcale nie podał.
  return {
    id: over.date + (over.time ?? ''),
    time: '18:00',
    maxPlayers: 14,
    participantsCount: 0,
    ...over,
  } as EventItem;
}

const row = (e: EventItem, distance?: number): EventRow => ({ event: e, distance });

/** Środa 2026-08-05, 12:00 — środek tygodnia, żeby granice tygodnia
 *  (pon–niedz) i najbliższy weekend były jednoznaczne. */
const SRODA = new Date(2026, 7, 5, 12, 0, 0);

describe('eventDay — parsowanie daty bez pułapki strefy czasowej', () => {
  it('zwraca lokalną północ, nie UTC', () => {
    const d = eventDay('2026-08-07')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // sierpień
    expect(d.getDate()).toBe(7);
    expect(d.getHours()).toBe(0);
  });

  it('zwraca null dla śmieci', () => {
    expect(eventDay('')).toBeNull();
    expect(eventDay('nie-data')).toBeNull();
  });
});

describe('daysFromToday', () => {
  it('liczy różnicę w dniach względem podanego „teraz"', () => {
    expect(daysFromToday(new Date(2026, 7, 5), SRODA)).toBe(0);
    expect(daysFromToday(new Date(2026, 7, 6), SRODA)).toBe(1);
    expect(daysFromToday(new Date(2026, 7, 4), SRODA)).toBe(-1);
  });
});

describe('matchesDateFilter', () => {
  it('„wszystkie" przepuszcza wszystko, także niepoprawną datę', () => {
    expect(matchesDateFilter('2030-01-01', 'wszystkie', SRODA)).toBe(true);
    expect(matchesDateFilter('nonsens', 'wszystkie', SRODA)).toBe(true);
  });

  it('„dzisiaj" i „jutro" łapią dokładnie jeden dzień', () => {
    expect(matchesDateFilter('2026-08-05', 'dzisiaj', SRODA)).toBe(true);
    expect(matchesDateFilter('2026-08-06', 'dzisiaj', SRODA)).toBe(false);
    expect(matchesDateFilter('2026-08-06', 'jutro', SRODA)).toBe(true);
    expect(matchesDateFilter('2026-08-07', 'jutro', SRODA)).toBe(false);
  });

  it('„ten tydzień" obejmuje dziś i resztę tygodnia, ale nie przeszłość', () => {
    expect(matchesDateFilter('2026-08-05', 'tydzien', SRODA)).toBe(true); // środa
    expect(matchesDateFilter('2026-08-09', 'tydzien', SRODA)).toBe(true); // niedziela
    expect(matchesDateFilter('2026-08-03', 'tydzien', SRODA)).toBe(false); // miniony poniedziałek
    expect(matchesDateFilter('2026-08-10', 'tydzien', SRODA)).toBe(false); // następny tydzień
  });

  it('„ten miesiąc" obejmuje resztę bieżącego miesiąca, ale nie przeszłość ani inny miesiąc', () => {
    expect(matchesDateFilter('2026-08-05', 'miesiac', SRODA)).toBe(true);  // dziś
    expect(matchesDateFilter('2026-08-31', 'miesiac', SRODA)).toBe(true);  // koniec miesiąca
    expect(matchesDateFilter('2026-08-01', 'miesiac', SRODA)).toBe(false); // ten sam miesiąc, ale przeszłość
    expect(matchesDateFilter('2026-09-01', 'miesiac', SRODA)).toBe(false); // kolejny miesiąc
    expect(matchesDateFilter('2026-07-31', 'miesiac', SRODA)).toBe(false); // poprzedni miesiąc
  });

  it('odrzuca niepoprawną datę przy każdym filtrze innym niż „wszystkie"', () => {
    expect(matchesDateFilter('nonsens', 'dzisiaj', SRODA)).toBe(false);
  });
});

describe('dayGroup', () => {
  it('rozdziela dziś / jutro / ten tydzień / później', () => {
    expect(dayGroup('2026-08-05', SRODA)).toBe('dzisiaj');
    expect(dayGroup('2026-08-06', SRODA)).toBe('jutro');
    expect(dayGroup('2026-08-08', SRODA)).toBe('tydzien');
    expect(dayGroup('2026-08-20', SRODA)).toBe('pozniej');
  });

  it('niepoprawna data ląduje w „później", a nie wysypuje grupowania', () => {
    expect(dayGroup('nonsens', SRODA)).toBe('pozniej');
  });
});

describe('startKey — godzina rozstrzyga kolejność w obrębie dnia', () => {
  // To jest sedno naprawy: getPublicEvents sortuje samą kolumną event_date,
  // więc mecz o 21:00 potrafił stanąć przed tym o 8:00 tego samego dnia.
  // Klucze porównujemy leksykograficznie (są stringami), więc `<` a nie
  // toBeLessThan — dokładnie tak, jak używa ich sortEvents.
  it('mecz wcześniejszy tego samego dnia ma mniejszy klucz', () => {
    const rano = startKey({ date: '2026-08-05', time: '08:00' });
    const wieczor = startKey({ date: '2026-08-05', time: '21:00' });
    expect(rano < wieczor).toBe(true);
  });

  it('brak godziny spycha mecz na koniec dnia', () => {
    const bezGodziny = startKey({ date: '2026-08-05', time: '' });
    const wieczor = startKey({ date: '2026-08-05', time: '21:00' });
    expect(bezGodziny > wieczor).toBe(true);
  });

  it('ucina sekundy z formatu HH:MM:SS', () => {
    expect(startKey({ date: '2026-08-05', time: '18:00:00' })).toBe('2026-08-05T18:00');
  });
});

describe('sortEvents — po terminie', () => {
  it('układa rosnąco po dacie i godzinie', () => {
    const rows = [
      row(ev({ date: '2026-08-05', time: '21:00' })),
      row(ev({ date: '2026-08-05', time: '08:00' })),
      row(ev({ date: '2026-08-04', time: '19:00' })),
    ];
    expect(sortEvents(rows, 'termin').map((r) => startKey(r.event))).toEqual([
      '2026-08-04T19:00', '2026-08-05T08:00', '2026-08-05T21:00',
    ]);
  });

  it('nie modyfikuje tablicy wejściowej', () => {
    const rows = [row(ev({ date: '2026-08-09' })), row(ev({ date: '2026-08-01' }))];
    const before = rows.map((r) => r.event.date);
    sortEvents(rows, 'termin');
    expect(rows.map((r) => r.event.date)).toEqual(before);
  });
});

describe('sortEvents — po odległości', () => {
  it('bliższy mecz jest pierwszy', () => {
    const rows = [
      row(ev({ date: '2026-08-05' }), 12),
      row(ev({ date: '2026-08-06' }), 1.5),
      row(ev({ date: '2026-08-07' }), 7),
    ];
    expect(sortEvents(rows, 'odleglosc').map((r) => r.distance)).toEqual([1.5, 7, 12]);
  });

  it('mecz bez współrzędnych ląduje na końcu, ale nie znika', () => {
    const rows = [
      row(ev({ date: '2026-08-05' })),          // brak dystansu
      row(ev({ date: '2026-08-06' }), 9),
      row(ev({ date: '2026-08-07' }), 2),
    ];
    const out = sortEvents(rows, 'odleglosc');
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.distance)).toEqual([2, 9, undefined]);
  });

  it('same mecze bez współrzędnych wracają do kolejności czasowej', () => {
    const rows = [
      row(ev({ date: '2026-08-09', time: '10:00' })),
      row(ev({ date: '2026-08-05', time: '10:00' })),
    ];
    expect(sortEvents(rows, 'odleglosc').map((r) => r.event.date)).toEqual(['2026-08-05', '2026-08-09']);
  });
});

describe('sortEvents — po wolnych miejscach', () => {
  it('najwięcej wolnych miejsc na górze', () => {
    const rows = [
      row(ev({ date: '2026-08-05', maxPlayers: 14, participantsCount: 13 })), // 1
      row(ev({ date: '2026-08-06', maxPlayers: 14, participantsCount: 2 })),  // 12
      row(ev({ date: '2026-08-07', maxPlayers: 10, participantsCount: 5 })),  // 5
    ];
    expect(sortEvents(rows, 'miejsca').map((r) => freeSpots(r.event))).toEqual([12, 5, 1]);
  });
});

describe('filterByRadius', () => {
  it('bez promienia zwraca wszystko bez zmian', () => {
    const rows = [row(ev({ date: '2026-08-05' }), 50), row(ev({ date: '2026-08-06' }))];
    expect(filterByRadius(rows, null)).toEqual(rows);
  });

  it('wiersz bez dystansu wypada, gdy promień jest ustawiony', () => {
    const rows = [row(ev({ date: '2026-08-05' })), row(ev({ date: '2026-08-06' }), 3)];
    expect(filterByRadius(rows, 5).map((r) => r.distance)).toEqual([3]);
  });

  it('granica jest domknięta — dokładnie na promieniu zostaje', () => {
    const rows = [row(ev({ date: '2026-08-05' }), 5), row(ev({ date: '2026-08-06' }), 5.1)];
    expect(filterByRadius(rows, 5).map((r) => r.distance)).toEqual([5]);
  });
});

describe('groupByDay', () => {
  it('zachowuje kolejność sekcji od dziś w przyszłość', () => {
    const rows = [
      row(ev({ date: '2026-08-20' })), // później
      row(ev({ date: '2026-08-05' })), // dzisiaj
      row(ev({ date: '2026-08-08' })), // ten tydzień
      row(ev({ date: '2026-08-06' })), // jutro
    ];
    expect(groupByDay(rows, SRODA).map((g) => g.group)).toEqual(['dzisiaj', 'jutro', 'tydzien', 'pozniej']);
  });

  it('pomija sekcje, w których nic nie ma', () => {
    const rows = [row(ev({ date: '2026-08-05' })), row(ev({ date: '2026-08-20' }))];
    expect(groupByDay(rows, SRODA).map((g) => g.group)).toEqual(['dzisiaj', 'pozniej']);
  });

  it('nie gubi ani nie duplikuje meczów', () => {
    const rows = ['2026-08-05', '2026-08-05', '2026-08-06', '2026-08-20'].map((d) => row(ev({ date: d })));
    const total = groupByDay(rows, SRODA).reduce((n, g) => n + g.rows.length, 0);
    expect(total).toBe(rows.length);
  });

  it('pusta lista daje zero sekcji', () => {
    expect(groupByDay([], SRODA)).toEqual([]);
  });
});

describe('filterByMaxPrice', () => {
  it('bez limitu zwraca wszystko bez zmian', () => {
    const rows = [row(ev({ date: '2026-08-05', costGrosze: 5000 }))];
    expect(filterByMaxPrice(rows, null)).toEqual(rows);
  });

  it('granica jest domknięta — dokładnie na limicie zostaje', () => {
    const rows = [
      row(ev({ date: '2026-08-05', costGrosze: 1000 })),
      row(ev({ date: '2026-08-06', costGrosze: 1001 })),
    ];
    expect(filterByMaxPrice(rows, 1000).map((r) => r.event.costGrosze)).toEqual([1000]);
  });

  it('mecz za darmo przechodzi limit 0', () => {
    const rows = [
      row(ev({ date: '2026-08-05', costGrosze: 0 })),
      row(ev({ date: '2026-08-06', costGrosze: 1 })),
    ];
    expect(filterByMaxPrice(rows, 0).map((r) => r.event.costGrosze)).toEqual([0]);
  });
});

describe('filterByMinFreeSpots', () => {
  it('0 (dowolna liczba) zwraca wszystko bez zmian', () => {
    const rows = [row(ev({ date: '2026-08-05', maxPlayers: 14, participantsCount: 14 }))];
    expect(filterByMinFreeSpots(rows, 0)).toEqual(rows);
  });

  it('granica jest domknięta — dokładnie na progu zostaje', () => {
    const rows = [
      row(ev({ date: '2026-08-05', maxPlayers: 14, participantsCount: 9 })),  // 5 wolnych
      row(ev({ date: '2026-08-06', maxPlayers: 14, participantsCount: 10 })), // 4 wolne
    ];
    expect(filterByMinFreeSpots(rows, 5).map((r) => freeSpots(r.event))).toEqual([5]);
  });
});

describe('multiLabel', () => {
  const options = [
    { value: 'pilka-nozna', label: 'Piłka nożna' },
    { value: 'siatkowka', label: 'Siatkówka' },
  ];

  it('brak wyboru → etykieta zbiorcza', () => {
    expect(multiLabel([], 'Wszystkie sporty', options)).toBe('Wszystkie sporty');
  });

  it('jeden wybór → etykieta tej opcji', () => {
    expect(multiLabel(['siatkowka'], 'Wszystkie sporty', options)).toBe('Siatkówka');
  });

  it('kilka wyborów → licznik', () => {
    expect(multiLabel(['pilka-nozna', 'siatkowka'], 'Wszystkie sporty', options)).toBe('2 wybrane');
  });
});

describe('toggleInArray', () => {
  it('dodaje brakującą wartość', () => {
    expect(toggleInArray(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('usuwa istniejącą wartość', () => {
    expect(toggleInArray(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('etykietaSkladu — skład na pinezce mapy', () => {
  it('składa liczby w „8/14"', () => {
    expect(etykietaSkladu({ maxPlayers: 14, participantsCount: 8 }))
      .toEqual({ tekst: '8/14', komplet: false });
  });

  it('komplet oznacza się osobno, bo dostaje własny kolor', () => {
    expect(etykietaSkladu({ maxPlayers: 10, participantsCount: 10 }))
      .toEqual({ tekst: '10/10', komplet: true });
  });

  it('przekroczony limit też jest kompletem — organizator może dodać ponad', () => {
    // Awans „Do składu" ponad limit jest świadomą funkcją (patrz R13
    // w seed_regresja), więc 12/10 musi się narysować, a nie wyglądać
    // na wolne miejsca.
    expect(etykietaSkladu({ maxPlayers: 10, participantsCount: 12 }))
      .toEqual({ tekst: '12/10', komplet: true });
  });

  it('bez liczby zapisanych NIE zgadujemy — pinezka zostaje bez pigułki', () => {
    // `participantsCount` wypełniają wyłącznie zapytania listowe. Bez tego
    // warunku pinezka rysowałaby „undefined/14".
    expect(etykietaSkladu({ maxPlayers: 14, participantsCount: undefined })).toBeNull();
  });
});
