import { describe, it, expect } from 'vitest';

import { NAJWIEKSZE_MIASTA, miastaDoPokazania, podpowiedziMiast } from '@/lib/miasta';

describe('miasta w pustym stanie listy obiektów', () => {
  it('sortuje malejąco po liczbie obiektów', () => {
    const wynik = miastaDoPokazania({ Warszawa: 300, Poznań: 1200, Kraków: 800 });
    expect(wynik.map((m) => m.nazwa)).toEqual(['Poznań', 'Kraków', 'Warszawa']);
  });

  it('miasto bez ani jednego obiektu WYPADA', () => {
    // Zero nie znaczy „nie ma tam boisk", tylko „backfill tam nie dotarł".
    // To nasz problem, nie użytkownika — kafelek „Radom 0" byłby kłamstwem.
    const wynik = miastaDoPokazania({ Warszawa: 5, Kraków: 0 });
    expect(wynik.map((m) => m.nazwa)).toEqual(['Warszawa']);
  });

  it('brak danych o mieście liczy się jak zero', () => {
    expect(miastaDoPokazania({ Warszawa: 5 }).map((m) => m.nazwa)).toEqual(['Warszawa']);
  });

  it('pusta baza `city` daje pustą listę — wywołujący chowa całą sekcję', () => {
    expect(miastaDoPokazania({})).toEqual([]);
  });

  it('pokazujemy tylko miasta z listy, nie cokolwiek przyszło z bazy', () => {
    const wynik = miastaDoPokazania({ Warszawa: 5, 'Wólka Kosowska': 999 });
    expect(wynik.map((m) => m.nazwa)).toEqual(['Warszawa']);
  });

  it('lista jest krótka — kilkanaście kafelków, nie sto', () => {
    expect(NAJWIEKSZE_MIASTA.length).toBeLessThanOrEqual(16);
  });
});

describe('podpowiedziMiast — szukajka podpowiada miasta', () => {
  const liczby = { Poznań: 1240, Gdańsk: 760, Gdynia: 300, Warszawa: 3120, Wrocław: 1105 };

  it('znajduje miasto wpisane BEZ ogonków', () => {
    // Sedno sprawy: ludzie piszą „poznan", nie „Poznań".
    expect(podpowiedziMiast('poznan', liczby).map((m) => m.nazwa)).toEqual(['Poznań']);
  });

  it('radzi sobie z „ł", którego NFD nie rozkłada', () => {
    expect(podpowiedziMiast('wroclaw', liczby).map((m) => m.nazwa)).toEqual(['Wrocław']);
  });

  it('dopasowuje od POCZĄTKU nazwy, większe miasta pierwsze', () => {
    expect(podpowiedziMiast('gd', liczby).map((m) => m.nazwa)).toEqual(['Gdańsk', 'Gdynia']);
  });

  it('nie dopasowuje w środku nazwy', () => {
    // „zna" siedzi w środku „Poznania" — podpowiadanie tego wygląda losowo.
    expect(podpowiedziMiast('zna', liczby)).toEqual([]);
  });

  it('jedna litera nie podpowiada niczego', () => {
    expect(podpowiedziMiast('w', liczby)).toEqual([]);
  });

  it('miasto bez obiektów nie jest podpowiedzią', () => {
    expect(podpowiedziMiast('gdy', { Gdynia: 0 })).toEqual([]);
  });

  it('nie podpowiada więcej niż limit', () => {
    expect(podpowiedziMiast('g', liczby, 1).length).toBeLessThanOrEqual(1);
  });
});
